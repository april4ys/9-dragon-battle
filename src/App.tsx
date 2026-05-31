import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ScanLine,
  Settings,
  Trophy,
  X,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import {
  type GameState,
  type RoundResult,
  type Side,
  WIN_TARGET,
  compareCards,
  getCardSide,
  initialGameState,
  isValidCard,
  normalizeCardCode,
} from "./game";

type ScannerStatus = "idle" | "starting" | "running" | "error";
type PlayerNames = Record<Side, string>;
type CameraTrackConstraintSet = MediaTrackConstraintSet & {
  focusMode?: "continuous";
};

const SCANNER_ELEMENT_ID = "qr-scanner";
const MAX_NICKNAME_BYTES = 10;
const DEFAULT_PLAYER_NAMES: PlayerNames = {
  A: "A",
  B: "B",
};

function getNicknameBytes(value: string) {
  return Array.from(value).reduce(
    (total, character) => total + (character.charCodeAt(0) > 127 ? 2 : 1),
    0,
  );
}

function limitNicknameBytes(value: string) {
  let nextValue = "";
  let nextBytes = 0;

  for (const character of Array.from(value)) {
    const characterBytes = character.charCodeAt(0) > 127 ? 2 : 1;

    if (nextBytes + characterBytes > MAX_NICKNAME_BYTES) {
      break;
    }

    nextValue += character;
    nextBytes += characterBytes;
  }

  return nextValue;
}

function getQrBoxSize(viewfinderWidth: number, viewfinderHeight: number) {
  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
  const size = Math.floor(Math.min(Math.max(minEdge * 0.58, 190), 280));

  return {
    width: size,
    height: size,
  };
}

function vibrate() {
  if ("vibrate" in navigator) {
    navigator.vibrate(80);
  }
}

function resultLabel(
  result: RoundResult | null,
  playerNames: PlayerNames = DEFAULT_PLAYER_NAMES,
) {
  if (!result) {
    return "라운드 대기";
  }

  return result === "DRAW" ? "무승부" : `${playerNames[result]} 승리`;
}

function finalWinner(state: GameState): Side | null {
  if (state.aWins >= WIN_TARGET) {
    return "A";
  }

  if (state.bWins >= WIN_TARGET) {
    return "B";
  }

  return null;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [message, setMessage] = useState(
    "카메라 켜기 버튼을 눌러 카드를 한 장 스캔하세요.",
  );
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerNames, setPlayerNames] =
    useState<PlayerNames>(DEFAULT_PLAYER_NAMES);
  const [draftPlayerNames, setDraftPlayerNames] =
    useState<PlayerNames>(DEFAULT_PLAYER_NAMES);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const scanLockedRef = useRef(false);

  const winner = useMemo(() => finalWinner(gameState), [gameState]);
  const completedRounds = Math.floor(gameState.usedCards.length / 2);
  const currentRound = gameState.gameOver
    ? completedRounds
    : completedRounds + 1;
  const winnerTone = winner === "B" ? "tone-b" : "tone-a";
  const winnerName = winner ? playerNames[winner] : "";

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    scanLockedRef.current = true;

    if (!scanner) {
      scanLockedRef.current = false;
      setScannerStatus("idle");
      setScannerOpen(false);
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // The scanner may already be stopping after a successful read.
    } finally {
      scanLockedRef.current = false;
      setScannerStatus("idle");
      setScannerOpen(false);
    }
  }, []);

  const registerScan = useCallback(
    (rawValue: string) => {
      const card = normalizeCardCode(rawValue);
      const now = Date.now();
      const previous = lastScanRef.current;

      if (previous?.code === card && now - previous.time < 1200) {
        return;
      }

      lastScanRef.current = { code: card, time: now };
      vibrate();

      setGameState((current) => {
        if (current.gameOver) {
          setMessage("게임이 이미 종료되었습니다.");
          return current;
        }

        if (!isValidCard(card)) {
          setMessage("유효하지 않은 카드입니다.");
          return current;
        }

        const side = getCardSide(card);
        const slotFilled =
          side === "A" ? current.currentACard : current.currentBCard;

        if (slotFilled) {
          setMessage("해당 진영의 카드가 이미 등록되었습니다.");
          return current;
        }

        if (current.usedCards.includes(card)) {
          setMessage("이미 사용된 카드입니다.");
          return current;
        }

        if (current.lastScannedSide === side) {
          setMessage("같은 진영의 카드가 연속으로 스캔되었습니다.");
          return current;
        }

        const usedCards = [...current.usedCards, card];
        const nextRound = {
          currentACard: side === "A" ? card : current.currentACard,
          currentBCard: side === "B" ? card : current.currentBCard,
        };

        if (nextRound.currentACard && nextRound.currentBCard) {
          const result = compareCards(
            nextRound.currentACard,
            nextRound.currentBCard,
          );
          const aWins = current.aWins + (result === "A" ? 1 : 0);
          const bWins = current.bWins + (result === "B" ? 1 : 0);
          const gameOver = aWins >= WIN_TARGET || bWins >= WIN_TARGET;
          const round = Math.floor(current.usedCards.length / 2) + 1;
          const roundLogs = [...current.roundLogs, { round, result }];

          setLastResult(result);
          setMessage(
            gameOver
              ? `${playerNames[aWins >= WIN_TARGET ? "A" : "B"]} 최종 승리`
              : `양쪽 카드 스캔 완료. ${resultLabel(result, playerNames)}`,
          );

          return {
            aWins,
            bWins,
            currentACard: null,
            currentBCard: null,
            lastScannedSide: null,
            usedCards,
            roundLogs,
            gameOver,
          };
        }

        setLastResult(null);
        setMessage(
          `${playerNames[side]} 카드 등록 완료. 카메라 켜기 버튼을 눌러 상대 카드를 스캔하세요.`,
        );

        return {
          ...current,
          ...nextRound,
          lastScannedSide: side,
          usedCards,
        };
      });
    },
    [playerNames],
  );

  const openScanner = useCallback(() => {
    if (gameState.gameOver) {
      setMessage("게임이 이미 종료되었습니다.");
      return;
    }

    if (scannerStatus === "starting" || scannerStatus === "running") {
      return;
    }

    setScannerOpen(true);
  }, [gameState.gameOver, scannerStatus]);

  const startScanner = useCallback(async () => {
    if (gameState.gameOver) {
      setMessage("게임이 이미 종료되었습니다.");
      setScannerOpen(false);
      return;
    }

    if (scannerStatus === "starting" || scannerStatus === "running") {
      return;
    }

    if (!document.getElementById(SCANNER_ELEMENT_ID)) {
      return;
    }

    scanLockedRef.current = false;
    setScannerStatus("starting");

    const cameraConstraints: MediaTrackConstraints[] = [
      {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [{ focusMode: "continuous" } as CameraTrackConstraintSet],
      },
      { facingMode: "environment" },
    ];

    for (const cameraConfig of cameraConstraints) {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          cameraConfig,
          {
            fps: 20,
            qrbox: getQrBoxSize,
            disableFlip: true,
          },
          (decodedText) => {
            if (scanLockedRef.current) {
              return;
            }

            scanLockedRef.current = true;
            registerScan(decodedText);
            void stopScanner();
          },
          undefined,
        );

        setScannerStatus("running");
        setMessage(
          "카메라 스캔 중입니다. 작은 QR은 박스 안에 크게 차도록 가까이 비춰주세요.",
        );
        return;
      } catch {
        scannerRef.current = null;
        try {
          scanner.clear();
        } catch {
          // Ignore cleanup errors between camera fallback attempts.
        }
      }
    }

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 15,
          qrbox: getQrBoxSize,
        },
        (decodedText) => {
          if (scanLockedRef.current) {
            return;
          }

          scanLockedRef.current = true;
          registerScan(decodedText);
          void stopScanner();
        },
        undefined,
      );

      setScannerStatus("running");
      setMessage(
        "카메라 스캔 중입니다. 작은 QR은 박스 안에 크게 차도록 가까이 비춰주세요.",
      );
    } catch {
      scannerRef.current = null;
      scanLockedRef.current = false;
      setScannerStatus("error");
      setMessage(
        "카메라를 시작할 수 없습니다. iPhone에서는 Safari로 HTTPS 주소를 열고 카메라 권한을 허용하세요.",
      );
    }
  }, [gameState.gameOver, registerScan, scannerStatus, stopScanner]);

  useEffect(() => {
    if (scannerOpen && scannerStatus === "idle") {
      void startScanner();
    }
  }, [scannerOpen, scannerStatus, startScanner]);

  useEffect(() => {
    if (winner) {
      setWinnerModalOpen(true);
    }
  }, [winner]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (!scanner) {
        return;
      }

      if (scanner.isScanning) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      } else {
        try {
          scanner.clear();
        } catch {
          // Ignore scanner cleanup races during unmount.
        }
      }
    };
  }, []);

  function resetGame() {
    void stopScanner();
    setGameState(initialGameState);
    setLastResult(null);
    setMessage(
      "새 게임이 시작되었습니다. 카메라 켜기 버튼을 눌러 카드를 한 장 스캔하세요.",
    );
    setWinnerModalOpen(false);
    lastScanRef.current = null;
  }

  function openSettings() {
    setDraftPlayerNames(playerNames);
    setSettingsOpen(true);
  }

  function savePlayerNames(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlayerNames({
      A: limitNicknameBytes(draftPlayerNames.A.trim()) || "A",
      B: limitNicknameBytes(draftPlayerNames.B.trim()) || "B",
    });
    setSettingsOpen(false);
  }

  return (
    <main className="app-shell">
      <section className="game-board" aria-label="구룡투 게임판">
        <header className="top-bar">
          <div>
            <h1>구룡투</h1>
            <p className="round-label">라운드 {currentRound}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={openSettings}
            aria-label="닉네임 설정"
          >
            <Settings size={22} aria-hidden="true" />
          </button>
        </header>

        <div
          className="scoreboard"
          aria-label={`${playerNames.A} ${gameState.aWins} 대 ${gameState.bWins} ${playerNames.B}`}
        >
          <div className="score-side">
            <span>{playerNames.A}</span>
            <strong>{gameState.aWins}</strong>
          </div>
          <span className="score-divider">:</span>
          <div className="score-side score-side-b">
            <span>{playerNames.B}</span>
            <strong>{gameState.bWins}</strong>
          </div>
        </div>

        <div className="cards-grid">
          <article className="side-card side-a">
            <strong>{gameState.currentACard ? "등록 완료" : "대기 중"}</strong>
            {gameState.currentACard ? (
              <CheckCircle2 size={28} aria-hidden="true" />
            ) : (
              <Loader2 size={28} aria-hidden="true" />
            )}
          </article>
          <span className="versus">VS</span>
          <article className="side-card side-b">
            <strong>{gameState.currentBCard ? "등록 완료" : "대기 중"}</strong>
            {gameState.currentBCard ? (
              <CheckCircle2 size={28} aria-hidden="true" />
            ) : (
              <Loader2 size={28} aria-hidden="true" />
            )}
          </article>
        </div>

        <div className="camera-action">
          <button
            className="camera-toggle"
            type="button"
            onClick={openScanner}
            disabled={scannerStatus === "starting" || gameState.gameOver}
          >
            <Camera size={23} aria-hidden="true" />
            <span>
              {scannerStatus === "starting" ? "카메라 준비 중" : "카메라 켜기"}
            </span>
          </button>
        </div>

        <section className="round-log-card" aria-live="polite">
          <div className="round-log" aria-label="라운드 결과 기록">
            <span>라운드 기록</span>
            {gameState.roundLogs.length > 0 ? (
              <ol>
                {[...gameState.roundLogs].reverse().map((log) => (
                  <li key={log.round}>
                    <span>{log.round}라운드</span>
                    <strong>{resultLabel(log.result, playerNames)}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p>아직 완료된 라운드가 없습니다.</p>
            )}
          </div>
        </section>

        <p className="status-message" aria-live="polite">
          {message}
        </p>

        <button className="reset-button" type="button" onClick={resetGame}>
          <RotateCcw size={20} aria-hidden="true" />
          <span>새 게임</span>
        </button>
      </section>

      {scannerOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="QR 카메라 스캔"
        >
          <section className="scan-modal">
            <header className="modal-header">
              <div>
                <strong>QR 스캔</strong>
                <span>카드를 비춰 QR 코드를 스캔하세요.</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={stopScanner}
                aria-label="카메라 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="scanner-panel">
              <div id={SCANNER_ELEMENT_ID} className="scanner" />
              <div className="scanner-state">
                {scannerStatus === "running" ? (
                  <ScanLine size={18} />
                ) : (
                  <Camera size={18} />
                )}
                <span>
                  {scannerStatus === "running" && "카메라 스캔 중"}
                  {scannerStatus === "starting" && "카메라 준비 중"}
                  {scannerStatus === "idle" && "스캐너 대기 중"}
                  {scannerStatus === "error" && "카메라 사용 불가"}
                </span>
              </div>
            </div>
            <button
              className="camera-close-button"
              type="button"
              onClick={stopScanner}
            >
              <span>취소</span>
            </button>
          </section>
        </div>
      ) : null}

      {winner && winnerModalOpen && !scannerOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="최종 승리"
        >
          <section className={`winner-modal ${winnerTone}`}>
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <Trophy size={42} aria-hidden="true" />
            <span>최종 승리</span>
            <strong>{winnerName} 승리!</strong>
            <p>
              {currentRound}라운드 만에 {winnerName}이 먼저 {WIN_TARGET}승을
              달성했습니다.
            </p>
            <div
              className="scoreboard"
              aria-label={`최종 점수 ${playerNames.A} ${gameState.aWins} 대 ${gameState.bWins} ${playerNames.B}`}
            >
              <div className="score-side">
                <strong>{gameState.aWins}</strong>
                <span>{playerNames.A}</span>
              </div>
              <span className="score-divider">:</span>
              <div className="score-side score-side-b">
                <strong>{gameState.bWins}</strong>
                <span>{playerNames.B}</span>
              </div>
            </div>
            <button
              className="new-game-button"
              type="button"
              onClick={resetGame}
            >
              새 게임
            </button>
            <button
              className="modal-secondary-button"
              type="button"
              onClick={() => setWinnerModalOpen(false)}
            >
              결과판 보기
            </button>
          </section>
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="닉네임 설정"
        >
          <form className="settings-modal" onSubmit={savePlayerNames}>
            <header className="modal-header">
              <div>
                <strong>닉네임 설정</strong>
                <span>점수판과 결과 기록에 표시될 이름입니다.</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="설정 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <label className="name-field name-field-a">
              <span>A 진영</span>
              <input
                value={draftPlayerNames.A}
                onChange={(event) =>
                  setDraftPlayerNames((current) => ({
                    ...current,
                    A: limitNicknameBytes(event.target.value),
                  }))
                }
                placeholder="A"
              />
              <small>
                {getNicknameBytes(draftPlayerNames.A)} / {MAX_NICKNAME_BYTES}{" "}
                byte
              </small>
            </label>

            <label className="name-field name-field-b">
              <span>B 진영</span>
              <input
                value={draftPlayerNames.B}
                onChange={(event) =>
                  setDraftPlayerNames((current) => ({
                    ...current,
                    B: limitNicknameBytes(event.target.value),
                  }))
                }
                placeholder="B"
              />
              <small>
                {getNicknameBytes(draftPlayerNames.B)} / {MAX_NICKNAME_BYTES}{" "}
                byte
              </small>
            </label>

            <button className="save-settings-button" type="submit">
              저장
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

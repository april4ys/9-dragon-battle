import { useCallback, useEffect, useRef, useState } from "react";
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
import QrScanner from "qr-scanner";
import {
  type GameState,
  type RoundResult,
  type Side,
  compareCards,
  getCardSide,
  getFinalResult,
  getNextFirstSide,
  initialGameState,
  isValidCard,
  normalizeCardCode,
} from "./game";

type ScannerStatus = "idle" | "starting" | "running" | "error";
type PlayerNames = Record<Side, string>;

const SCANNER_ELEMENT_ID = "qr-scanner";
const MAX_NICKNAME_BYTES = 10;
const SCANNER_STOP_DELAY_MS = 300;
const QR_SCANNER_CONFIG = QrScanner as unknown as {
  _disableBarcodeDetector?: boolean;
};
const DEFAULT_PLAYER_NAMES: PlayerNames = {
  A: "A",
  B: "B",
};

// The worker decoder honors inversionMode consistently for white-on-black QR.
QR_SCANNER_CONFIG._disableBarcodeDetector = true;

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
  const scannerRef = useRef<QrScanner | null>(null);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const scanLockedRef = useRef(false);
  const stopTimerRef = useRef<number | null>(null);

  const finalResult = gameState.finalResult;
  const winner = finalResult === "A" || finalResult === "B" ? finalResult : null;
  const isFinalDraw = finalResult === "DRAW";
  const completedRounds = Math.floor(gameState.usedCards.length / 2);
  const currentRound = gameState.gameOver
    ? completedRounds
    : completedRounds + 1;
  const winnerTone = isFinalDraw ? "tone-draw" : winner === "B" ? "tone-b" : "tone-a";
  const winnerName = winner ? playerNames[winner] : "";

  const stopScanner = useCallback(async () => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

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
      scanner.stop();
      scanner.destroy();
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
          const round = Math.floor(current.usedCards.length / 2) + 1;
          const nextFirstSide = getNextFirstSide(result, current.roundLogs);
          const roundLogs = [...current.roundLogs, { round, result }];
          const finalResult = getFinalResult(aWins, bWins, usedCards.length);
          const gameOver = finalResult !== null;
          const firstPlayerMessage = nextFirstSide
            ? `\n${playerNames[nextFirstSide]}가 선입니다.`
            : "";

          setLastResult(result);
          setMessage(
            finalResult
              ? finalResult === "DRAW"
                ? "최종 무승부"
                : `${playerNames[finalResult]} 최종 승리`
              : `양쪽 카드 스캔 완료. ${resultLabel(result, playerNames)}${firstPlayerMessage}`,
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
            finalResult,
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

    const video = scannerVideoRef.current;

    if (!video) {
      return;
    }

    scanLockedRef.current = false;
    setScannerStatus("starting");

    try {
      const scanner = new QrScanner(
        video,
        (result) => {
          console.log("QR decoded:", result.data);
          console.log(result);

          if (scanLockedRef.current) {
            return;
          }

          scanLockedRef.current = true;
          registerScan(result.data);
          stopTimerRef.current = window.setTimeout(() => {
            stopTimerRef.current = null;
            void stopScanner();
          }, SCANNER_STOP_DELAY_MS);
        },
        {
          onDecodeError: (error) => {
            if (error !== QrScanner.NO_QR_CODE_FOUND) {
              console.warn("QR decode error:", error);
            }
          },
          preferredCamera: "environment",
          maxScansPerSecond: 15,
          returnDetailedScanResult: true,
        },
      );

      scanner.setInversionMode("both");
      scannerRef.current = scanner;
      await scanner.start();

      setScannerStatus("running");
      setMessage("카메라 스캔 중입니다. 카드를 자연스럽게 비춰주세요.");
    } catch (error) {
      console.warn("QR scanner start failed:", error);
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        scanner.destroy();
      }

      scanLockedRef.current = false;
      setScannerStatus("error");
      setMessage(
        "카메라를 시작할 수 없습니다. HTTPS 주소에서 카메라 권한을 허용했는지 확인하세요.",
      );
    }
  }, [
    gameState.gameOver,
    registerScan,
    scannerStatus,
    stopScanner,
  ]);

  useEffect(() => {
    if (scannerOpen && scannerStatus === "idle") {
      void startScanner();
    }
  }, [scannerOpen, scannerStatus, startScanner]);

  useEffect(() => {
    if (finalResult) {
      setWinnerModalOpen(true);
    }
  }, [finalResult]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (!scanner) {
        return;
      }

      try {
        scanner.stop();
        scanner.destroy();
      } catch {
        // Ignore scanner cleanup races during unmount.
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
              <div id={SCANNER_ELEMENT_ID} className="scanner">
                <video
                  ref={scannerVideoRef}
                  muted
                  playsInline
                  className="scanner-video"
                />
              </div>
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

      {finalResult && winnerModalOpen && !scannerOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={isFinalDraw ? "최종 무승부" : "최종 승리"}
        >
          <section className={`winner-modal ${winnerTone}`}>
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <Trophy size={42} aria-hidden="true" />
            <span>{isFinalDraw ? "게임 종료" : "최종 승리"}</span>
            <strong>{isFinalDraw ? "최종 무승부" : `${winnerName} 승리!`}</strong>
            <p>
              {isFinalDraw
                ? `${currentRound}라운드 종료. 양측 승수가 같아 무승부입니다.`
                : `${currentRound}라운드 만에 ${winnerName}이 최종 승리를 달성했습니다.`}
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

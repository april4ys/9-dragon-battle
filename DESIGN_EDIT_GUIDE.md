# 구룡투 UI 수정 가이드

이 문서는 직접 디자인을 수정할 때 어떤 파일과 CSS 클래스를 손보면 되는지 빠르게 찾기 위한 안내입니다.

## 주요 파일

- `src/App.tsx`: 화면 구조, 버튼, 모달, 표시 문구를 수정하는 곳
- `src/styles.css`: 색상, 크기, 간격, 레이아웃, 모달 스타일을 수정하는 곳
- `src/game.ts`: 게임 상태 타입과 카드 판정 로직을 수정하는 곳

디자인만 바꿀 때는 대부분 `src/styles.css`를 수정하면 됩니다. 화면에 표시되는 요소의 순서나 문구를 바꾸려면 `src/App.tsx`를 수정하세요.

## 메인 화면 구조

`src/App.tsx`의 반환 JSX 안에서 메인 화면은 대략 아래 순서입니다.

```tsx
<main className="app-shell">
  <section className="game-board">
    <header className="top-bar">...</header>
    <div className="scoreboard">...</div>
    <div className="cards-grid">...</div>
    <div className="camera-action">...</div>
    <section className="round-log-card">...</section>
    <p className="status-message">...</p>
    <button className="reset-button">...</button>
  </section>
</main>
```

## 전체 배경과 게임판

수정 위치: `src/styles.css`

- `.app-shell`: 전체 페이지 배경, 바깥 여백
- `.game-board`: 메인 게임판 카드의 폭, 테두리, 내부 여백, 그림자

자주 바꾸는 값:

```css
.app-shell {
  padding: 16px;
  background: ...;
}

.game-board {
  width: min(100%, 460px);
  border-radius: 18px;
  padding: 22px 18px 20px;
}
```

## 상단 타이틀

수정 위치:

- 구조/문구: `src/App.tsx`의 `.top-bar`
- 디자인: `src/styles.css`의 `.top-bar`, `h1`, `.round-label`, `.icon-button`

바꿀 수 있는 것:

- `구룡투` 제목 크기
- 라운드 표시 위치
- 설정 아이콘 버튼 모양

설정 아이콘은 닉네임 설정 모달을 엽니다. 닉네임 입력 UI는 `src/App.tsx`의 `settingsOpen` 모달 블록과 `src/styles.css`의 `.settings-modal`, `.name-field`, `.save-settings-button`에서 수정합니다.

## 점수판

수정 위치:

- 구조: `src/App.tsx`의 `.scoreboard`
- 디자인: `src/styles.css`의 `.scoreboard`, `.score-side`, `.score-divider`

중요 클래스:

- `.score-side`: A/B 점수 블록 공통
- `.score-side-b`: B 점수만 따로 조정
- `.score-divider`: 가운데 `:`

A 색상은 `.score-side strong`, `.score-side span`에서 조정하고, B 색상은 `.score-side-b strong`, `.score-side-b span`에서 조정합니다.

## 카드 등록 상태

수정 위치:

- 구조: `src/App.tsx`의 `.cards-grid`
- 디자인: `src/styles.css`의 `.cards-grid`, `.side-card`, `.side-a`, `.side-b`, `.versus`

현재 표시 방식:

- A/B 카드 코드는 숨김
- `등록 완료` 또는 `대기 중`만 표시
- 등록 완료 아이콘: `CheckCircle2`
- 대기 중 아이콘: `Loader2`

카드 박스 크기나 간격은 `.side-card`와 `.cards-grid`를 수정하면 됩니다.

## 카메라 켜기 버튼

수정 위치:

- 구조: `src/App.tsx`의 `.camera-action`
- 디자인: `src/styles.css`의 `.camera-action`, `.camera-toggle`

버튼 색상, 높이, 둥근 정도는 `.camera-toggle`에서 수정합니다.

```css
.camera-toggle {
  min-height: 64px;
  border-radius: 10px;
  background: linear-gradient(135deg, #d3262d, #f04b4f);
}
```

## 라운드 기록

수정 위치:

- 구조: `src/App.tsx`의 `.round-log-card`, `.round-log`
- 디자인: `src/styles.css`의 `.round-log-card`, `.round-log`, `.round-log li`

현재 기록은 최신 라운드가 위에 표시됩니다.

```tsx
{[...gameState.roundLogs].reverse().map((log) => (...))}
```

오래된 기록부터 보이게 하려면 `.reverse()`를 제거하면 됩니다.

## 상태 메시지

수정 위치:

- 구조/문구: `src/App.tsx`의 `message`
- 디자인: `src/styles.css`의 `.status-message`

예시 문구:

- `카메라 켜기 버튼을 눌러 카드를 한 장 스캔하세요.`
- `A측 카드 등록 완료. 카메라 켜기 버튼을 눌러 상대 진영 카드를 스캔하세요.`
- `이미 사용된 카드입니다.`

## 새 게임 버튼

수정 위치:

- 구조: `src/App.tsx`의 `.reset-button`
- 디자인: `src/styles.css`의 `.reset-button`

최종 승리 모달 안의 새 게임 버튼은 `.new-game-button`을 사용합니다.

## QR 스캔 모달

수정 위치:

- 구조: `src/App.tsx`의 `{scannerOpen ? (...) : null}` 블록
- 디자인: `src/styles.css`의 `.modal-backdrop`, `.scan-modal`, `.scanner-panel`, `.scanner`, `.scan-frame`

중요 클래스:

- `.modal-backdrop`: 모달 뒤 어두운 배경
- `.scan-modal`: QR 스캔 모달 박스
- `.scanner-panel`: 카메라 화면 영역
- `.scanner`: 실제 `qr-scanner` 카메라 영상을 표시하는 영역
- `.scan-frame`: 흰색 모서리와 빨간 스캔 라인
- `.camera-close-button`: 취소 버튼

카메라 화면 높이는 아래 값을 수정하면 됩니다.

```css
.scan-modal .scanner-panel {
  min-height: 620px;
}

.scan-modal .scanner {
  min-height: 520px;
}
```

## 최종 승리 모달

수정 위치:

- 구조: `src/App.tsx`의 `{winner && winnerModalOpen ...}` 블록
- 디자인: `src/styles.css`의 `.winner-modal`, `.tone-a`, `.tone-b`, `.confetti`

현재 방식:

- A 승리: `.tone-a`, 빨간 테마
- B 승리: `.tone-b`, 파란 테마
- 최종 점수판 포함
- `새 게임`, `결과판 보기` 버튼 포함

승리 문구는 `src/App.tsx`의 아래 부분을 수정하면 됩니다.

```tsx
<strong>{winner} 진영 승리!</strong>
```

## 반응형 조정

작은 화면 대응은 `src/styles.css` 맨 아래의 미디어 쿼리에서 수정합니다.

```css
@media (max-width: 380px) {
  .app-shell {
    padding: 12px;
  }

  .game-board {
    padding: 20px 16px 18px;
  }
}
```

iPhone 13 mini처럼 작은 화면에서 글자가 크거나 모달이 넘치면 이 구간을 먼저 조정하세요.

## 색상 빠른 수정 포인트

- A 진영 빨강: `#ff585d`, `#ff4c51`, `#d3262d`
- B 진영 파랑: `#348cff`, `#2f84ff`, `#1875ee`
- 버튼 노랑/기존 포인트가 필요하면: `#f1b955`
- 배경 어두운 색: `#090d10`, `#10171d`, `#0d1216`

전체 테마를 바꾸고 싶다면 이 색상들을 먼저 검색해서 교체하면 됩니다.

## 아이콘 변경

아이콘은 `lucide-react`를 사용합니다.

수정 위치: `src/App.tsx` 상단 import

```tsx
import { Camera, Trophy, X } from "lucide-react";
```

아이콘을 바꾸려면 lucide-react 아이콘 이름을 import하고 JSX 안의 컴포넌트를 교체하면 됩니다.

## 수정 후 확인

개발 서버가 켜져 있다면 저장 즉시 브라우저에 반영됩니다.

```bash
npm run dev:https
```

검증 명령:

```bash
npm run test
npm run build
```

카메라 테스트는 iPhone Safari에서 HTTPS 주소로 접속해야 안정적으로 동작합니다.

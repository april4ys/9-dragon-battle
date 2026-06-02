export type Side = "A" | "B";
export type RoundResult = Side | "DRAW";
export type FinalResult = RoundResult | null;

export type RoundLog = {
  round: number;
  result: RoundResult;
};

export type GameState = {
  aWins: number;
  bWins: number;
  currentACard: string | null;
  currentBCard: string | null;
  lastScannedSide: Side | null;
  usedCards: string[];
  roundLogs: RoundLog[];
  gameOver: boolean;
  finalResult: FinalResult;
};

export const WIN_TARGET = 5;
export const MAX_ROUNDS = 9;
export const TOTAL_CARD_COUNT = 18;

export const VALID_CARDS = new Set(
  Array.from({ length: 9 }, (_, index) => index + 1).flatMap((value) => [
    `A${value}`,
    `B${value}`,
  ]),
);

export const initialGameState: GameState = {
  aWins: 0,
  bWins: 0,
  currentACard: null,
  currentBCard: null,
  lastScannedSide: null,
  usedCards: [],
  roundLogs: [],
  gameOver: false,
  finalResult: null,
};

export function normalizeCardCode(rawValue: string): string {
  return rawValue.trim().toUpperCase();
}

export function isValidCard(card: string): boolean {
  return VALID_CARDS.has(card);
}

export function getCardSide(card: string): Side {
  return card[0] as Side;
}

export function getCardValue(card: string): number {
  return Number(card.at(-1));
}

export function compareCards(aCard: string, bCard: string): RoundResult {
  const aValue = getCardValue(aCard);
  const bValue = getCardValue(bCard);

  if (aValue === bValue) {
    return "DRAW";
  }

  if (aValue === 1 && bValue === 9) {
    return "A";
  }

  if (aValue === 9 && bValue === 1) {
    return "B";
  }

  return aValue > bValue ? "A" : "B";
}

export function getFinalResult(
  aWins: number,
  bWins: number,
  usedCardsCount: number,
): FinalResult {
  if (aWins >= WIN_TARGET) {
    return "A";
  }

  if (bWins >= WIN_TARGET) {
    return "B";
  }

  const completedRounds = Math.floor(usedCardsCount / 2);
  const remainingRounds = Math.max(MAX_ROUNDS - completedRounds, 0);

  if (aWins > bWins + remainingRounds) {
    return "A";
  }

  if (bWins > aWins + remainingRounds) {
    return "B";
  }

  if (usedCardsCount < TOTAL_CARD_COUNT) {
    return null;
  }

  if (aWins > bWins) {
    return "A";
  }

  if (bWins > aWins) {
    return "B";
  }

  return "DRAW";
}

export function getNextFirstSide(
  result: RoundResult,
  previousLogs: RoundLog[],
): Side | null {
  if (result !== "DRAW") {
    return result;
  }

  const previousWinner = [...previousLogs]
    .reverse()
    .find((log) => log.result !== "DRAW")?.result;

  return previousWinner === "A" || previousWinner === "B" ? previousWinner : null;
}

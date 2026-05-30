export type Side = "A" | "B";
export type RoundResult = Side | "DRAW";

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
};

export const WIN_TARGET = 5;

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

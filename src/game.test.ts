import { describe, expect, it } from "vitest";
import {
  compareCards,
  getFinalResult,
  getNextFirstSide,
  isValidCard,
  normalizeCardCode,
} from "./game";

describe("compareCards", () => {
  it("returns the higher value winner", () => {
    expect(compareCards("A7", "B5")).toBe("A");
    expect(compareCards("A2", "B8")).toBe("B");
  });

  it("returns DRAW when values are equal", () => {
    expect(compareCards("A5", "B5")).toBe("DRAW");
  });

  it("lets 1 beat 9", () => {
    expect(compareCards("A1", "B9")).toBe("A");
    expect(compareCards("A9", "B1")).toBe("B");
  });
});

describe("card validation", () => {
  it("accepts only A1-A9 and B1-B9", () => {
    expect(isValidCard("A1")).toBe(true);
    expect(isValidCard("B9")).toBe(true);
    expect(isValidCard("C1")).toBe(false);
    expect(isValidCard("A0")).toBe(false);
    expect(isValidCard("A10")).toBe(false);
  });

  it("normalizes scanned text", () => {
    expect(normalizeCardCode(" b7\n")).toBe("B7");
  });
});

describe("getFinalResult", () => {
  it("ends immediately when a side reaches 5 wins", () => {
    expect(getFinalResult(5, 2, 14)).toBe("A");
    expect(getFinalResult(3, 5, 16)).toBe("B");
  });

  it("returns DRAW after all 9 rounds when wins are tied", () => {
    expect(getFinalResult(0, 0, 18)).toBe("DRAW");
    expect(getFinalResult(2, 2, 18)).toBe("DRAW");
  });

  it("compares wins after all 9 rounds when no side reached 5 wins", () => {
    expect(getFinalResult(3, 2, 18)).toBe("A");
    expect(getFinalResult(2, 3, 18)).toBe("B");
  });

  it("ends when the leader cannot be caught with the remaining rounds", () => {
    expect(getFinalResult(4, 0, 12)).toBe("A");
  });

  it("does not end when the opponent can still tie", () => {
    expect(getFinalResult(4, 0, 10)).toBeNull();
  });
});

describe("getNextFirstSide", () => {
  it("uses the round winner as the next first side", () => {
    expect(getNextFirstSide("A", [])).toBe("A");
    expect(getNextFirstSide("B", [])).toBe("B");
  });

  it("keeps the previous first side when the round is a draw", () => {
    expect(
      getNextFirstSide("DRAW", [
        { round: 1, result: "A" },
        { round: 2, result: "DRAW" },
      ]),
    ).toBe("A");
  });

  it("has no first side after a draw if no previous side won", () => {
    expect(getNextFirstSide("DRAW", [{ round: 1, result: "DRAW" }])).toBeNull();
  });
});

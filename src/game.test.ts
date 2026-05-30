import { describe, expect, it } from "vitest";
import { compareCards, isValidCard, normalizeCardCode } from "./game";

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

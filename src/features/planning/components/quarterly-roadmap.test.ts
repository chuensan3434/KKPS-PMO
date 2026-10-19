import { describe, expect, it } from "vitest";
import { DEFAULT_ROADMAP_YEAR, quarterSpan } from "./quarterly-roadmap";

describe("quarterly roadmap", () => {
  it("defaults the initial experience to 2027 without limiting later years", () => expect(DEFAULT_ROADMAP_YEAR).toBe(2027));
  it("calculates inclusive cross-quarter spans", () => {
    expect(quarterSpan({ start_quarter: 1, end_quarter: 1 })).toBe(1);
    expect(quarterSpan({ start_quarter: 1, end_quarter: 4 })).toBe(4);
  });
});

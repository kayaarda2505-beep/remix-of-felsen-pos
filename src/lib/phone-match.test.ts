import { describe, expect, it } from "vitest";
import { phonesMatch } from "./phone-match";

describe("phonesMatch", () => {
  it("matches international and local Swiss formats", () => {
    expect(phonesMatch("+41 79 813 69 29", "079 813 69 29")).toBe(true);
    expect(phonesMatch("0041798136929", "0798136929")).toBe(true);
  });
  it("rejects different or too short numbers", () => {
    expect(phonesMatch("0798136929", "0798136920")).toBe(false);
    expect(phonesMatch("1234", "1234")).toBe(false);
  });
});

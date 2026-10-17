import { describe, expect, it } from "vitest";
import { place } from "./__fixtures__/synthetic";
import {
  HEARD_FLOOR,
  PARTLY_HEARD_CEILING,
  RICHNESS_EXPONENT,
  scorePlace,
  weightFromRichness,
} from "./score";

const interests = new Set(["historical"]);

describe("scorePlace", () => {
  it("prefers a matching place over a closer non-matching one", () => {
    const matching = scorePlace(place("m", 0, 0, ["historical"]), 140, interests);
    const other = scorePlace(place("o", 0, 0, ["cultural"]), 0, interests);
    expect(matching).toBeGreaterThan(other);
  });

  it("prefers a modest matching place over a rich non-matching one", () => {
    const modest = scorePlace(place("m", 0, 0, ["historical"], 2), 0, interests);
    const rich = scorePlace(place("r", 0, 0, ["cultural"], 6), 0, interests);
    expect(modest).toBeGreaterThan(rich);
  });

  it("adds a little for each further matching interest", () => {
    const both = new Set(["historical", "cultural"]);
    const one = scorePlace(place("a", 0, 0, ["historical"]), 0, both);
    const two = scorePlace(place("b", 0, 0, ["historical", "cultural"]), 0, both);
    expect(two).toBeCloseTo(one * 1.5, 6);
  });

  it("weighs richness by familiarity: first-timers favour rich places more than locals", () => {
    const rich = place("r", 0, 0, ["historical"], 6);
    const modest = place("m", 0, 0, ["historical"], 2);
    const ratio = (richnessExponent: number) =>
      scorePlace(rich, 0, interests, { richnessExponent }) /
      scorePlace(modest, 0, interests, { richnessExponent });
    expect(ratio(RICHNESS_EXPONENT.first_time)).toBeCloseTo(3 ** 1.5, 6);
    expect(ratio(RICHNESS_EXPONENT.local)).toBeCloseTo(Math.sqrt(3), 6);
  });

  it("values a place by what is left to tell there", () => {
    const p = { ...place("p", 0, 0, ["historical"]), richness: 4 };
    const score = (told: number) =>
      scorePlace(p, 0, interests, { heard: new Map(told ? [["p", told]] : []) });
    const half = HEARD_FLOOR + (PARTLY_HEARD_CEILING - HEARD_FLOOR) / 2;
    expect(score(1)).toBeLessThanOrEqual(score(0) * PARTLY_HEARD_CEILING);
    expect(score(2)).toBeCloseTo(score(0) * half, 6);
    expect(score(3)).toBeLessThan(score(2));
    expect(score(4)).toBeCloseTo(score(0) * HEARD_FLOOR, 6);
    expect(score(9)).toBeCloseTo(score(0) * HEARD_FLOOR, 6);
  });

  it("avoids a heard place for a new one, even one half as rich", () => {
    const rich = { ...place("r", 0, 0, ["historical"], 4), richness: 20 };
    const modest = { ...place("m", 0, 0, ["historical"], 2), richness: 2 };
    const heard = new Map([["r", 1]]);
    expect(scorePlace(modest, 0, interests, { heard })).toBeGreaterThan(
      scorePlace(rich, 0, interests, { heard }),
    );
    // Told in full, it loses even to a far, plain place outside the interests.
    const toldAll = new Map([["r", 20]]);
    expect(scorePlace(rich, 0, interests, { heard: toldAll })).toBeLessThan(
      scorePlace({ ...place("o", 0, 0, ["cultural"], 1), richness: 1 }, 140, interests),
    );
  });

  it("halves the value at the edge of visibility", () => {
    const p = place("p", 0, 0, ["historical"]);
    expect(scorePlace(p, 150, interests)).toBeCloseTo(scorePlace(p, 0, interests) / 2, 6);
  });

  it("scales a matching place with its weight", () => {
    expect(scorePlace(place("p", 0, 0, ["historical"], 3), 0, interests)).toBe(3);
  });
});

describe("weightFromRichness", () => {
  it("is 1 for an empty place and grows slower than richness", () => {
    expect(weightFromRichness(0)).toBe(1);
    expect(weightFromRichness(3)).toBe(3);
    expect(weightFromRichness(49)).toBeLessThan(8);
  });
});

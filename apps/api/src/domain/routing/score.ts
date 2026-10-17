import type { Familiarity } from "@sawa/shared";
import { VISIBLE_RADIUS_M } from "./place-hits";
import type { PlacePoint } from "./types";

/**
 * How much richness counts (exponent on the weight): first-timers get the places with the
 * most to tell, locals get lesser-known ones a fairer chance.
 */
export const RICHNESS_EXPONENT: Record<Familiarity, number> = {
  first_time: 1.5,
  know_a_bit: 1,
  local: 0.5,
};

export type ScorePrefs = {
  richnessExponent?: number;
  /** Place id → facts the listener already heard there (`PlanRouteRequest.heard`). */
  heard?: ReadonlyMap<string, number>;
};

/**
 * Value left in a place told in full: almost none, so a ride takes any other place it can.
 * Not zero, so a ride with nothing else around can still pass it.
 */
export const HEARD_FLOOR = 0.02;
/**
 * Most a partly told place is worth: well below a new one, so a place the listener already
 * heard about gives way to one they have not, falling to `HEARD_FLOOR` as less is left.
 */
export const PARTLY_HEARD_CEILING = 0.35;

/**
 * 1 for a new place; a heard one is avoided whenever there is another: at most
 * `PARTLY_HEARD_CEILING`, falling with what was told there, `HEARD_FLOOR` when nothing is left.
 */
export function noveltyOf(place: PlacePoint, heard: ReadonlyMap<string, number> | undefined) {
  const told = heard?.get(place.id) ?? 0;
  if (told === 0) return 1;
  const total = Math.max(place.richness ?? told, 1);
  const left = Math.max(0, total - told) / total;
  return HEARD_FLOOR + (PARTLY_HEARD_CEILING - HEARD_FLOOR) * left;
}

/** Extra value for each matching interest beyond the first. */
const EXTRA_MATCH_BONUS = 0.5;
/**
 * Value of a place that matches none of the chosen interests. Low enough that a rich
 * non-matching place (weight ~6) loses to a modest matching one (weight ~2).
 */
const NON_MATCH_FACTOR = 0.2;

/**
 * Value of passing a place: matching the chosen interests matters most,
 * then richness; places farther from the line count less (half at the edge of visibility),
 * and so do places where the listener heard most of what Sawa knows.
 */
export function scorePlace(
  place: PlacePoint,
  distanceM: number,
  interests: ReadonlySet<string>,
  prefs: ScorePrefs = {},
): number {
  const matches = place.interests.filter((i) => interests.has(i)).length;
  const relevance = matches > 0 ? 1 + EXTRA_MATCH_BONUS * (matches - 1) : NON_MATCH_FACTOR;
  const proximity = 1 - Math.min(distanceM, VISIBLE_RADIUS_M) / (2 * VISIBLE_RADIUS_M);
  const novelty = noveltyOf(place, prefs.heard);
  return place.weight ** (prefs.richnessExponent ?? 1) * relevance * proximity * novelty;
}

/** Richness (facts + trivia) to a weight with diminishing returns. */
export function weightFromRichness(richness: number): number {
  return 1 + Math.log2(1 + Math.max(0, richness));
}

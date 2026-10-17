/**
 * Developer and catalogue data no listener cares about: office space, parking places, investment
 * stages, neighbouring numbers, map metadata. A line made of it is not told at all; when nothing
 * else is left, Sawa stays quiet (Story.silent).
 *
 * Each pattern counts once per line. Strong patterns are never a story; weak ones (floors, firms)
 * may sit in a story, so a line goes only when they pile up.
 */
const STRONG: readonly RegExp[] = [
  /\bm²|\bm2\b|\bm³|metr\p{L}* kwadratow|tys\.\s*m\b/iu,
  /miejsc\p{L}* parkingow|parking\p{L}* podziemn|garaż/iu,
  /powierzchni\p{L}* (najmu|biurow|użytkow|handlow|sprzedażow|całkowit|wynajm|netto|brutto)/iu,
  /\b(I|II|III|pierwsz\p{L}*|drug\p{L}*|trzec\p{L}*) etap\p{L}*|etap\p{L}* (inwestycji|budowy|realizacji)/iu,
  /komercjaliz|\bnajem\b|\bnajmu\b|na wynajem|najemc/iu,
  /\bw OSM\b|OpenStreetMap|building=|\bGUGiK\b|\btag\p{L}* \p{L}+=|Google (Maps|Places)/iu,
  /punkt\p{L}* usługow|lokal\p{L}* usługow|usługowo-handlow/iu,
  /pod (adresami|numerami) \d|\bnumer\p{L}* \d+ i \d+/iu,
  /kubatur/iu,
  /godzin\p{L}* otwarcia|\b\d{1,2}:\d{2}\b|otwart\p{L}* dla mieszkańców/iu,
  /\bnr \d+\/\d+/u,
];

const WEAK: readonly RegExp[] = [
  /kondygnac/iu,
  /nadziemn|naziemn|podziemn/iu,
  /pracowni\p{L}*|biur\p{L}* (projektow|architekt)|\barchitekci\b/iu,
  /wykonawc/iu,
  /\bS\.\s?A\.|\bSA\b|\b[Ss]p\. z o\.\s?o\./u,
  /\bspółk\p{L}*|\bfirm\p{L}*|\b(Development|Holding|Group|Property|Properties)\b/u,
  /deweloper|inwestycj/iu,
  /kosztował|\bkoszt\p{L}*|\bmln\b|\bmld\b/iu,
  /\bwind[ayo]?\b|open space/iu,
  /wielorodzinn|mieszkaln\p{L}* i usługow/iu,
];

/**
 * Lines that tell a story despite the numbers: something old (a year before 1990, a century),
 * war, a legend, a find. "W 1944 r. … etapową odbudowę" stays, "I etap dostarczy 86 miejsc" goes.
 */
const STORY_SIGNAL =
  /\b(1[0-8]\d\d|19[0-8]\d)\b|\b(X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX)\b|wiek|wojn|powstani|powstań|getto|okupac|Niemc|legend|podobno|zabytkow|odkryto|mieszkał/iu;

/** A longer line carries more than its numbers, so it takes more dry hits to drop it. */
const LONG_LINE_WORDS = 35;

const hits = (text: string, patterns: readonly RegExp[]) =>
  patterns.filter((p) => p.test(text)).length;

/** True when the line is only developer, catalogue or map data. */
export function isDryFact(text: string): boolean {
  if (STORY_SIGNAL.test(text)) return false;
  const score = hits(text, STRONG) * 2 + hits(text, WEAK);
  const words = text.split(/\s+/).filter(Boolean).length;
  return score >= (words >= LONG_LINE_WORDS ? 4 : 2);
}

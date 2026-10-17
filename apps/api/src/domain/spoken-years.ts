/**
 * Years and days of the month written as digits, spelled out for TTS. The story shows
 * "w 1648 roku" on screen, and ElevenLabs reads digits badly in Polish, so the voice gets
 * "w tysiąc sześćset czterdziestym ósmym roku". Other numbers are spelled in spoken-numbers.ts.
 */

export type Case = "nom" | "gen" | "loc" | "ins";

const UNITS = [
  "",
  "pierwszy",
  "drugi",
  "trzeci",
  "czwarty",
  "piąty",
  "szósty",
  "siódmy",
  "ósmy",
  "dziewiąty",
];
const TEENS = [
  "dziesiąty",
  "jedenasty",
  "dwunasty",
  "trzynasty",
  "czternasty",
  "piętnasty",
  "szesnasty",
  "siedemnasty",
  "osiemnasty",
  "dziewiętnasty",
];
const TENS = [
  "",
  "",
  "dwudziesty",
  "trzydziesty",
  "czterdziesty",
  "pięćdziesiąty",
  "sześćdziesiąty",
  "siedemdziesiąty",
  "osiemdziesiąty",
  "dziewięćdziesiąty",
];
const HUNDREDS = [
  "",
  "sto",
  "dwieście",
  "trzysta",
  "czterysta",
  "pięćset",
  "sześćset",
  "siedemset",
  "osiemset",
  "dziewięćset",
];
const HUNDREDTHS = [
  "",
  "setny",
  "dwusetny",
  "trzechsetny",
  "czterechsetny",
  "pięćsetny",
  "sześćsetny",
  "siedemsetny",
  "osiemsetny",
  "dziewięćsetny",
];
const THOUSANDS = ["", "tysiąc", "dwa tysiące"];
const THOUSANDTHS = ["", "tysięczny", "dwutysięczny"];

/** "drugi" → "drugiego", "ósmy" → "ósmym": only the ordinal words take the case. */
function inflect(word: string, c: Case): string {
  if (c === "nom") return word;
  if (word.endsWith("i")) return c === "gen" ? `${word}ego` : `${word}m`;
  const stem = word.slice(0, -1);
  return c === "gen" ? `${stem}ego` : `${stem}ym`;
}

/** Ordinal 1–2099 in Polish: thousands and hundreds stay cardinal, the last part is ordinal. */
export function ordinalPl(n: number, c: Case = "nom"): string {
  const th = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  const t = Math.floor(rest / 10);
  const u = rest % 10;

  const ordinals: string[] = [];
  const cardinals: string[] = [];
  if (rest === 0 && h === 0) ordinals.push(THOUSANDTHS[th] ?? "");
  else {
    if (th) cardinals.push(THOUSANDS[th] ?? "");
    if (rest === 0) ordinals.push(HUNDREDTHS[h] ?? "");
    else {
      if (h) cardinals.push(HUNDREDS[h] ?? "");
      if (t === 1) ordinals.push(TEENS[u] ?? "");
      else {
        if (t) ordinals.push(TENS[t] ?? "");
        if (u) ordinals.push(UNITS[u] ?? "");
      }
    }
  }
  return [...cardinals, ...ordinals.map((w) => inflect(w, c))].join(" ");
}

export const MONTHS =
  "stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia";

/** The form of "rok" after the year decides the case; without it, the preposition before. */
export function yearCase(prep: string | undefined, rok: string | undefined): Case {
  const p = prep?.toLowerCase();
  const locative = p === "w" || p === "we" || p === "o" || p === "po" || p === "przy";
  if (rok === "rokiem") return "ins";
  if (rok === "rok") return "nom";
  if (rok === "roku") return locative ? "loc" : "gen";
  if (locative) return "loc";
  if (p && ["od", "do", "z", "ze", "sprzed", "około", "koło", "spod"].includes(p)) return "gen";
  if (p && ["przed", "za", "nad", "pod", "między"].includes(p)) return "ins";
  return "nom";
}

/** After these words a number is a house, line or count, never a year. */
const NOT_YEAR_BEFORE = /^(?:numer|numeru|numerem|numerze|numery|numerami|nr|linia|linii|linią)$/i;

/** After the number: a unit or a counted noun ("1500 osób"), so it is an amount, not a year. */
const COUNTED_AFTER =
  /^(?:\s?(?:%|m²|m2|km²|km2|km|m|ha|zł|tys\.|mln|mld)(?![\p{L}\p{N}])|\s(?:metr|kilometr|centymetr|hektar|osób|osoby|ludzi|lat\b|miejsc|mieszka|złot|ton\b|kilogram|egzemplarz|książ|drzew|żołnierz|pracownik|uczni|dzieci|samochod|tramwaj|autobus|budyn|domów|okien|stopni|krzes|procent|wiern|widz|kibic|gości|zwiedzaj|pasażer|rodzin|cegieł|kroków|schodów|pięter|ofiar|zabitych|więźniów|żydów|tysi|milion|miliard))/iu;

/**
 * Spells out "13 lipca" and years: four digits (1000–2099) unless a unit or a counted noun
 * follows, three digits only with the word „rok” after them. Any other digits are left alone.
 */
export function spellYears(text: string): string {
  return text
    .replace(new RegExp(`\\b(\\d{1,2}) (${MONTHS})\\b`, "g"), (all, d: string, month: string) => {
      const day = Number(d);
      return day >= 1 && day <= 31 ? `${ordinalPl(day, "gen")} ${month}` : all;
    })
    .replace(
      /(?:(?<!\p{L})(\p{L}+) )?(?<!\p{N}[,.])\b(\d{3,4})\b(?=(?: (rok|roku|rokiem)\b)?)/gu,
      (
        all: string,
        prep: string | undefined,
        y: string,
        rok: string | undefined,
        offset: number,
        whole: string,
      ) => {
        const year = Number(y);
        if (year < 100 || year > 2099) return all;
        if (!rok) {
          if (y.length < 4 || year < 1000) return all;
          if (prep && NOT_YEAR_BEFORE.test(prep)) return all;
          if (COUNTED_AFTER.test(whole.slice(offset + all.length))) return all;
        }
        const spoken = ordinalPl(year, yearCase(prep, rok));
        return prep ? `${prep} ${spoken}` : spoken;
      },
    );
}

/**
 * Numbers written as digits, spelled out in Polish for TTS. The screen shows what the model
 * wrote ("Solidarności 171", "70 000 metrów kwadratowych", "w XIX wieku"), and the voice gets
 * words, because ElevenLabs reads Polish digits badly. Pure and deterministic: the same text
 * always gives the same words, and the punctuation around a number stays where it was.
 *
 * Order: abbreviations, ranges, Roman numerals, hours, then years and dates (spoken-years.ts),
 * then every other number. Case: the genitive after a few prepositions („od”, „do”, „około”…),
 * otherwise the nominative.
 */

import { type Case, MONTHS, ordinalPl, spellYears, yearCase } from "./spoken-years";

const ONES = [
  "zero",
  "jeden",
  "dwa",
  "trzy",
  "cztery",
  "pięć",
  "sześć",
  "siedem",
  "osiem",
  "dziewięć",
];
const TEENS = [
  "dziesięć",
  "jedenaście",
  "dwanaście",
  "trzynaście",
  "czternaście",
  "piętnaście",
  "szesnaście",
  "siedemnaście",
  "osiemnaście",
  "dziewiętnaście",
];
const TENS = [
  "",
  "",
  "dwadzieścia",
  "trzydzieści",
  "czterdzieści",
  "pięćdziesiąt",
  "sześćdziesiąt",
  "siedemdziesiąt",
  "osiemdziesiąt",
  "dziewięćdziesiąt",
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

/** [1, 2–4, 5+, fraction or genitive singular]: "tysiąc", "tysiące", "tysięcy", "tysiąca". */
type Forms = readonly [string, string, string, string];

const SCALES: readonly (Forms | null)[] = [
  null,
  ["tysiąc", "tysiące", "tysięcy", "tysiąca"],
  ["milion", "miliony", "milionów", "miliona"],
  ["miliard", "miliardy", "miliardów", "miliarda"],
];

const GENITIVE: Record<string, string> = {
  zero: "zera",
  dwa: "dwóch",
  dwie: "dwóch",
  trzy: "trzech",
  cztery: "czterech",
  pięć: "pięciu",
  sześć: "sześciu",
  siedem: "siedmiu",
  osiem: "ośmiu",
  dziewięć: "dziewięciu",
  dziesięć: "dziesięciu",
  jedenaście: "jedenastu",
  dwanaście: "dwunastu",
  trzynaście: "trzynastu",
  czternaście: "czternastu",
  piętnaście: "piętnastu",
  szesnaście: "szesnastu",
  siedemnaście: "siedemnastu",
  osiemnaście: "osiemnastu",
  dziewiętnaście: "dziewiętnastu",
  dwadzieścia: "dwudziestu",
  trzydzieści: "trzydziestu",
  czterdzieści: "czterdziestu",
  pięćdziesiąt: "pięćdziesięciu",
  sześćdziesiąt: "sześćdziesięciu",
  siedemdziesiąt: "siedemdziesięciu",
  osiemdziesiąt: "osiemdziesięciu",
  dziewięćdziesiąt: "dziewięćdziesięciu",
  sto: "stu",
  dwieście: "dwustu",
  trzysta: "trzystu",
  czterysta: "czterystu",
  pięćset: "pięciuset",
  sześćset: "sześciuset",
  siedemset: "siedmiuset",
  osiemset: "ośmiuset",
  dziewięćset: "dziewięciuset",
  tysiąc: "tysiąca",
  tysiące: "tysięcy",
  milion: "miliona",
  miliony: "milionów",
  miliard: "miliarda",
  miliardy: "miliardów",
};

export type NumberCase = "nom" | "gen";

/** 2, 3, 4, 22, 23… take "tysiące", "metry"; 12–14 and the rest take "tysięcy", "metrów". */
function isFew(n: number): boolean {
  const u = n % 10;
  const t = n % 100;
  return u >= 2 && u <= 4 && (t < 12 || t > 14);
}

/** The noun after a number: "1 metr", "2 metry", "5 metrów", "1,5 metra", "od 5 metrów". */
function countForm(forms: Forms, n: number, fraction: boolean, c: NumberCase): string {
  if (fraction) return forms[3];
  if (c === "gen") return n === 1 ? forms[3] : forms[2];
  if (n === 1) return forms[0];
  return isFew(n) ? forms[1] : forms[2];
}

function under1000(n: number): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) words.push(HUNDREDS[h] ?? "");
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10] ?? "");
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t) words.push(TENS[t] ?? "");
    if (u) words.push(ONES[u] ?? "");
  }
  return words;
}

/**
 * Cardinal number 0–999 999 999 999 in Polish. `feminine` gives "jedna", "dwie" ("dwie
 * kamienice"), `case: "gen"` the genitive ("od dwunastu tysięcy trzystu").
 */
export function cardinalPl(
  n: number,
  opts: { case?: NumberCase; feminine?: boolean } = {},
): string {
  const c = opts.case ?? "nom";
  if (n === 0) return c === "gen" ? "zera" : "zero";
  if (n === 1) {
    if (c === "gen") return opts.feminine ? "jednej" : "jednego";
    return opts.feminine ? "jedna" : "jeden";
  }
  const words: string[] = [];
  for (let scale = SCALES.length - 1; scale >= 0; scale--) {
    const g = Math.floor(n / 1000 ** scale) % 1000;
    if (!g) continue;
    const forms = SCALES[scale];
    if (!forms) {
      words.push(...under1000(g));
      continue;
    }
    if (g !== 1) words.push(...under1000(g));
    words.push(g === 1 ? forms[0] : isFew(g) ? forms[1] : forms[2]);
  }
  if (opts.feminine && words[words.length - 1] === "dwa") words[words.length - 1] = "dwie";
  return (c === "gen" ? words.map((w) => GENITIVE[w] ?? w) : words).join(" ");
}

/** "1,5" → "półtora", "2,5" → "dwa i pół", "3,14" → "trzy przecinek czternaście". */
export function decimalPl(n: number, fraction: string, c: NumberCase = "nom"): string {
  const digits = fraction.replace(/0+$/, "");
  if (!digits) return cardinalPl(n, { case: c });
  if (digits === "5") {
    if (n === 0) return "pół";
    if (n === 1) return "półtora";
    return `${cardinalPl(n, { case: c })} i pół`;
  }
  const zeros = /^0*/.exec(digits)?.[0].length ?? 0;
  const after = [...Array<string>(zeros).fill("zero")];
  if (zeros < digits.length) after.push(cardinalPl(Number(digits.slice(zeros))));
  return `${cardinalPl(n, { case: c })} przecinek ${after.join(" ")}`;
}

/** Units and abbreviations the model or the facts may write after a number. */
const UNITS: Record<string, Forms> = {
  "%": ["procent", "procent", "procent", "procent"],
  m: ["metr", "metry", "metrów", "metra"],
  "m²": ["metr kwadratowy", "metry kwadratowe", "metrów kwadratowych", "metra kwadratowego"],
  m2: ["metr kwadratowy", "metry kwadratowe", "metrów kwadratowych", "metra kwadratowego"],
  km: ["kilometr", "kilometry", "kilometrów", "kilometra"],
  "km²": [
    "kilometr kwadratowy",
    "kilometry kwadratowe",
    "kilometrów kwadratowych",
    "kilometra kwadratowego",
  ],
  km2: [
    "kilometr kwadratowy",
    "kilometry kwadratowe",
    "kilometrów kwadratowych",
    "kilometra kwadratowego",
  ],
  ha: ["hektar", "hektary", "hektarów", "hektara"],
  zł: ["złoty", "złote", "złotych", "złotego"],
  "tys.": ["tysiąc", "tysiące", "tysięcy", "tysiąca"],
  mln: ["milion", "miliony", "milionów", "miliona"],
  mld: ["miliard", "miliardy", "miliardów", "miliarda"],
};
const SCALE_UNITS = new Set(["tys.", "mln", "mld"]);

/** After these the number is in the genitive: "od 5 do 10 metrów", "około 100 osób". */
const GENITIVE_PREPS = new Set([
  "od",
  "do",
  "z",
  "ze",
  "około",
  "koło",
  "blisko",
  "sprzed",
  "spod",
  "bez",
  "dla",
  "u",
  "wśród",
  "spośród",
  "oprócz",
]);

/** Feminine nouns that often follow a small number: "dwie kamienice", "jedna osoba". */
const FEMININE_NOUN =
  /^(?:osob|kamienic|wież|ulic|lini[ia]|stron|kondygnacj|sal[eiaą]?$|częś|wojn|kobiet|siostr|córk|rodzin|szkoł|bram|ścian|fontann|rzeźb|figur|kaplic|cerkw|synagog|hal[eiaą]?$|stacj|godzin|minut|sekund|naw[yaą]?$|kolumn|kopuł|rzek|dzielnic|epok|armat|bomb|klatk|latarn|ławk|książk|tablic|płyt|wiosk|studni|kaplic|bazylik|katedr|kawiarni|restauracj|fabryk|kamieniczk|willi|will[aęą]|wojn)/i;

/** An abbreviation with a dot ends the sentence when a capital letter or nothing follows. */
function keepsDot(rest: string): boolean {
  return /^(?:\s+\p{Lu}|\s*$)/u.test(rest);
}

/** Roman numerals I–XXXIX, strictly formed, or null. */
export function romanToInt(roman: string): number | null {
  const m = /^(X{0,3})(IX|IV|V?I{0,3})$/.exec(roman);
  if (!m || !roman) return null;
  const tens = (m[1] ?? "").length * 10;
  const units: Record<string, number> = {
    "": 0,
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
  };
  return tens + (units[m[2] ?? ""] ?? 0);
}

type FemCase = "nom" | "obl" | "ins";

/** Feminine ordinal: "druga", "o trzynastej", "przed drugą" ("obl" is gen/dat/loc, "ins" acc/ins). */
function femOrdinal(n: number, c: FemCase): string {
  if (n === 0) return "zero";
  return ordinalPl(n)
    .split(" ")
    .map((w, i, all) => {
      if (i < all.length - 1 && !/[yi]$/.test(w)) return w;
      if (w.endsWith("y")) {
        const stem = w.slice(0, -1);
        return c === "nom" ? `${stem}a` : c === "obl" ? `${stem}ej` : `${stem}ą`;
      }
      if (/[kg]i$/.test(w)) {
        const stem = w.slice(0, -1);
        return c === "nom" ? `${stem}a` : c === "obl" ? `${stem}iej` : `${stem}ą`;
      }
      return c === "nom" ? `${w}a` : c === "obl" ? `${w}ej` : `${w}ą`;
    })
    .join(" ");
}

const WIEK_AS_ROK: Record<string, string> = {
  wiek: "rok",
  wieku: "roku",
  wiekiem: "rokiem",
  wieki: "rok",
  wieków: "roku",
  wiekach: "roku",
};

/** "w XIX wieku", "na przełomie XIX i XX wieku", "XVII–XVIII wiek". */
function spellCenturies(text: string): string {
  return text.replace(
    /(?:(?<!\p{L})(\p{L}+) )?(?<!\p{L})([IVX]{1,6})(?:( i | lub | albo | a | oraz | do | ?[–—] ?|-)([IVX]{1,6}))? (wiek|wieku|wiekiem|wieki|wieków|wiekach)(?!\p{L})/gu,
    (
      all: string,
      prep: string | undefined,
      a: string,
      join: string | undefined,
      b: string | undefined,
      wiek: string,
    ) => {
      const first = romanToInt(a);
      const second = b === undefined ? null : romanToInt(b);
      if (!first || (b !== undefined && !second)) return all;
      const c = yearCase(prep, WIEK_AS_ROK[wiek]);
      let spoken = ordinalPl(first, c);
      if (join !== undefined && second) {
        const range = !/^ (?:i|lub|albo|a|oraz) $/.test(join);
        spoken += `${range ? " do " : join}${ordinalPl(second, range ? "gen" : c)}`;
      }
      return `${prep ? `${prep} ` : ""}${spoken} ${wiek}`;
    },
  );
}

/** "II wojna światowa", "po II wojnie", "II Rzeczpospolitej": feminine, case from the noun. */
function spellFeminineRomans(text: string): string {
  return text.replace(
    /(?<!\p{L})([IVX]{1,6}) (wojn\p{L}*|Rzeczpospolit\p{L}*|Rzesz\p{L}*)/gu,
    (all: string, roman: string, noun: string) => {
      const n = romanToInt(roman);
      if (!n) return all;
      const c: FemCase = /a$/.test(noun) ? "nom" : /[ęą]$/.test(noun) ? "ins" : "obl";
      return `${femOrdinal(n, c)} ${noun}`;
    },
  );
}

/** "Zygmunta III Wazy", "Jan III Sobieski": a Roman numeral after a name, masculine. */
function spellRulers(text: string): string {
  return text.replace(
    /(?<!\p{L})(\p{Lu}\p{Ll}+) ([IVX]{1,6})(?!\p{L})(?=( \p{L}+)?)/gu,
    (all: string, name: string, roman: string, next: string | undefined) => {
      const n = romanToInt(roman);
      if (!n) return all;
      const after = next?.trim() ?? "";
      let c: Case = "nom";
      if (/ego$/.test(after) || /a$/.test(name)) c = "gen";
      else if (/[iy]m$/.test(after) || /(?:em|ie|u)$/.test(name)) c = "loc";
      return `${name} ${ordinalPl(n, c)}`;
    },
  );
}

/** "o 13:30" → "o trzynastej trzydzieści", "13:05" → "trzynasta zero pięć". */
function spellHours(text: string): string {
  return text.replace(
    /(?:(?<!\p{L})(\p{L}+) )?(?<![\p{N}:])([01]?\d|2[0-3]):([0-5]\d)(?![\p{N}:])/gu,
    (_all: string, prep: string | undefined, h: string, m: string) => {
      const p = prep?.toLowerCase();
      const c: FemCase =
        p && ["o", "po", "od", "do", "około", "koło", "przy"].includes(p)
          ? "obl"
          : p && ["przed", "między", "nad"].includes(p)
            ? "ins"
            : "nom";
      const minutes = Number(m);
      const said = [femOrdinal(Number(h), c)];
      if (minutes > 0 && minutes < 10) said.push(`zero ${ONES[minutes]}`);
      else if (minutes >= 10) said.push(cardinalPl(minutes));
      return `${prep ? `${prep} ` : ""}${said.join(" ")}`;
    },
  );
}

/** "w 1944 r." → "w 1944 roku", "ok. 100" → "około 100", "nr 5" → "numer 5", "XIX w." → "XIX wieku". */
function expandAbbreviations(text: string): string {
  return text
    .replace(/(?<!\p{L})([Oo])k\.(?=\s*\d|\s*$)/gu, "$1koło")
    .replace(/(?<!\p{L})nr\.? ?(?=\d)/gu, "numer ")
    .replace(/(?<![\p{N}])(\d{3,4}) r\.(?!\p{L})/gu, (_all, y: string, offset: number, whole) =>
      keepsDot(whole.slice(offset + _all.length)) ? `${y} roku.` : `${y} roku`,
    )
    .replace(/(?<!\p{L})([IVX]{1,6}) w\.(?!\p{L})/gu, (_all, r: string, offset: number, whole) =>
      keepsDot(whole.slice(offset + _all.length)) ? `${r} wieku.` : `${r} wieku`,
    );
}

/** "13–15 lipca" → ordinals; "1648–1650", "5-10" → "1648 do 1650", "5 do 10". */
function spellRanges(text: string): string {
  return text
    .replace(
      new RegExp(`(?<!\\p{N})(\\d{1,2}) ?[–—-] ?(\\d{1,2}) (${MONTHS})(?!\\p{L})`, "gu"),
      (all, a: string, b: string, month: string) => {
        const from = Number(a);
        const to = Number(b);
        if (from < 1 || from > 31 || to < 1 || to > 31) return all;
        return `${ordinalPl(from, "gen")} do ${ordinalPl(to, "gen")} ${month}`;
      },
    )
    .replace(/(?<![\p{N},.])(\d+)(?:-| ?[–—] ?)(?=\d)/gu, "$1 do ");
}

const NUMBER =
  /(?:(?<![\p{L}\p{N}])(\p{L}+) )?(?<![\p{L}\p{N},.])(\d{1,3}(?:[   ]\d{3})+(?!\p{N})|\d{1,3}(?:\.\d{3})+(?!\p{N})|\d+)(?:,(\d+))?(?:[  ]?(%|m²|m2|km²|km2|km|ha|zł|tys\.|mln|mld|m)(?![\p{L}\p{N}])|([a-h])(?![\p{L}\p{N}]))?(?!\p{N})/gu;

/** Every number left in digits: cardinals, thousands with separators, decimals, units. */
function spellCardinals(text: string): string {
  return text.replace(
    NUMBER,
    (
      all: string,
      prep: string | undefined,
      int: string,
      frac: string | undefined,
      unit: string | undefined,
      letter: string | undefined,
      offset: number,
      whole: string,
    ) => {
      const n = Number(int.replace(/[ .  ]/g, ""));
      if (!Number.isSafeInteger(n) || n >= 1e12) return all;
      const c: NumberCase = prep && GENITIVE_PREPS.has(prep.toLowerCase()) ? "gen" : "nom";
      const rest = whole.slice(offset + all.length);
      const fraction = (frac ?? "").replace(/0+$/, "");
      const forms = unit === undefined ? undefined : UNITS[unit];

      let spoken: string;
      if (fraction) spoken = decimalPl(n, fraction, c);
      else if (forms && unit && SCALE_UNITS.has(unit) && n === 1) spoken = "";
      else {
        const next = /^\s(\p{L}+)/u.exec(rest)?.[1] ?? "";
        const feminine = !forms && !letter && FEMININE_NOUN.test(next);
        spoken = cardinalPl(n, { case: c, feminine });
      }
      if (forms && unit) {
        const noun = countForm(forms, n, Boolean(fraction), c);
        spoken = `${spoken} ${noun}`.trim();
        if (unit.endsWith(".") && keepsDot(rest)) spoken += ".";
      }
      if (letter) spoken += ` ${letter}`;
      return prep ? `${prep} ${spoken}` : spoken;
    },
  );
}

/** All digits in `text` as Polish words for TTS; everything else is left as it is. */
export function spellNumbers(text: string): string {
  let out = expandAbbreviations(text);
  out = spellRanges(out);
  out = spellCenturies(out);
  out = spellFeminineRomans(out);
  out = spellRulers(out);
  out = spellHours(out);
  out = spellYears(out);
  return spellCardinals(out);
}

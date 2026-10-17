/**
 * When each word on screen is said. The screen shows the model's text ("w 1867 roku"), the voice
 * reads the text for TTS ("w tysiąc osiemset sześćdziesiątym siódmym roku"), and ElevenLabs
 * says when each character of the latter starts. These functions carry those times over to the
 * words on screen.
 */

/** A word of the text the voice read, with when it starts (seconds from the start of its clip). */
export type SpokenWord = { word: string; start: number };

/** Character times as ElevenLabs gives them, made relative to the start of one clip. */
export type CharTimes = { chars: string[]; starts: number[] };

/** Words of the text the voice read: a word starts on its first non-space character. */
export function spokenWords({ chars, starts }: CharTimes): SpokenWord[] {
  const words: SpokenWord[] = [];
  let word = "";
  let start = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? "";
    if (/^\s*$/.test(ch)) {
      if (word) words.push({ word, start });
      word = "";
      continue;
    }
    if (!word) start = starts[i] ?? start;
    word += ch;
  }
  if (word) words.push({ word, start });
  return words;
}

/** Same word on screen and in the voice: case and punctuation do not count. */
function key(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** A number spelled out takes a few words ("dwa tysiące trzysta czterdzieści pięć"). */
const LOOKAHEAD = 10;

/** The voice rarely adds words of its own; a longer look would catch a common word by chance. */
const INSERTED = 3;

function find(
  spoken: readonly SpokenWord[],
  word: string | undefined,
  from: number,
  within = LOOKAHEAD,
): number {
  if (word === undefined) return -1;
  const k = key(word);
  for (let j = from; j < Math.min(spoken.length, from + within + 1); j++) {
    if (key((spoken[j] as SpokenWord).word) === k) return j;
  }
  return -1;
}

/**
 * Start time of each word of `display` (split on whitespace) from the words the voice said.
 * Equal words go one to one; a word that the voice said differently (a number in digits, said
 * as several words) starts on the first of them and eats them up to the next equal word.
 * Never decreasing; words past the end of the voice get its last time.
 */
export function alignWordTimes(display: string, spoken: readonly SpokenWord[]): number[] {
  const words = display.split(/\s+/).filter(Boolean);
  const times: number[] = [];
  let j = 0;
  let last = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as string;
    const here = spoken[j];
    if (!here) {
      times.push(last);
      continue;
    }
    if (key(here.word) === key(word)) {
      j += 1;
    } else {
      const ahead = /\p{N}/u.test(word) ? -1 : find(spoken, word, j + 1, INSERTED);
      if (ahead >= 0) {
        // The voice said a word or two more before this one.
        last = Math.max(last, (spoken[ahead] as SpokenWord).start);
        times.push(last);
        j = ahead + 1;
        continue;
      }
      // Said differently: up to the next word that matches (at `j` itself when it was skipped).
      const next = find(spoken, words[i + 1], j);
      j = next >= 0 ? next : j + 1;
    }
    last = Math.max(last, here.start);
    times.push(last);
  }
  return times;
}

/**
 * Words of a clip spread over its length by their characters, when the voice gave no times
 * (the plain stream, a clip without alignment).
 */
export function estimateWordTimes(display: string, durationSec: number): number[] {
  const words = display.split(/\s+/).filter(Boolean);
  const total = words.reduce((n, w) => n + w.length + 1, 0);
  const times: number[] = [];
  let at = 0;
  for (const w of words) {
    times.push(total ? (at / total) * durationSec : 0);
    at += w.length + 1;
  }
  return times;
}

const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

/**
 * How long an mp3 (MPEG layer III) plays, counted from its frames: the browser plays the
 * clips of a story back to back, so this is where the next clip starts. Null when no frame
 * is found (not an mp3).
 */
export function mp3DurationSec(bytes: Uint8Array): number | null {
  let pos = 0;
  // ID3v2 tag before the first frame.
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes.length >= 10) {
    const size =
      ((bytes[6] ?? 0) << 21) | ((bytes[7] ?? 0) << 14) | ((bytes[8] ?? 0) << 7) | (bytes[9] ?? 0);
    pos = 10 + size + ((bytes[5] ?? 0) & 0x10 ? 10 : 0);
  }
  let seconds = 0;
  let frames = 0;
  while (pos + 4 <= bytes.length) {
    const b1 = bytes[pos + 1] as number;
    const b2 = bytes[pos + 2] as number;
    const version = (b1 >> 3) & 0x3; // 3: MPEG1, 2: MPEG2, 0: MPEG2.5
    const layer = (b1 >> 1) & 0x3; // 1: layer III
    const bitrateIndex = (b2 >> 4) & 0xf;
    const rateIndex = (b2 >> 2) & 0x3;
    const valid =
      bytes[pos] === 0xff &&
      (b1 & 0xe0) === 0xe0 &&
      version !== 1 &&
      layer === 1 &&
      bitrateIndex !== 0 &&
      bitrateIndex !== 15 &&
      rateIndex !== 3;
    if (!valid) {
      pos += 1;
      continue;
    }
    const v1 = version === 3;
    const kbps = (v1 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex] as number;
    const rate = (RATES[version] as number[])[rateIndex] as number;
    const padding = (b2 >> 1) & 0x1;
    const samples = v1 ? 1152 : 576;
    const length = Math.floor(((v1 ? 144 : 72) * kbps * 1000) / rate) + padding;
    seconds += samples / rate;
    frames += 1;
    pos += length;
  }
  return frames ? seconds : null;
}

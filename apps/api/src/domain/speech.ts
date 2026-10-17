import { spellNumbers } from "./spoken-numbers";
import { cleanForSpeech } from "./story";

/** Synthesized speech ready to send to the client. */
export type SpeechAudio = {
  audio: Uint8Array<ArrayBuffer>;
  contentType: string;
};

/**
 * Text as it goes to TTS and as the cache key: same words with different spacing are one clip.
 * Line breaks become spaces because ElevenLabs reads a newline as a long pause, and numbers in
 * digits (years, house numbers, amounts) become words because it reads digits badly.
 */
export function normalizeSpeechText(text: string): string {
  return spellNumbers(text.replace(/\s+/g, " ").trim());
}

/** The first chunk is short so the voice starts soon; later ones are longer for steadier prosody. */
const FIRST_CHUNK_CHARS = 40;
const NEXT_CHUNK_CHARS = 160;

/**
 * One piece of a story for TTS: `display` as the screen shows it (`cleanForSpeech`, so the
 * pieces' words add up to the story's words), `spoken` as the voice gets it.
 */
export type SpeechChunk = { display: string; spoken: string };

/**
 * Cuts text arriving in pieces into whole sentences for TTS: never mid-sentence, and only once a
 * chunk is long enough. `flush` returns what is left when the text ends.
 */
export function createSentenceChunker() {
  let buffer = "";
  let first = true;
  const clean = (text: string): SpeechChunk | null => {
    const display = cleanForSpeech(text);
    return display ? { display, spoken: normalizeSpeechText(display) } : null;
  };

  return {
    push(text: string): SpeechChunk[] {
      buffer += text;
      const chunks: SpeechChunk[] = [];
      while (true) {
        const min = first ? FIRST_CHUNK_CHARS : NEXT_CHUNK_CHARS;
        const ends = /[.!?…]+["”»]?\s+/g;
        let cut = -1;
        for (let m = ends.exec(buffer); m; m = ends.exec(buffer)) {
          const end = m.index + m[0].length;
          if (end >= min) {
            cut = end;
            break;
          }
        }
        if (cut < 0) break;
        const chunk = clean(buffer.slice(0, cut));
        buffer = buffer.slice(cut);
        if (chunk) chunks.push(chunk);
        first = false;
      }
      return chunks;
    },
    flush(): SpeechChunk | null {
      const rest = clean(buffer);
      buffer = "";
      return rest;
    },
  };
}

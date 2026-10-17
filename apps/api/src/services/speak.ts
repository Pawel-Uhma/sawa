import {
  createSentenceChunker,
  normalizeSpeechText,
  type SpeechAudio,
  type SpeechChunk,
} from "../domain/speech";
import { cleanForSpeech } from "../domain/story";
import {
  alignWordTimes,
  estimateWordTimes,
  mp3DurationSec,
  spokenWords,
} from "../domain/word-times";
import { AppError } from "../lib/errors";
import type { SpeechSynthesizer } from "./ports";

/** Each clip costs credits; the demo replays the same stories, so they are kept in memory. */
const MAX_CACHED_CLIPS = 200;

export type SpeechService = {
  speak(text: string): Promise<SpeechAudio>;
  /**
   * Reads text that is still being written: each sentence goes to TTS as soon as it is whole, and
   * the mp3 comes out as it is made. A text heard before plays from the cache.
   */
  speakStream(text: AsyncIterable<string>, opts?: SpeakStreamOptions): AsyncGenerator<Uint8Array>;
};

export type SpeakStreamOptions = {
  /** The whole text when it is known up front: a story heard before plays from the cache. */
  whole?: string;
  /**
   * Start times (seconds from the start of the clip) of the next words of the text as shown
   * (`cleanForSpeech`, split on whitespace), sentence by sentence as the voice is made. Stops
   * when a sentence cannot be timed, so the times never belong to the wrong words.
   */
  onWords?: (starts: number[]) => void;
};

/** A cached clip; `wordTimes` when every word of it was timed. */
type Clip = SpeechAudio & { wordTimes?: number[] };

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The pieces of one story as one mp3, for the cache. */
function joinAudio(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function createSpeechService(synthesizer: SpeechSynthesizer): SpeechService {
  const cache = new Map<string, Promise<Clip>>();

  function remember(key: string, clip: Promise<Clip>) {
    cache.set(key, clip);
    clip.catch(() => cache.delete(key));
    if (cache.size > MAX_CACHED_CLIPS) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  return {
    async *speakStream(text, opts) {
      // A story told before is a whole clip in the cache.
      const hit =
        opts?.whole === undefined ? undefined : cache.get(normalizeSpeechText(opts.whole));
      if (hit) {
        const clip = await hit;
        const words = opts?.whole === undefined ? 0 : wordCount(cleanForSpeech(opts.whole));
        if (clip.wordTimes?.length === words) opts?.onWords?.(clip.wordTimes);
        yield clip.audio;
        return;
      }
      const stream = synthesizer.stream?.bind(synthesizer);
      let timed = synthesizer.streamWithTimes?.bind(synthesizer);
      const chunker = createSentenceChunker();
      const said: string[] = [];
      const parts: Uint8Array[] = [];
      // Where the next sentence starts in the clip, and every word's time so far.
      let offset = 0;
      let timing = true;
      const wordTimes: number[] = [];

      /** Times of one sentence's words; null when they cannot be placed in the clip. */
      function timeWords(
        chunk: SpeechChunk,
        audio: Uint8Array[],
        chars: string[],
        starts: number[],
      ) {
        const duration = mp3DurationSec(joinAudio(audio));
        const local = chars.length
          ? alignWordTimes(chunk.display, spokenWords({ chars, starts }))
          : duration === null
            ? null
            : estimateWordTimes(chunk.display, duration);
        if (local === null || !timing) {
          timing = false;
          return;
        }
        const times = local.map((t) => t + offset);
        wordTimes.push(...times);
        opts?.onWords?.(times);
        // The browser plays the sentences' mp3 back to back, so the next starts where this ends.
        if (duration === null) timing = false;
        else offset += duration;
      }

      // One request at a time: TTS makes audio faster than it plays, so the next sentence is
      // ready before the listener gets there, and the account's concurrency limit holds.
      async function* say(chunk: SpeechChunk) {
        const previousText = said.join(" ").slice(-500);
        const audio: Uint8Array[] = [];
        const chars: string[] = [];
        const starts: number[] = [];
        let done = false;
        if (timed) {
          try {
            for await (const piece of timed(chunk.spoken, { previousText })) {
              if (piece.times) {
                chars.push(...piece.times.chars);
                starts.push(...piece.times.starts);
              }
              if (!piece.audio.length) continue;
              audio.push(piece.audio);
              parts.push(piece.audio);
              yield piece.audio;
            }
            done = true;
          } catch (err) {
            // Half a sentence already went out: saying it again would repeat it.
            if (audio.length || !stream) throw err;
            // The timed endpoint failed: the plain stream reads this and the rest of the story.
            timed = undefined;
            chars.length = 0;
            starts.length = 0;
          }
        }
        if (!done && stream) {
          for await (const bytes of stream(chunk.spoken, { previousText })) {
            audio.push(bytes);
            parts.push(bytes);
            yield bytes;
          }
        }
        said.push(chunk.spoken);
        if (timing) timeWords(chunk, audio, chars, starts);
      }

      if (!stream && !timed) {
        let all = "";
        for await (const piece of text) all += piece;
        yield (await this.speak(all)).audio;
        return;
      }
      for await (const piece of text) {
        for (const chunk of chunker.push(piece)) yield* say(chunk);
      }
      const rest = chunker.flush();
      if (rest) yield* say(rest);
      if (parts.length) {
        remember(
          normalizeSpeechText(said.join(" ")),
          Promise.resolve({
            audio: joinAudio(parts),
            contentType: "audio/mpeg",
            wordTimes: timing ? wordTimes : undefined,
          }),
        );
      }
    },
    speak(text) {
      const key = normalizeSpeechText(text);
      const hit = cache.get(key);
      if (hit) {
        // Re-insert so the Map's insertion order works as least-recently-used.
        cache.delete(key);
        cache.set(key, hit);
        return hit;
      }
      // The promise is cached, so two players asking at once pay for one clip.
      const pending = synthesizer.synthesize(key);
      remember(key, pending);
      return pending;
    },
  };
}

/** Used when ELEVENLABS_KEY is missing, so the rest of the API still runs. */
export function createDisabledSpeechService(): SpeechService {
  return {
    speak: async () => {
      throw new AppError("UPSTREAM_ERROR", "Speech is not configured (ELEVENLABS_KEY)");
    },
    // biome-ignore lint/correctness/useYield: fails before the first byte
    async *speakStream() {
      throw new AppError("UPSTREAM_ERROR", "Speech is not configured (ELEVENLABS_KEY)");
    },
  };
}

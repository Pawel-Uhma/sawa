import { z } from "zod";
import { mp3DurationSec } from "../../domain/word-times";
import { AppError } from "../../lib/errors";
import type { SpeechSynthesizer, TimedSpeech } from "../../services/ports";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const TIMEOUT_MS = 30_000;
const OUTPUT_FORMAT = "mp3_44100_128";

/** Asia, a native Polish voice from the ElevenLabs library, picked by ear in the voice tuner. */
export const SAWA_VOICE_ID = "Bz1e1clEKwgN71Vx7cxj";
/** Multilingual v2 reads Polish most steadily; it detects the language itself. */
export const SAWA_MODEL_ID = "eleven_multilingual_v2";
/** Tuned on 17.10: lively rather than newsreader-flat, a bit faster than default. */
export const SAWA_VOICE_SETTINGS = {
  stability: 0.3,
  similarity_boost: 0.7,
  style: 0.9,
  speed: 1.05,
  use_speaker_boost: true,
} as const;

const AlignmentSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number()),
  character_end_times_seconds: z.array(z.number()),
});
/** One line of /stream/with-timestamps: base64 mp3 and the characters it covers. */
const TimedChunkSchema = z.object({
  audio_base64: z.string().nullish(),
  alignment: AlignmentSchema.nullish(),
  normalized_alignment: AlignmentSchema.nullish(),
});

/** Lines of a JSON-lines body as they arrive; empty lines (keep-alive) are skipped. */
async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    let end = buffer.indexOf("\n");
    while (end >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line) yield line;
      end = buffer.indexOf("\n");
    }
  }
  const rest = (buffer + decoder.decode()).trim();
  if (rest) yield rest;
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * The stream's lines as mp3 bytes and character times from the start of the clip. The docs do
 * not say whether a line's times count from the start of the clip or of the line's own audio;
 * times that jump back mean the latter, and then each line is moved by the audio before it.
 */
async function* timedPieces(body: ReadableStream<Uint8Array>): AsyncGenerator<TimedSpeech> {
  const before: Uint8Array[] = [];
  let lastEnd = 0;
  let perLine = false;
  for await (const line of lines(body)) {
    let parsed: z.infer<typeof TimedChunkSchema>;
    try {
      parsed = TimedChunkSchema.parse(JSON.parse(line));
    } catch (err) {
      throw new AppError("UPSTREAM_ERROR", "ElevenLabs sent a line that is not a timed chunk", {
        cause: err,
      });
    }
    const audio = new Uint8Array(Buffer.from(parsed.audio_base64 ?? "", "base64"));
    const align = parsed.alignment ?? parsed.normalized_alignment;
    let times: TimedSpeech["times"] = null;
    if (align?.characters.length) {
      const first = align.character_start_times_seconds[0] ?? 0;
      if (!perLine && first + 0.25 < lastEnd) perLine = true;
      const offset = perLine ? (mp3DurationSec(join(before)) ?? lastEnd) : 0;
      times = {
        chars: align.characters,
        starts: align.character_start_times_seconds.map((t) => t + offset),
      };
      const end = align.character_end_times_seconds.at(-1);
      if (end !== undefined) lastEnd = Math.max(lastEnd, end + offset);
    }
    if (audio.length) before.push(audio);
    yield { audio, times };
  }
}

export type ElevenLabsOptions = {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
};

export function createElevenLabsSynthesizer(options: ElevenLabsOptions): SpeechSynthesizer {
  const voiceId = options.voiceId ?? SAWA_VOICE_ID;
  const modelId = options.modelId ?? SAWA_MODEL_ID;

  async function send(
    path: string,
    body: Record<string, unknown>,
    accept = "audio/mpeg",
  ): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${voiceId}${path}?output_format=${OUTPUT_FORMAT}`, {
        method: "POST",
        headers: {
          "xi-api-key": options.apiKey,
          "Content-Type": "application/json",
          Accept: accept,
        },
        body: JSON.stringify({ ...body, model_id: modelId, voice_settings: SAWA_VOICE_SETTINGS }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new AppError("UPSTREAM_TIMEOUT", "Speech synthesis timed out", { cause: err });
      }
      throw new AppError("UPSTREAM_ERROR", "Speech synthesis unreachable", { cause: err });
    }
    if (!res.ok) {
      // The body explains quota and permission errors; it never contains the key.
      const detail = (await res.text()).slice(0, 300);
      throw new AppError("UPSTREAM_ERROR", `ElevenLabs answered ${res.status}: ${detail}`);
    }
    return res;
  }

  return {
    // The /stream endpoint sends mp3 frames as they are made; pieces of one story join into one mp3.
    async *stream(text, { previousText }) {
      const res = await send("/stream", { text, previous_text: previousText || undefined });
      if (!res.body) return;
      for await (const chunk of res.body) yield chunk;
    },
    // Same voice, as JSON lines with base64 mp3 and when each character is said.
    async *streamWithTimes(text, { previousText }) {
      const res = await send(
        "/stream/with-timestamps",
        { text, previous_text: previousText || undefined },
        "application/json",
      );
      if (!res.body) return;
      yield* timedPieces(res.body);
    },
    async synthesize(text) {
      const res = await send("", { text });
      return {
        audio: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") ?? "audio/mpeg",
      };
    },
  };
}

import { describe, expect, it, vi } from "vitest";
import { AppError } from "../lib/errors";
import type { SpeechSynthesizer } from "./ports";
import { createDisabledSpeechService, createSpeechService } from "./speak";

function fakeSynthesizer() {
  const synthesize = vi.fn<SpeechSynthesizer["synthesize"]>(async (text) => ({
    audio: new TextEncoder().encode(text),
    contentType: "audio/mpeg",
  }));
  return { synthesize };
}

describe("createSpeechService", () => {
  it("sends normalized text to the synthesizer", async () => {
    const synth = fakeSynthesizer();
    await createSpeechService(synth).speak("  Cześć,\n jestem Sawa. ");
    expect(synth.synthesize).toHaveBeenCalledWith("Cześć, jestem Sawa.");
  });

  it("pays once for the same text, even with different spacing", async () => {
    const synth = fakeSynthesizer();
    const service = createSpeechService(synth);
    await Promise.all([service.speak("Pałac Kultury"), service.speak("Pałac  Kultury")]);
    await service.speak("Pałac Kultury\n");
    expect(synth.synthesize).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed synthesis instead of caching the error", async () => {
    const synth = fakeSynthesizer();
    synth.synthesize.mockRejectedValueOnce(new AppError("UPSTREAM_ERROR", "boom"));
    const service = createSpeechService(synth);
    await expect(service.speak("Wisła")).rejects.toThrow("boom");
    await expect(service.speak("Wisła")).resolves.toMatchObject({ contentType: "audio/mpeg" });
    expect(synth.synthesize).toHaveBeenCalledTimes(2);
  });
});

describe("createDisabledSpeechService", () => {
  it("fails with an upstream error naming the missing key", async () => {
    await expect(createDisabledSpeechService().speak("Cześć")).rejects.toThrow("ELEVENLABS_KEY");
  });
});

describe("speakStream", () => {
  async function* pieces(...texts: string[]) {
    yield* texts;
  }
  const decode = (parts: Uint8Array[]) => parts.map((p) => new TextDecoder().decode(p));

  function streamingSynthesizer() {
    const stream = vi.fn(async function* (text: string, _opts: { previousText: string }) {
      yield new TextEncoder().encode(`<${text}>`);
    });
    return { ...fakeSynthesizer(), stream };
  }

  it("reads sentence by sentence, telling TTS what was already said", async () => {
    const synth = streamingSynthesizer();
    const out: Uint8Array[] = [];
    const text = pieces("Bowie wysiadł tu z pociągu na krótki spacer. ", "Kupił płytę.");
    for await (const b of createSpeechService(synth).speakStream(text)) out.push(b);

    expect(decode(out)).toEqual([
      "<Bowie wysiadł tu z pociągu na krótki spacer.>",
      "<Kupił płytę.>",
    ]);
    expect(synth.stream.mock.calls[1]?.[1]).toEqual({
      previousText: "Bowie wysiadł tu z pociągu na krótki spacer.",
    });
  });

  it("keeps the whole story as one clip, so it plays again from the cache", async () => {
    const synth = streamingSynthesizer();
    const service = createSpeechService(synth);
    const whole = "Bowie wysiadł tu z pociągu na krótki spacer. Kupił płytę.";
    for await (const _ of service.speakStream(pieces(whole))) {
    }
    const again: Uint8Array[] = [];
    for await (const b of service.speakStream(pieces(whole), { whole })) again.push(b);
    expect(decode(again)).toEqual(["<Bowie wysiadł tu z pociągu na krótki spacer.><Kupił płytę.>"]);
    expect(synth.stream).toHaveBeenCalledTimes(2);
  });

  it("reads the whole text at once when the synthesizer cannot stream", async () => {
    const synth = fakeSynthesizer();
    const out: Uint8Array[] = [];
    for await (const b of createSpeechService(synth).speakStream(pieces("Hej. ", "Tu.")))
      out.push(b);
    expect(decode(out)).toEqual(["Hej. Tu."]);
  });

  describe("with word times", () => {
    // One MPEG1 layer III frame, 128 kbps, 44.1 kHz.
    const FRAME_SEC = 1152 / 44100;
    const frames = (n: number) => {
      const out = new Uint8Array(417 * n);
      for (let i = 0; i < n; i++) out.set([0xff, 0xfb, 0x90, 0x64], i * 417);
      return out;
    };
    /** Each sentence is 10 frames; its characters are said 0.01 s apart. */
    function timedSynthesizer() {
      const streamWithTimes = vi.fn(async function* (
        text: string,
        _opts: { previousText: string },
      ) {
        const chars = [...text];
        yield { audio: new Uint8Array(), times: { chars, starts: chars.map((_, i) => i * 0.01) } };
        yield { audio: frames(10), times: null };
      });
      return { ...streamingSynthesizer(), streamWithTimes };
    }
    async function run(
      service: ReturnType<typeof createSpeechService>,
      text: string,
      whole?: string,
    ) {
      const times: number[] = [];
      for await (const _ of service.speakStream(pieces(text), {
        whole,
        onWords: (t) => times.push(...t),
      })) {
      }
      return times;
    }

    it("times the words on screen, numbers in digits too, sentence after sentence", async () => {
      const synth = timedSynthesizer();
      const text = "Zbudowano go dla całego miasta w 1867 roku. Stoi.";
      const times = await run(createSpeechService(synth), text);
      expect(synth.stream).not.toHaveBeenCalled();
      const spoken = synth.streamWithTimes.mock.calls[0]?.[0] ?? "";
      expect(spoken).toContain("tysiąc osiemset");
      expect(times).toHaveLength(text.split(" ").length);
      // "roku." starts where the voice says it, past the spelled-out year.
      expect(times[7]).toBeCloseTo(spoken.indexOf("roku") * 0.01);
      expect(times[8]).toBeCloseTo(10 * FRAME_SEC);
    });

    it("keeps the times with the cached clip", async () => {
      const synth = timedSynthesizer();
      const service = createSpeechService(synth);
      const whole = "Bowie wysiadł tu z pociągu na krótki spacer. Kupił płytę.";
      const first = await run(service, whole);
      const again = await run(service, whole, whole);
      expect(again).toEqual(first);
      expect(synth.streamWithTimes).toHaveBeenCalledTimes(2);
    });

    it("falls back to the plain stream when the timed one fails, guessing the times", async () => {
      const synth = timedSynthesizer();
      synth.streamWithTimes.mockImplementation(async function* () {
        yield* [];
        throw new AppError("UPSTREAM_ERROR", "404");
      });
      synth.stream.mockImplementation(async function* () {
        yield frames(4);
      });
      const out: Uint8Array[] = [];
      const times: number[] = [];
      for await (const b of createSpeechService(synth).speakStream(
        pieces("Bowie wysiadł tu z pociągu na krótki spacer. ", "Kupił płytę."),
        { onWords: (t) => times.push(...t) },
      )) {
        out.push(b);
      }
      expect(out).toHaveLength(2);
      expect(synth.streamWithTimes).toHaveBeenCalledTimes(1);
      expect(times).toHaveLength(10);
      expect(times[8]).toBeCloseTo(4 * FRAME_SEC);
    });

    it("stops timing when the audio length is unknown", async () => {
      const times: number[] = [];
      const synth = streamingSynthesizer();
      for await (const _ of createSpeechService(synth).speakStream(
        pieces("Bowie wysiadł tu z pociągu na krótki spacer. ", "Kupił płytę."),
        { onWords: (t) => times.push(...t) },
      )) {
      }
      expect(times).toEqual([]);
    });
  });
});

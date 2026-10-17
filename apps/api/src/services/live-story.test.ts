import type { Story } from "@sawa/shared";
import { describe, expect, it, vi } from "vitest";
import { createLiveStoryService } from "./live-story";
import type { SpeechSynthesizer } from "./ports";
import { createSpeechService } from "./speak";
import type { StoryService } from "./tell-story";

/** MPEG1 layer III frames, 128 kbps, 44.1 kHz. */
function frames(n: number) {
  const out = new Uint8Array(417 * n);
  for (let i = 0; i < n; i++) out.set([0xff, 0xfb, 0x90, 0x64], i * 417);
  return out;
}

const synthesizer: SpeechSynthesizer = {
  synthesize: async () => ({ audio: frames(1), contentType: "audio/mpeg" }),
  async *streamWithTimes(text) {
    const chars = [...text];
    // As long as the characters take, 0.01 s each.
    const audio = frames(Math.ceil((chars.length * 0.01 * 44100) / 1152));
    yield { audio, times: { chars, starts: chars.map((_, i) => i * 0.01) } };
  },
};

function storiesTelling(pieces: string[], finalText: string): StoryService {
  const story = { text: finalText } as Story;
  return {
    tell: vi.fn(),
    warm: vi.fn(),
    tellStream: async () => ({
      text: (async function* () {
        yield* pieces;
      })(),
      story: Promise.resolve(story),
    }),
  };
}

async function finished(service: ReturnType<typeof createLiveStoryService>, id: string) {
  for (let i = 0; i < 100; i++) {
    const session = service.get(id);
    const state = session?.state();
    if (state?.done && session?.audio.done) return state;
    await new Promise((r) => setTimeout(r, 2));
  }
  return service.get(id)?.state();
}

describe("createLiveStoryService word times", () => {
  it("times every word of the text the client gets", async () => {
    const pieces = ["Zbudowano go dla całego miasta ", "w 1867 roku.  ", "Stoi do dziś."];
    const text = "Zbudowano go dla całego miasta w 1867 roku. Stoi do dziś.";
    const service = createLiveStoryService({
      stories: storiesTelling(pieces, text),
      speech: createSpeechService(synthesizer),
    });
    const state = await finished(service, service.start({ placeId: "p", targetSec: 30 }));
    expect(state?.text).toBe(text);
    expect(state?.wordTimes).toHaveLength(text.split(" ").length);
    const times = state?.wordTimes ?? [];
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("leaves the times out when the finished story is worded otherwise", async () => {
    const service = createLiveStoryService({
      stories: storiesTelling(["Hej, patrz na ten dom tutaj po prawej."], "Inny tekst."),
      speech: createSpeechService(synthesizer),
    });
    const state = await finished(service, service.start({ placeId: "p", targetSec: 30 }));
    expect(state?.done).toBe(true);
    expect(state?.wordTimes).toBeUndefined();
  });
});

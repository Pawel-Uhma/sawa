import { describe, expect, it } from "vitest";
import {
  alignWordTimes,
  estimateWordTimes,
  mp3DurationSec,
  type SpokenWord,
  spokenWords,
} from "./word-times";

/** Spoken words starting one second apart. */
const said = (text: string): SpokenWord[] => text.split(" ").map((word, i) => ({ word, start: i }));

describe("spokenWords", () => {
  it("starts each word on its first character", () => {
    const chars = [..."Tu, Wisła."];
    const starts = chars.map((_, i) => i * 0.1);
    expect(spokenWords({ chars, starts })).toEqual([
      { word: "Tu,", start: 0 },
      { word: "Wisła.", start: expect.closeTo(0.4) },
    ]);
  });
});

describe("alignWordTimes", () => {
  it("matches equal words one to one, ignoring case and punctuation", () => {
    expect(alignWordTimes("Pałac Kultury, stoi.", said("pałac kultury stoi"))).toEqual([0, 1, 2]);
  });

  it("gives a number in digits the start of its spoken words and skips them", () => {
    const spoken = said("Zbudowano go w tysiąc osiemset sześćdziesiątym siódmym roku.");
    expect(alignWordTimes("Zbudowano go w 1867 roku.", spoken)).toEqual([0, 1, 2, 3, 7]);
  });

  it("handles two numbers in a row", () => {
    const spoken = said("ma sto siedemdziesiąt jeden metrów i trzy piętra");
    expect(alignWordTimes("ma 171 metrów i 3 piętra", spoken)).toEqual([0, 1, 4, 5, 6, 7]);
  });

  it("follows a word the voice added", () => {
    expect(alignWordTimes("tu stoi", said("tu no stoi"))).toEqual([0, 2]);
  });

  it("keeps time from going back and fills words past the voice", () => {
    expect(alignWordTimes("a b c d", said("a b"))).toEqual([0, 1, 1, 1]);
  });

  it("returns nothing for empty text", () => {
    expect(alignWordTimes("  ", said("a"))).toEqual([]);
  });
});

describe("estimateWordTimes", () => {
  it("spreads words over the clip by their length", () => {
    expect(estimateWordTimes("ab cd", 6)).toEqual([0, 3]);
  });
});

describe("mp3DurationSec", () => {
  // MPEG1 layer III, 128 kbps, 44.1 kHz, no padding: 417 bytes, 1152 samples.
  const frame = () => {
    const f = new Uint8Array(417);
    f.set([0xff, 0xfb, 0x90, 0x64]);
    return f;
  };
  const join = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };

  it("counts frames", () => {
    expect(mp3DurationSec(join(frame(), frame(), frame()))).toBeCloseTo((3 * 1152) / 44100);
  });

  it("skips an ID3 tag", () => {
    const tag = new Uint8Array(20);
    tag.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 10]);
    expect(mp3DurationSec(join(tag, frame()))).toBeCloseTo(1152 / 44100);
  });

  it("is null for bytes that are not mp3", () => {
    expect(mp3DurationSec(new TextEncoder().encode("<Hej.>"))).toBeNull();
  });
});

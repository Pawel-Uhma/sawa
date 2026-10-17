import { describe, expect, it } from "vitest";
import type { MockStop } from "./mock-data";
import { clipKey, spokenCut, spokenLength, spokenWordCount, targetSecFor } from "./story-player";

describe("clipKey", () => {
  const listener = { interests: ["historical" as const], storyStyle: "fun" as const };

  it("changes with interests, style and story length, not only the stop", () => {
    const key = clipKey("p1", listener, 60);
    expect(clipKey("p1", listener, 60)).toBe(key);
    expect(clipKey("p1", { ...listener, interests: ["nature"] }, 60)).not.toBe(key);
    expect(clipKey("p1", { ...listener, storyStyle: "deep" }, 60)).not.toBe(key);
    expect(clipKey("p1", listener, 120)).not.toBe(key);
    expect(clipKey("p2", listener, 60)).not.toBe(key);
  });
});

describe("targetSecFor", () => {
  const stop = (etaSec: number, windowSec?: number) =>
    ({ id: `p${etaSec}`, etaSec, etaMin: Math.round(etaSec / 60), windowSec }) as MockStop;

  it("takes the planner's window when there is one", () => {
    expect(targetSecFor([stop(0, 90), stop(200)], 0)).toBe(90);
  });

  it("else talks until the next stop", () => {
    expect(targetSecFor([stop(30), stop(170)], 0)).toBe(140);
  });
});

describe("spokenLength", () => {
  const text = "Pałac Kultury stoi tu od 1955 roku.";

  it("lights nothing before Sawa starts", () => {
    expect(spokenLength(text, 0)).toBe(0);
  });

  it("lights the word Sawa is saying now, whole", () => {
    // 30% to środek „Kultury”: słowo świeci w całości, nie dopiero po wypowiedzeniu
    expect(text.slice(0, spokenLength(text, 30))).toBe("Pałac Kultury");
  });

  it("lights everything at the end", () => {
    expect(spokenLength(text, 100)).toBe(text.length);
    expect(spokenLength(text, 97)).toBe(text.length);
  });
});

describe("spokenWordCount", () => {
  const text = "W 1867 roku stanął tu dworzec.";
  const times = [0, 0.2, 1.4, 1.8, 2.3, 2.5];

  it("follows the voice's word times, a bit ahead", () => {
    expect(spokenWordCount(text, 10, times, 0)).toBe(1);
    expect(spokenWordCount(text, 10, times, 1.0)).toBe(2);
    // The year takes long to say: "roku" waits for the voice, whatever the guess says.
    expect(spokenWordCount(text, 60, times, 1.36)).toBe(3);
    expect(spokenWordCount(text, 99, times, 9)).toBe(6);
  });

  it("guesses from progress without times or without the voice", () => {
    const guess = spokenWordCount(text, 50, undefined, 1);
    expect(guess).toBe(text.slice(0, spokenLength(text, 50)).split(/\s+/).length);
    expect(spokenWordCount(text, 50, times, null)).toBe(guess);
    expect(spokenWordCount(null, 50, times, 1)).toBe(0);
  });

  it("does not fall behind the guess past the last known time", () => {
    expect(spokenWordCount(text, 90, [0, 0.2], 5)).toBeGreaterThan(2);
  });
});

describe("spokenCut", () => {
  it("ends after the given word", () => {
    expect(spokenCut("Tu  stoi dom.", 2)).toBe("Tu  stoi".length);
    expect(spokenCut("Tu stoi", 0)).toBe(0);
    expect(spokenCut("Tu stoi", 5)).toBe(7);
  });
});

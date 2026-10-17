import { afterEach, describe, expect, it } from "vitest";
import { claimVoice, isAside, ROUTE_VOICE, releaseVoice, voiceOwner } from "./voice";

describe("jeden głos Sawy", () => {
  afterEach(() => {
    releaseVoice(voiceOwner() ?? "");
  });

  it("dygresja zabiera głos trasie i oddaje go po końcu", () => {
    claimVoice(ROUTE_VOICE);
    claimVoice("place:a");
    expect(isAside(voiceOwner())).toBe(true);
    releaseVoice("place:a");
    expect(voiceOwner()).toBeNull();
    expect(isAside(voiceOwner())).toBe(false);
  });

  it("spóźnione oddanie nie odbiera głosu temu, kto go przejął", () => {
    claimVoice("place:a");
    claimVoice(ROUTE_VOICE);
    releaseVoice("place:a");
    expect(voiceOwner()).toBe(ROUTE_VOICE);
  });
});

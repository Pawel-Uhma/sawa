import { beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

// Moduł trzyma pamięć w zmiennej, więc każdy test bierze świeżą kopię.
async function freshMemory(storage = fakeStorage()) {
  vi.stubGlobal("window", { localStorage: storage });
  vi.resetModules();
  return { memory: await import("./memory"), storage };
}

describe("memory", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("adds the facts of every heard story to the place, without repeats", async () => {
    const { memory } = await freshMemory();
    memory.rememberStory({ placeId: "kercelak", factIds: ["a", "b"], contextIds: [] });
    memory.rememberStory({
      placeId: "kercelak",
      factIds: ["b", "c"],
      contextIds: ["powstanie-1944"],
    });
    expect(memory.getMemory().places.kercelak?.facts).toEqual(["a", "b", "c"]);
    expect(memory.getMemory().contexts).toEqual(["powstanie-1944"]);
    expect(memory.heardCounts(memory.getMemory())).toEqual({ kercelak: 3 });
  });

  it("survives a reload through localStorage", async () => {
    const { memory, storage } = await freshMemory();
    memory.rememberStory({ placeId: "helios", factIds: ["x"], contextIds: [] });
    const reloaded = await freshMemory(storage);
    expect(reloaded.memory.getMemory().places.helios?.facts).toEqual(["x"]);
  });

  it("forgets everything", async () => {
    const { memory } = await freshMemory();
    memory.rememberStory({ placeId: "helios", factIds: ["x"], contextIds: ["c"] });
    memory.forgetAll();
    expect(memory.getMemory()).toEqual({ places: {}, contexts: [] });
  });

  it("lists told places newest first", async () => {
    const { memory } = await freshMemory();
    const told = memory.toldNewestFirst({
      places: {
        helios: { name: "Helios", facts: ["x"], at: 100 },
        kercelak: { name: "Kercelak", facts: ["a", "b"], at: 300 },
        zacheta: { facts: [], at: 200 },
      },
      contexts: [],
    });
    expect(told.map((place) => place.id)).toEqual(["kercelak", "zacheta", "helios"]);
    expect(told[0]).toMatchObject({ name: "Kercelak", facts: ["a", "b"] });
  });

  it("starts empty when the stored value is broken", async () => {
    const storage = fakeStorage();
    storage.setItem("sawa.memory.v1", "{nie json");
    const { memory } = await freshMemory(storage);
    expect(memory.getMemory()).toEqual({ places: {}, contexts: [] });
  });
});

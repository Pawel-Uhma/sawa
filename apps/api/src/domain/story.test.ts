import { factId } from "@sawa/shared";
import { describe, expect, it } from "vitest";
import { contextFor, STORY_CONTEXTS } from "./contexts";
import type { Place } from "./place";
import type { Finding } from "./research";
import {
  agoPhrase,
  bandFor,
  bboxAround,
  createStoryTextReader,
  factsStory,
  findingSources,
  fitWords,
  heardIntro,
  isGentleForKids,
  nearestUnheard,
  nothingNewText,
  parseStoryAnswer,
  pickFacts,
  placeFacts,
  spokenName,
  storyCacheKey,
  storyWords,
  WORDS_PER_SEC,
} from "./story";

const place = {
  id: "kercelak",
  name: "Kercelak",
  facts: ["Kercelak był największym bazarem Warszawy.", "Spłonął w czasie Powstania."],
  trivia: ["Mówiono, że można tu kupić wszystko."],
  sources: [
    { id: "s1", title: "Wikipedia: Kercelak", url: "https://pl.wikipedia.org/wiki/Kercelak" },
    { id: "s2", title: "Warszawikia", url: "https://warszawa.fandom.com/wiki/Kercelak" },
  ],
} as Place;

const bowie: Finding = {
  text: "Bowie podobno wysiadł tu z pociągu w 1976 roku i kupił płytę zespołu Śląsk.",
  url: "https://stacjamuranow.pl/pl/mural-bowiego/",
  title: "Mural Bowiego - Stacja Muranów",
};

describe("bandFor", () => {
  it.each([
    [10, "20s"],
    [45, "40s"],
    [59, "40s"],
    [119, "100s"],
    [179, "150s"],
    [600, "600s"],
  ])("%i s → %s", (sec, band) => {
    expect(bandFor(sec).id).toBe(band);
  });

  it("fits the window with a breath to spare", () => {
    for (const sec of [20, 45, 90, 200, 600]) {
      const band = bandFor(sec);
      expect(band.words / WORDS_PER_SEC).toBeLessThanOrEqual(Math.max(sec, 20));
      expect(band.words / WORDS_PER_SEC).toBeGreaterThan(sec * 0.5);
    }
  });
});

describe("storyCacheKey", () => {
  it("ignores the order of interests", () => {
    const band = bandFor(40);
    expect(storyCacheKey("a", ["nature", "historical"], band)).toBe(
      storyCacheKey("a", ["historical", "nature"], band),
    );
  });
});

describe("parseStoryAnswer", () => {
  it("keeps the cited sources only", () => {
    const draft = parseStoryAnswer(
      '{"text":"Tu był bazar.","usedIds":["a1"],"sourceIds":["s2"]}',
      place.sources,
    );
    expect(draft).toEqual({ text: "Tu był bazar.", sources: [place.sources[1]], usedIds: ["a1"] });
  });

  it("falls back to all sources when the ids are unknown", () => {
    const draft = parseStoryAnswer('{"text":"Tu był bazar.","sourceIds":["s9"]}', place.sources);
    expect(draft?.sources).toEqual(place.sources);
  });

  it("reads JSON wrapped in a code fence and strips markdown", () => {
    const draft = parseStoryAnswer('```json\n{"text":"**Tu** był\\n bazar."}\n```', place.sources);
    expect(draft?.text).toBe("Tu był bazar.");
  });

  it.each(["not json", '{"text":""}', '{"sourceIds":[]}', "null"])("rejects %s", (raw) => {
    expect(parseStoryAnswer(raw, place.sources)).toBeNull();
  });
});

describe("pickFacts", () => {
  const medium = bandFor(60);
  const [first, trivia, second] = placeFacts(place).map((f) => f.id);

  it("offers what the place is, then the trivia, then the other facts", () => {
    const pick = pickFacts(place, { heard: [], band: medium });
    expect(pick.facts.map((f) => f.id)).toEqual([first, trivia, second]);
    expect(pick.recap).toBe(false);
  });

  it("puts stories from the web before everything else, citing their page", () => {
    const pick = pickFacts(place, { heard: [], band: medium, findings: [bowie] });
    expect(pick.facts[0]).toMatchObject({ kind: "story", text: bowie.text, sourceId: "w1" });
  });

  it("skips what the listener already heard", () => {
    const pick = pickFacts(place, { heard: [first ?? ""], band: medium });
    expect(pick.facts.map((f) => f.id)).toEqual([trivia, second]);
  });

  it("recalls one line when everything was heard", () => {
    const pick = pickFacts(place, { heard: [first, second, trivia] as string[], band: medium });
    expect(pick).toEqual({ facts: [placeFacts(place)[0]], recap: true });
  });

  it("offers one or two lines in the trivia style", () => {
    const pick = pickFacts(place, { heard: [], band: medium, style: "trivia" });
    expect(pick.facts.length).toBeLessThanOrEqual(2);
  });

  it("keeps at least one fact even when the band is tiny", () => {
    const pick = pickFacts(place, { heard: [], band: { id: "5s", sec: 5, words: 2 } });
    expect(pick.facts).toHaveLength(1);
  });

  it("ids facts by their text", () => {
    expect(placeFacts(place)[0]?.id).toBe(factId("Kercelak był największym bazarem Warszawy."));
  });
});

describe("fitWords", () => {
  const pick = (texts: string[]) => ({
    facts: texts.map((text) => ({ id: factId(text), text, kind: "fact" as const })),
    recap: false,
  });

  it("keeps a story with one thin fact short instead of padding it", () => {
    expect(fitWords(140, pick(["Autor: Dawid Celek."]))).toBe(25);
  });

  it("grows with the material up to the limit", () => {
    const long = Array.from({ length: 60 }, () => "słowo").join(" ");
    expect(fitWords(140, pick([long]))).toBe(96);
    expect(fitWords(140, pick([long, long]))).toBe(140);
  });

  it("adds the room for the background", () => {
    expect(fitWords(140, pick(["Autor: Dawid Celek."]), 50)).toBe(55);
  });
});

describe("findingSources", () => {
  it("gives each page one source id", () => {
    const other = { ...bowie, text: "Mural odsłonięto w 2016 roku." };
    expect(findingSources([bowie, other])).toEqual([
      { id: "w1", title: bowie.title, url: bowie.url },
    ]);
  });
});

describe("storyWords", () => {
  const band = bandFor(60);

  it("gives a child a shorter story than an adult", () => {
    const kids = storyWords(band, "deep", false, "kids");
    expect(kids).toBeLessThan(storyWords(band, "deep", false, "adult"));
    expect(storyWords(band, "deep", false)).toBe(band.words);
  });

  it("keeps trivia and reminders short for everyone", () => {
    expect(storyWords(band, "trivia", false, "kids")).toBe(storyWords(band, "trivia", false));
  });
});

describe("isGentleForKids", () => {
  it("marks war and the ghetto, not the rest", () => {
    expect(isGentleForKids({ interests: ["architecture", "war_uprising"] })).toBe(true);
    expect(isGentleForKids({ interests: ["jewish_warsaw"] })).toBe(true);
    expect(isGentleForKids({ interests: ["nature", "sport"] })).toBe(false);
  });
});

describe("contextFor", () => {
  const uprising = { interests: ["war_uprising", "architecture"] };

  it("explains the background once, and only to first-timers", () => {
    expect(contextFor(uprising, "first_time", [])?.id).toBe("powstanie-1944");
    expect(contextFor(uprising, "first_time", ["powstanie-1944"])).toBeNull();
    expect(contextFor(uprising, "local", [])).toBeNull();
    expect(contextFor({ interests: ["nature"] }, "first_time", [])).toBeNull();
  });

  it("has a unique id per background", () => {
    expect(new Set(STORY_CONTEXTS.map((c) => c.id)).size).toBe(STORY_CONTEXTS.length);
  });
});

describe("factsStory", () => {
  it("names the place and reads as many picked lines as fit", () => {
    const pick = pickFacts(place, { heard: [], band: bandFor(60) });
    const draft = factsStory(place, pick, place.sources, 12);
    expect(draft.text).toBe("Mijamy: Kercelak. Kercelak był największym bazarem Warszawy.");
    expect(draft.usedIds).toEqual([pick.facts[0]?.id]);
    expect(draft.sources).toEqual(place.sources);
  });

  it("says when Sawa told about the place before instead of assuming the listener remembers", () => {
    const pick = pickFacts(place, { heard: placeFacts(place).map((f) => f.id), band: bandFor(60) });
    const heard = "Wczoraj opowiadałam ci o tym miejscu.";
    const draft = factsStory(place, pick, place.sources, 60, heard);
    expect(draft.text).toMatch(/^Mijamy: Kercelak\. Wczoraj opowiadałam ci o tym miejscu\. /);
    expect(draft.text).not.toMatch(/Znowu|Pamiętasz/);
  });
});

describe("agoPhrase", () => {
  const H = 3600;
  const D = 24 * H;
  it.each([
    [0, "przed chwilą"],
    [59 * 60, "przed chwilą"],
    [5 * H, "dziś"],
    [D + H, "wczoraj"],
    [2 * D, "przedwczoraj"],
    [3 * D, "trzy dni temu"],
    [6 * D + 23 * H, "sześć dni temu"],
    [7 * D, "tydzień temu"],
    [13 * D, "tydzień temu"],
    [14 * D, "dwa tygodnie temu"],
    [21 * D, "trzy tygodnie temu"],
    [29 * D, "cztery tygodnie temu"],
    [30 * D, "miesiąc temu"],
    [60 * D, "dwa miesiące temu"],
    [95 * D, "trzy miesiące temu"],
    [150 * D, "pięć miesięcy temu"],
    [200 * D, "pół roku temu"],
    [364 * D, "pół roku temu"],
    [365 * D, "rok temu"],
    [2 * 365 * D, "dwa lata temu"],
    [5 * 365 * D, "pięć lat temu"],
    [12 * 365 * D, "dwanaście lat temu"],
    [22 * 365 * D, "dwadzieścia dwa lata temu"],
  ])("%i s → %s", (sec, phrase) => {
    expect(agoPhrase(sec)).toBe(phrase);
  });
});

describe("heardIntro", () => {
  const building = { kind: "building" } as const;
  it("says when Sawa told it, never asks whether the listener remembers", () => {
    expect(heardIntro(building, 95 * 24 * 3600, true)).toBe(
      "Trzy miesiące temu opowiadałam ci o tym budynku.",
    );
    expect(heardIntro({ kind: "street" }, 8 * 24 * 3600, false)).toBe(
      "Tydzień temu mówiłam ci już o tej ulicy, ale jest jeszcze coś.",
    );
    expect(heardIntro(building, undefined, true)).toBe("Już ci kiedyś opowiadałam o tym budynku.");
    expect(heardIntro(building, 10, true)).not.toMatch(/pamięta/i);
  });
});

describe("nearestUnheard", () => {
  const at = { lat: 52.2370217, lng: 20.9733 };
  const summary = (id: string, dLat: number, richness = 3) => ({
    id,
    name: id,
    kind: "building" as const,
    interests: [],
    position: { lat: at.lat + dLat, lng: at.lng },
    richness,
  });
  // 0.001° of latitude is about 111 m.
  const around = [
    summary("here", 0),
    summary("near-heard", 0.0005),
    summary("empty", 0.0006, 0),
    summary("next", 0.0015),
    summary("far", 0.004),
  ];

  it("takes the closest place with something to tell that the listener has not heard", () => {
    expect(nearestUnheard(at, around, new Set(["here", "near-heard"]))?.id).toBe("next");
  });

  it("finds nothing beyond the radius", () => {
    expect(nearestUnheard(at, around, new Set(["here", "near-heard", "next"]))).toBeNull();
  });

  it("looks in a box that holds the radius", () => {
    const box = bboxAround(at, 300);
    expect(box.maxLat - at.lat).toBeCloseTo(300 / 111_320, 6);
    expect(box.maxLng - at.lng).toBeGreaterThan(box.maxLat - at.lat);
  });
});

describe("nothingNewText", () => {
  it("says everything was told and offers the place next door by its spoken name", () => {
    expect(nothingNewText(null)).toBe("O tym miejscu opowiedziałam ci już wszystko, co wiem.");
    expect(nothingNewText({ name: "Kercelak (plac Kercelego)" })).toBe(
      "O tym miejscu opowiedziałam ci już wszystko, co wiem. Ale mogę ci opowiedzieć o miejscu tuż obok: Kercelak.",
    );
    expect(spokenName("Mural (stary)")).toBe("Mural");
  });
});

describe("createStoryTextReader", () => {
  it("reads the text value while the JSON arrives, escapes split across pieces included", () => {
    const raw = '```json\n{"text": "Bowie \\u017cy\\"ł\\" tu.\\nKoniec", "usedIds": ["a"]}';
    const reader = createStoryTextReader();
    let text = "";
    for (const ch of raw) text += reader.push(ch);
    expect(text).toBe('Bowie ży"ł" tu. Koniec');
    expect(reader.raw).toBe(raw);
  });
});

describe("dry data and silence", () => {
  it("leaves office space and map tags out of what Sawa may tell", () => {
    const lines = placeFacts({
      facts: [
        "Budynek ma w OSM 10 kondygnacji (building=office).",
        "Przy budowie znaleziono monety z XIX wieku.",
      ],
      trivia: ["Całkowita powierzchnia biurowa to 70 000 m² i 86 miejsc parkingowych."],
    });
    expect(lines.map((l) => l.text)).toEqual(["Przy budowie znaleziono monety z XIX wieku."]);
  });

  it("reads the model's silence only when it said nothing", () => {
    expect(parseStoryAnswer('{"text":"","silent":true}', [])).toEqual({
      text: "",
      sources: [],
      usedIds: [],
      silent: true,
    });
    expect(parseStoryAnswer('{"text":"Coś.","silent":true}', [])?.silent).toBeUndefined();
    expect(parseStoryAnswer('{"text":""}', [])).toBeNull();
  });
});

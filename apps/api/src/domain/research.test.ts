import { describe, expect, it } from "vitest";
import { MAX_FINDINGS, parseResearchAnswer } from "./research";

const page = { url: "https://stacjamuranow.pl/pl/mural-bowiego/", title: "Mural Bowiego" };
const answer = (findings: unknown) => JSON.stringify({ findings });

describe("parseResearchAnswer", () => {
  it("keeps findings from the pages the search returned, with their title", () => {
    const raw = answer([
      { text: "Bowie kupił tu **płytę**.", url: "https://stacjamuranow.pl/pl/mural-bowiego" },
    ]);
    expect(parseResearchAnswer(raw, [page])).toEqual([
      { text: "Bowie kupił tu płytę.", url: page.url, title: page.title },
    ]);
  });

  it("drops findings from pages the search did not return", () => {
    const raw = answer([{ text: "Coś zmyślonego.", url: "https://example.com/zmyslone" }]);
    expect(parseResearchAnswer(raw, [page])).toEqual([]);
  });

  it("keeps any web page when the provider gave no citations", () => {
    const raw = answer([
      { text: "Mural odsłonięto w 2016 roku.", url: "https://www.zoliborz.org/x" },
    ]);
    expect(parseResearchAnswer(raw, [])).toEqual([
      {
        text: "Mural odsłonięto w 2016 roku.",
        url: "https://www.zoliborz.org/x",
        title: "zoliborz.org",
      },
    ]);
  });

  it(`keeps at most ${MAX_FINDINGS} findings`, () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ text: `Historia ${i}.`, url: page.url }));
    expect(parseResearchAnswer(answer(many), [page])).toHaveLength(MAX_FINDINGS);
  });

  it.each([
    "nie json",
    "null",
    '{"findings":"x"}',
    answer([{ text: 1, url: page.url }]),
  ])("reads %s as nothing found", (raw) => {
    expect(parseResearchAnswer(raw, [page])).toEqual([]);
  });
});

describe("parseResearchAnswer and dry data", () => {
  it("drops office space and parking places found on the web", () => {
    const raw = JSON.stringify({
      findings: [
        {
          text: "Powierzchnia najmu to 12 300 m², a I etap ma 86 miejsc parkingowych.",
          url: page.url,
        },
        { text: "Przy budowie znaleziono butelkę z XIX-wiecznego browaru.", url: page.url },
      ],
    });
    expect(parseResearchAnswer(raw, [page]).map((f) => f.text)).toEqual([
      "Przy budowie znaleziono butelkę z XIX-wiecznego browaru.",
    ]);
  });
});

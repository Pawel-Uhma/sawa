import { describe, expect, it } from "vitest";
import { cardinalPl, decimalPl, romanToInt, spellNumbers } from "./spoken-numbers";

describe("cardinalPl", () => {
  it("spells small numbers, teens, tens and hundreds", () => {
    expect(cardinalPl(0)).toBe("zero");
    expect(cardinalPl(7)).toBe("siedem");
    expect(cardinalPl(13)).toBe("trzynaście");
    expect(cardinalPl(86)).toBe("osiemdziesiąt sześć");
    expect(cardinalPl(171)).toBe("sto siedemdziesiąt jeden");
    expect(cardinalPl(900)).toBe("dziewięćset");
  });

  it("picks tysiąc, tysiące or tysięcy and milion, miliony or milionów", () => {
    expect(cardinalPl(1000)).toBe("tysiąc");
    expect(cardinalPl(2000)).toBe("dwa tysiące");
    expect(cardinalPl(5000)).toBe("pięć tysięcy");
    expect(cardinalPl(12_300)).toBe("dwanaście tysięcy trzysta");
    expect(cardinalPl(22_000)).toBe("dwadzieścia dwa tysiące");
    expect(cardinalPl(70_000)).toBe("siedemdziesiąt tysięcy");
    expect(cardinalPl(1_000_000)).toBe("milion");
    expect(cardinalPl(3_500_000)).toBe("trzy miliony pięćset tysięcy");
    expect(cardinalPl(25_000_000)).toBe("dwadzieścia pięć milionów");
    expect(cardinalPl(2_000_000_000)).toBe("dwa miliardy");
  });

  it("gives the genitive", () => {
    expect(cardinalPl(1, { case: "gen" })).toBe("jednego");
    expect(cardinalPl(5, { case: "gen" })).toBe("pięciu");
    expect(cardinalPl(21, { case: "gen" })).toBe("dwudziestu jeden");
    expect(cardinalPl(100, { case: "gen" })).toBe("stu");
    expect(cardinalPl(800, { case: "gen" })).toBe("ośmiuset");
    expect(cardinalPl(2000, { case: "gen" })).toBe("dwóch tysięcy");
    expect(cardinalPl(12_300, { case: "gen" })).toBe("dwunastu tysięcy trzystu");
  });

  it("gives feminine one and two", () => {
    expect(cardinalPl(1, { feminine: true })).toBe("jedna");
    expect(cardinalPl(2, { feminine: true })).toBe("dwie");
    expect(cardinalPl(22, { feminine: true })).toBe("dwadzieścia dwie");
    expect(cardinalPl(2000, { feminine: true })).toBe("dwa tysiące");
  });
});

describe("decimalPl", () => {
  it("says halves the way people do", () => {
    expect(decimalPl(0, "5")).toBe("pół");
    expect(decimalPl(1, "5")).toBe("półtora");
    expect(decimalPl(2, "5")).toBe("dwa i pół");
  });

  it("reads other fractions with przecinek", () => {
    expect(decimalPl(3, "14")).toBe("trzy przecinek czternaście");
    expect(decimalPl(0, "05")).toBe("zero przecinek zero pięć");
    expect(decimalPl(2, "0")).toBe("dwa");
  });
});

describe("romanToInt", () => {
  it("reads well-formed numerals and rejects the rest", () => {
    expect(romanToInt("XIX")).toBe(19);
    expect(romanToInt("IV")).toBe(4);
    expect(romanToInt("XXI")).toBe(21);
    expect(romanToInt("IIII")).toBeNull();
    expect(romanToInt("")).toBeNull();
  });
});

describe("spellNumbers", () => {
  it("reads house numbers and amounts in the nominative, keeping punctuation", () => {
    expect(spellNumbers("Po prawej aleja Solidarności 171, pod numerami 169 i 173.")).toBe(
      "Po prawej aleja Solidarności sto siedemdziesiąt jeden, pod numerami sto sześćdziesiąt dziewięć i sto siedemdziesiąt trzy.",
    );
    expect(spellNumbers("To 86 miejsc!")).toBe("To osiemdziesiąt sześć miejsc!");
  });

  it("reads thousands with a space, a no-break space or a dot", () => {
    expect(spellNumbers("Ma 70 000 metrów kwadratowych.")).toBe(
      "Ma siedemdziesiąt tysięcy metrów kwadratowych.",
    );
    expect(spellNumbers("Ma 12 300 metrów.")).toBe("Ma dwanaście tysięcy trzysta metrów.");
    expect(spellNumbers("Ma 12.300 metrów.")).toBe("Ma dwanaście tysięcy trzysta metrów.");
    expect(spellNumbers("Aż 2 000 000 ludzi.")).toBe("Aż dwa miliony ludzi.");
  });

  it("uses the genitive after od, do, około and similar", () => {
    expect(spellNumbers("od 5 do 10 metrów")).toBe("od pięciu do dziesięciu metrów");
    expect(spellNumbers("około 100 osób")).toBe("około stu osób");
    expect(spellNumbers("blisko 2000 osób")).toBe("blisko dwóch tysięcy osób");
    expect(spellNumbers("ponad 100 lat temu")).toBe("ponad sto lat temu");
  });

  it("makes one and two feminine before a feminine noun", () => {
    expect(spellNumbers("2 kamienice i 2 domy")).toBe("dwie kamienice i dwa domy");
    expect(spellNumbers("1 osoba, 22 osoby")).toBe("jedna osoba, dwadzieścia dwie osoby");
  });

  it("reads decimals and percents", () => {
    expect(spellNumbers("1,5 kilometra i 2,5 metra")).toBe("półtora kilometra i dwa i pół metra");
    expect(spellNumbers("Aż 30% mieszkańców, potem 1,5%.")).toBe(
      "Aż trzydzieści procent mieszkańców, potem półtora procent.",
    );
    expect(spellNumbers("To 171, 173.")).toBe(
      "To sto siedemdziesiąt jeden, sto siedemdziesiąt trzy.",
    );
  });

  it("spells units after a number with the right form", () => {
    expect(spellNumbers("średnica 80 m, 1 km, 3 km, 20 ha")).toBe(
      "średnica osiemdziesiąt metrów, jeden kilometr, trzy kilometry, dwadzieścia hektarów",
    );
    expect(spellNumbers("12 300 m² biur")).toBe(
      "dwanaście tysięcy trzysta metrów kwadratowych biur",
    );
    expect(spellNumbers("Ok. 100 tys. ludzi, 3 tys. osób, 1 mln złotych.")).toBe(
      "Około stu tysięcy ludzi, trzy tysiące osób, milion złotych.",
    );
  });

  it("keeps years and dates as before", () => {
    expect(spellNumbers("w 1648 roku")).toBe("w tysiąc sześćset czterdziestym ósmym roku");
    expect(spellNumbers("od 1648 do 1650 roku")).toBe(
      "od tysiąc sześćset czterdziestego ósmego do tysiąc sześćset pięćdziesiątego roku",
    );
    expect(spellNumbers("1 sierpnia 1944 roku")).toBe(
      "pierwszego sierpnia tysiąc dziewięćset czterdziestego czwartego roku",
    );
    expect(spellNumbers("Rok 1863 był ciężki.")).toBe(
      "Rok tysiąc osiemset sześćdziesiąty trzeci był ciężki.",
    );
  });

  it("does not take amounts for years", () => {
    expect(spellNumbers("Mieszka tu 1500 osób.")).toBe("Mieszka tu tysiąc pięćset osób.");
    expect(spellNumbers("Ma 300 metrów.")).toBe("Ma trzysta metrów.");
    expect(spellNumbers("pod numerem 1200")).toBe("pod numerem tysiąc dwieście");
  });

  it("expands r. and w. after years and centuries, keeping a sentence's dot", () => {
    expect(spellNumbers("W 1926 r. powstał dom.")).toBe(
      "W tysiąc dziewięćset dwudziestym szóstym roku powstał dom.",
    );
    expect(spellNumbers("To było w 1944 r. Potem.")).toBe(
      "To było w tysiąc dziewięćset czterdziestym czwartym roku. Potem.",
    );
    expect(spellNumbers("w XVI w.")).toBe("w szesnastym wieku.");
  });

  it("spells ranges", () => {
    expect(spellNumbers("5–10 metrów")).toBe("pięć do dziesięciu metrów");
    expect(spellNumbers("13–15 lipca")).toBe("trzynastego do piętnastego lipca");
  });

  it("spells Roman centuries, wars and rulers", () => {
    expect(spellNumbers("w XIX wieku")).toBe("w dziewiętnastym wieku");
    expect(spellNumbers("na przełomie XIX i XX wieku")).toBe(
      "na przełomie dziewiętnastego i dwudziestego wieku",
    );
    expect(spellNumbers("XVIII wiek był")).toBe("osiemnasty wiek był");
    expect(spellNumbers("po II wojnie światowej")).toBe("po drugiej wojnie światowej");
    expect(spellNumbers("II wojna światowa")).toBe("druga wojna światowa");
    expect(spellNumbers("Kolumna Zygmunta III Wazy")).toBe("Kolumna Zygmunta trzeciego Wazy");
    expect(spellNumbers("Jan III Sobieski")).toBe("Jan trzeci Sobieski");
  });

  it("spells hours", () => {
    expect(spellNumbers("o 13:30")).toBe("o trzynastej trzydzieści");
    expect(spellNumbers("od 8:05 do 16:00")).toBe("od ósmej zero pięć do szesnastej");
  });

  it("reads house letters and nr", () => {
    expect(spellNumbers("Nowy Świat 10a, nr 5")).toBe("Nowy Świat dziesięć a, numer pięć");
  });

  it("leaves digits glued to letters and text without digits alone", () => {
    expect(spellNumbers("droga A4")).toBe("droga A4");
    expect(spellNumbers("Pałac Kultury i Nauki.")).toBe("Pałac Kultury i Nauki.");
  });

  it("is deterministic", () => {
    const text = "Aleja Solidarności 171 ma 70 000 metrów kwadratowych.";
    expect(spellNumbers(text)).toBe(spellNumbers(text));
  });
});

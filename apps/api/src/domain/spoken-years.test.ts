import { describe, expect, it } from "vitest";
import { ordinalPl, spellYears } from "./spoken-years";

describe("ordinalPl", () => {
  it("keeps thousands and hundreds cardinal and inflects the rest", () => {
    expect(ordinalPl(1648)).toBe("tysiąc sześćset czterdziesty ósmy");
    expect(ordinalPl(1918, "gen")).toBe("tysiąc dziewięćset osiemnastego");
    expect(ordinalPl(1902, "loc")).toBe("tysiąc dziewięćset drugim");
    expect(ordinalPl(2026, "loc")).toBe("dwa tysiące dwudziestym szóstym");
    expect(ordinalPl(1903, "gen")).toBe("tysiąc dziewięćset trzeciego");
  });

  it("makes round years one ordinal word", () => {
    expect(ordinalPl(1900, "loc")).toBe("tysiąc dziewięćsetnym");
    expect(ordinalPl(2000, "gen")).toBe("dwutysięcznego");
    expect(ordinalPl(1940)).toBe("tysiąc dziewięćset czterdziesty");
  });
});

describe("spellYears", () => {
  it("picks the case from the preposition and the form of „rok”", () => {
    expect(spellYears("w 1648 roku")).toBe("w tysiąc sześćset czterdziestym ósmym roku");
    expect(spellYears("od 1648 do 1650 roku")).toBe(
      "od tysiąc sześćset czterdziestego ósmego do tysiąc sześćset pięćdziesiątego roku",
    );
    expect(spellYears("przed 1939 rokiem")).toBe(
      "przed tysiąc dziewięćset trzydziestym dziewiątym rokiem",
    );
    expect(spellYears("Rok 1863 był ciężki.")).toBe(
      "Rok tysiąc osiemset sześćdziesiąty trzeci był ciężki.",
    );
  });

  it("spells days of the month with the year", () => {
    expect(spellYears("1 sierpnia 1944 roku")).toBe(
      "pierwszego sierpnia tysiąc dziewięćset czterdziestego czwartego roku",
    );
  });

  it("leaves other numbers alone", () => {
    expect(spellYears("linia 25 i 50000 osób")).toBe("linia 25 i 50000 osób");
  });

  it("takes three digits for a year only before „rok” and skips counted amounts", () => {
    expect(spellYears("Solidarności 171")).toBe("Solidarności 171");
    expect(spellYears("w 966 roku")).toBe("w dziewięćset sześćdziesiątym szóstym roku");
    expect(spellYears("1500 osób i 2000 m²")).toBe("1500 osób i 2000 m²");
    expect(spellYears("numer 1200")).toBe("numer 1200");
    expect(spellYears("liczba 3,1415")).toBe("liczba 3,1415");
  });
});

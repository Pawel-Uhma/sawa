import { describe, expect, it } from "vitest";
import { isDryFact } from "./dry-facts";

// Real lines from the places table (17.10).
describe("isDryFact", () => {
  it.each([
    "Budynek z adresem al. „Solidarności” 171 ma w OSM 10 kondygnacji i charakter biurowy (building=office; źródło adresu: GUGiK, ref B210120).",
    "W sąsiedztwie, na tej samej ulicy, w OSM są pod adresami 169 i 173 budynki biurowe i punkty usługowe.",
    "Projekt architektoniczny opracowała pracownia Kuryłowicz & Associates, projekt konstrukcji i instalacji – Buro Happold, a generalnym wykonawcą budynku była firma Skanska S.A.; komercjalizacją zajmuje się Skanska Property Poland.",
    "Kompleks ma docelowo składać się z trzech obiektów: dwóch zrealizowanych, mniejszych budynków B i C (9 kondygnacji naziemnych, w kształcie litery H) oraz wieżowca o wysokości 130 m.",
    "Całkowita powierzchnia biurowa to 70 000 m²; powierzchnia najmu I etapu to ok. 12 300 m², a I etap dostarczy 86 miejsc parkingowych.",
    "Budynek ma dziewięć kondygnacji nadziemnych i dwie podziemne.",
    "Siedmiokondygnacyjny biurowiec oferuje na wynajem około 15 200 m2 powierzchni biurowej.",
    "Inwestorem była spółka LC Corp S.A.; budowę zakończono w październiku 2013 roku, a oficjalne otwarcie nastąpiło 5 listopada 2013 roku.",
    "Projektantem budynku był Wojciech Jankowski, a generalnym wykonawcą spółka Progress, JKM Designs.",
    "W 2020 działało tam 130 sklepów, punkty usługowe oraz 11 restauracji i barów.",
    "Godziny otwarcia według miasta: pon.–pt. 17:00–20:00, sob.–niedz. 09:00–15:00.",
    "Wpisany do rejestru zabytków (nr 858/11).",
    "W latach 1993–1999 wybudowano łącznie 11 budynków wielorodzinnych oraz 111 garaży wolnostojących.",
    "Osiedle zostało wybudowane w latach 1998–2000 według projektu pracowni Sołtyk & Sołtyk Architekci Sp. z o.o.",
    "Obiekt widoczny dziś w tym miejscu; w Google Maps opisany jako „Mural Wolska” (Obiekt kultury).",
  ])("drops developer and catalogue data: %s", (text) => {
    expect(isDryFact(text)).toBe(true);
  });

  it.each([
    "W trakcie budowy I etapu odkryto zabytkowe przedmioty: butelkę z browaru Haberbusch und Schiele, 3 grosze z okresu Księstwa Warszawskiego oraz zabawki i maszynę do szycia w pozostałościach XIX- i XX-wiecznej zabudowy.",
    "Uszkodzony: W 1944 r. kościół został poważnie uszkodzony. Po wojnie wspólnota rozpoczęła etapową odbudowę.",
    "Inwestorem mostu był podskarbi wielki koronny Adam Poniński, który za wybudowanie przeprawy miał prawo przez 10 lat pobierać opłaty mostowe.",
    "Posiadała pięć kondygnacji z elewacją podzieloną doryckimi pilastrami, które tworzyły pseudoportyk.",
    "Biurowiec ma 65 metrów wysokości i 17 kondygnacji.",
    "Budynek przypominający wielki głaz polodowcowy zaprojektowała eM4 Pracownia Architektury Brataniec.",
    "Najbardziej charakterystycznym elementem dwukondygnacyjnego, pięcioosiowego budynku jest monumentalny portyk zwieńczony frontonem.",
    "Galeriowiec zaprojektowali w latach 1963–1969 architekci Oskar Hansen i Zofia Garlińska-Hansen.",
    "Kercelak był największym bazarem Warszawy.",
  ])("keeps lines with a story or a look from the street: %s", (text) => {
    expect(isDryFact(text)).toBe(false);
  });
});

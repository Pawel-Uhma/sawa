import type { PlaceKind } from "@sawa/shared";
import { isDryFact } from "../domain/dry-facts";
import type { Place } from "../domain/place";

/** How the search names each kind, so a mural called "David Bowie" is not the singer's biography. */
export const KIND_PL: Record<PlaceKind, string> = {
  building: "budynek",
  monument: "pomnik",
  plaque: "tablica pamiątkowa",
  street: "ulica",
  site: "miejsce",
  mural: "mural",
  event: "wydarzenie",
  church: "kościół",
  cemetery: "cmentarz",
};

/** Facts already in the seed that go into the query to point the search at the right place. */
const HINT_FACTS = 2;

/** What the model does with the pages the web search found (T-41: stories, not an encyclopedia). */
export const RESEARCH_SYSTEM_PROMPT = `Zbierasz materiał do krótkiego odcinka podcastu o miejscu w Warszawie, które słuchacz mija w tramwaju. W podcaście liczą się historie i ciekawostki, nie encyklopedia.

Z wyników wyszukiwania wybierz:
- historie: konkretne zdarzenia, anegdoty, losy ludzi, legendy, spory, to, jak coś powstało i dlaczego;
- ciekawostki: zaskakujące szczegóły, związki ze sławnymi osobami, rzeczy, o których mało kto wie.
Jeśli miejsce jest poświęcone osobie albo wydarzeniu (mural, pomnik, tablica, ulica jej imienia), weź też to, co łączy tę osobę lub wydarzenie z Warszawą i z tym miejscem.

Jeśli miejsce jest zwyczajne (biurowiec, blok, osiedle, parking, centrum handlowe, budynek bez własnej historii), nie opisujesz samego budynku, tylko szukasz innego kąta i bierzesz go tylko wtedy, gdy podaje go strona:
- co stało tu wcześniej: dawna zabudowa, fabryka, bazar, dworek, ogrody, to, co działo się tu w getcie, w powstaniu albo w 1944 roku, co odkryto przy budowie;
- skąd nazwa ulicy, placu albo okolicy;
- znane wydarzenie w tym miejscu albo sławna osoba, która tu mieszkała, pracowała albo coś zrobiła;
- ciekawy detal widoczny z ulicy (rzeźba, mural, nietypowy kształt, coś, co zostało z dawnego budynku).
Jeśli żadnego takiego kąta nie ma, zwracasz pustą listę. Dane dewelopera o budynku to nie jest materiał.

Test dla każdej pozycji: czy ktoś, kto mieszka w Warszawie od lat, powiedziałby „serio? nie wiedziałem”? Jeśli nie, pomijasz ją. Lepiej dwie mocne pozycje niż sześć przeciętnych.

Pomijasz:
- suche dane: wymiary, powierzchnię (biurową, najmu, użytkową, w metrach kwadratowych), liczbę kondygnacji, miejsca parkingowe, etapy inwestycji, koszty, numery uchwał, daty remontów i modernizacji, nagrody, godziny otwarcia, ceny, dane kontaktowe;
- sąsiednie adresy i numery budynków, „punkty usługowe”, listy firm i najemców, opisy z map i katalogów (OpenStreetMap, Google Maps);
- oczywistości i opisy, które pasują do wielu miejsc: że park jest zielony i ma alejki, że boisko służy do gry, że kościół jest parafią, że budynek jest mieszkalny, że miejsce jest popularne, lubiane, chętnie odwiedzane albo dobrze skomunikowane;
- to, co wynika z samej nazwy albo rodzaju miejsca, i ogólnikowe zdania z folderów („ważne miejsce na mapie Warszawy”, „świadek historii”, „tętni życiem”);
- nazwy firm, pracowni architektonicznych, biur projektowych, wykonawców, inwestorów i deweloperów (projektanta bierzesz tylko wtedy, gdy jest sławny i wiąże się z nim historia);
- inne miejsca o tej samej nazwie i ogólne biografie bez związku z Warszawą.

Słuchacz patrzy przez okno, więc weź też jedną pozycję o tym, jak miejsce wygląda z ulicy i kiedy powstało (rok budowy, kolor, kształt, charakterystyczny detal, wysokość tylko wtedy, gdy wyróżnia miejsce w okolicy), jeśli strona to podaje. Ta jedna pozycja nie musi przejść testu „serio?”, ale nie może być samą liczbą pięter ani metrów. Dla zwyczajnego budynku jej nie bierzesz, jeśli nic ciekawego nie zostało.

Każda pozycja to jedno do trzech zdań po polsku, konkretnie: kto, co, kiedy i dlaczego to ciekawe. Piszesz tylko to, co stoi na stronie, z której ją bierzesz. Jeśli strona mówi „podobno”, „według legendy” albo że fani się spierają, zachowujesz tę ostrożność. Najciekawsze dajesz pierwsze, najwyżej 6 pozycji. Jeśli nic ciekawego nie ma, zwracasz pustą listę.

Odpowiadasz samym JSON-em: {"findings": [{"text": "…", "url": "adres strony, z której to wziąłeś"}]}`;

/** The user turn is also the search query: the place, where it is, and what is known. */
export function researchQuery(place: Place): string {
  const where = [place.addressToday, "Warszawa"].filter(Boolean).join(", ");
  // Office space and map tags would point the search at the developer's brochure.
  const hints = place.facts
    .filter((f) => !isDryFact(f))
    .slice(0, HINT_FACTS)
    .join(" ");
  return [
    `${place.name} (${KIND_PL[place.kind]}), ${where}: historia, anegdoty i ciekawostki.`,
    place.kind === "building" &&
      "Jeśli budynek jest zwyczajny: co stało tu wcześniej, skąd nazwa ulicy, kto tu mieszkał, co się tu wydarzyło.",
    hints && `Wiadomo: ${hints}`,
  ]
    .filter(Boolean)
    .join("\n");
}

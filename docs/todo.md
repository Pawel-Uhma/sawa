# Todo zespołu

**Ostatnia aktualizacja:** 17.10.2026, ok. 19:30

**Źródło prawdy dla zadań.** Każdy agent i każda osoba czyta tę listę przed pracą i aktualizuje ją po pracy.

## Legenda

- `- [ ]` do zrobienia
- `- [~]` w toku: dopisz kto i od kiedy, np. `(Antek, od 12:10)`
- `- [x]` zrobione: dopisz godzinę, np. `(Janek, 13:05)`
- Tag roli na końcu linii (`R1`–`R4`, `Wszyscy`; dawne zadania R5 ma R2): kto odpowiada. Pełna lista ról w [zespol.md](zespol.md).
- Terminy to plan z [06-plan-dnia.md](06-plan-dnia.md). Zadanie po terminie oznacz w `stan.md` jako zablokowane.

## Start i wspólne (sobota 17.10)

- [x] **T-08** Każdy wpisuje swój `git user.name` i rolę w [zespol.md](zespol.md), zanim zacznie pracę — `Wszyscy` — 11:45 (16:40: wszyscy czworo w tabeli; hook czyta też rolę z dopiskiem, PR #31)
- [ ] **T-03** Każdy ma token API dane.um.warszawa.pl w `.env.local` (nie w git); klucz jest na Discordzie zespołu — `Wszyscy` — 11:30
- [ ] **T-09** Konta: GitHub (repo), Vercel, dostęp do LLM — `Wszyscy` — 12:00
- [ ] **T-02** Projekt Supabase na koncie zespołu (nie prywatnym); kto zakłada, do potwierdzenia — `R2` — 13:00
- [x] **T-04** Monorepo: pnpm, `apps/web` (Next 16), `apps/api` (Hono, `/health`), `packages/shared`, Biome, Vitest, CI w GitHub Actions — `R3` — (Szczepan, 12:05; projekty Vercel i Railway jeszcze nie założone)
- [x] **T-62** Projekt Railway dla `apps/api`, deploy `/health`, zmienne env, CORS dla Vercela — `R1` — 13:30 (zrobił Paweł z agentem na swoje polecenie, 13:20: https://api-production-d213.up.railway.app; Dockerfile i `railway.json` od Szczepana w PR #15)
- [ ] **T-63** Kontrakt v0 w `packages/shared` (§5 planu MVP): `Place`, `Route`, `Story` i reszta, zatwierdzony na synchronizacji — `Wszyscy` — 13:30
- [ ] **T-64** Każdy czyta [11-zasady-pracy-i-kodu.md](11-zasady-pracy-i-kodu.md) i zgłasza w `stan.md` niezgodę z założeniami [Z] z [12-plan-mvp.md](12-plan-mvp.md) §11 — `Wszyscy` — 12:30
- [ ] **T-01** Sprawdzić API Bielika (gdzie, limity, szybkość); wybrać zapasowy LLM — `R4` — 13:00

- [x] **T-65** Mapa: Mapbox (styl i renderer), decyzja R3, 17.10 — `R3` — 13:00 (zmienione 13:40, decyzja Antka: MapLibre + OpenFreeMap, bez tokenu; [14-plan-mapy.md](14-plan-mapy.md) §2)
- [x] **T-69** Zasady pracy z repo (dawne T-62 Pawła): pokryte przez [11-zasady-pracy-i-kodu.md](11-zasady-pracy-i-kodu.md) — `Wszyscy`

## R1 · Dane i planer tras

- [x] **T-19** Planer bierze miejsca z Supabase (`PlacesRepository.listInBBox`) zamiast z `apps/api/data/places.geojson`, żeby nowe miejsca z T-25 trafiały do tras bez eksportu pliku — `R1` — 17:00 (Szczepan, 14:38, PR #17)
- [x] **T-65** Pętla z powrotem do startu (`returnToStart`, PR #9) i kształt odcinka do ostatniego przystanku (PR #11) — `R1` — (Szczepan, 13:58)
- [x] **T-66** Wybór punktu końcowego trasy (`destination`, `endsAtDestination`) — `R1` — (Szczepan, 14:40, PR #19)
- [x] **T-76** Odjazdy z rozkładu ZTM dla każdego odcinka trasy, także przesiadek, `Leg.realDeparture` w kontrakcie — `R1` — (Szczepan, 15:00, PR #19; z prawdziwym tokenem do sprawdzenia w T-17)
- [x] **T-77** Odpowiedzi z onboardingu w planerze: znajomość miasta, styl opowieści; web wysyła je z `planRoute` — `R1` — (Szczepan, 16:30, PR #22; 17:20 bez kafelków `tags`, front ma tylko 4 kategorie)
- [x] **T-78** Pamięć słuchacza (opowiedziane fakty i tło w telefonie, `heard` w planerze, `heardFacts`/`knownContexts` w opowieściach) i onboarding z 4 kategoriami — `R3` — (Paweł z agentem, 16:40; zmiana w `score.ts` R1 na polecenie Pawła, zaakceptowana przez Szczepana 16:54)
- [x] **T-79** Trasy od 5 min i odcinki piesze (`Leg.mode` `walk`, spacer poniżej 30 min, dojścia do i z przystanków) — `R1` — (Szczepan, 17:50, PR w toku)
- [x] **T-10** Adapter `apps/api/src/adapters/waw` (przystanki, linie, odjazdy) z cache w pamięci i fixtures z curl — `R1` — 15:00 (do przeglądu: mapa bierze miejsca z `/v1/places`, planer jedzie na GTFS, w MVP może zostać tylko odjazdy z T-17) (Szczepan, 19:40: niepotrzebne; planer jedzie na GTFS, z API miasta zostały odjazdy (T-76) i pozycje pojazdów (T-99))
- [x] **T-15** Skąd kolejność przystanków linii (GTFS / stare API / kształt z pozycji pojazdów), decyzja w `stan.md` (P1 w planie MVP) — `R1` — 13:30 (Szczepan, 13:15: GTFS z mkuran.pl, skompresowany do pliku w repo)
- [x] **T-16** Mock `POST /v1/routes/plan` z fixture zgodnej z kontraktem, żeby R3 i R4 nie czekali — `R1` — 14:30 (Szczepan, 13:20, PR #2; od 14:00 zastąpiony prawdziwym planerem)
- [x] **T-11** Odjazdy z przystanku i linie na przystanku (endpointy z [api/](api/)) — `R1` — 15:00 (Szczepan, 19:40: niepotrzebne, odjazdy są w planerze (T-76))
- [x] **T-13** Planer: trasa z przesiadkami, czas 30 min – 4 h, lista punktów — `R1` — 22:00 (Szczepan, 14:00: GTFS + beam search, podgląd `/debug/planner`, PR #4)
- [x] **T-17** `WAW_TOKEN` w `apps/api/.env.local` i na Railway, sprawdzić odjazdy na żywo (format odpowiedzi API nie był testowany z tokenem) — `R1` — 17:00 (Szczepan, 15:40: lokalnie działa; API zwraca gołą tablicę wierszy, nie `{ result }`, poprawka parsera w PR; zostało: `WAW_TOKEN` na Railway) (19:40: token na Railway jest, ale każde zapytanie z produkcji do API miasta pada: `/v1/vehicles/track` daje `live: true, stale: true`, odjazdy szacowane; lokalnie ten sam kod działa. Sprawdzić w logach Railway „vehicle positions failed”: HTTP 500 = zła wartość tokenu, „did not answer” = sieć; po poprawce restart, bo pusty wynik odjazdów jest w cache 1 h) (spotkanie 19:30: `WAW_TOKEN` dodany na Railway, wcześniej zmienna miała inną nazwę)
- [x] **T-119** Długość opowieści dopasowana do czasu jazdy do następnego miejsca + zegar jazdy (następny temat przy następnym miejscu, nie zaraz po końcu opowieści), [12-plan-mvp.md](12-plan-mvp.md) §8 — `R4`/`R3` (zrobił Jasiek na polecenie użytkownika) — (Jasiek z agentem, 20:30)
- [x] **T-113** Trasa kończy się dziwną pętlą (zgłaszane kilka razy przy teście) — `R1` — (Szczepan, PR #52: planer karze powrót tą samą drogą)
- [~] **T-18** Przed demo: przebudować graf na niedzielę (`pnpm --filter @sawa/scripts transit --date 2026-10-18`) i zapisać trasę demo jako fixture do trybu offline — `R1` — niedziela 08:00 (Szczepan z agentem, 22:20: grafy na 7 dni i przełączanie o północy w gałęzi `r1/transit-multi-day`; fixture trasy demo zostaje)
- [ ] **T-153** Własny OSRM (profil pieszy, Warszawa) w kontenerze `api` obok API, `WALK_ROUTER_URL=http://127.0.0.1:5000` (PR #121). Bez planera na ścieżkach OSRM z #108: planowanie spaceru zostaje jak na `main` (decyzja Szczepana); RAM ok. 250–400 MB dla samej Warszawy. Szczegóły: issue #118 — `R1` (zlecone Pawłowi przez Szczepana, zgoda na pliki R1)
- [x] **T-99** Pojazdy na żywo pod mapę: pojazd użytkownika + po jednym przed i za nim, tor do płynnej animacji, prędkość z przejazdu poprzednika tej samej linii; `POST /v1/vehicles/track`, kontrakt w `packages/shared/src/schemas/vehicles.ts`. Opis: [15-pojazdy-na-zywo.md](15-pojazdy-na-zywo.md) — `R1` (zrobił Jasiek na prośbę użytkownika, gałąź `r1/live-vehicles`) — (Jasiek, 16:30; na Railway potrzebne `WAW_TOKEN` (T-17) i w dniu demo `VEHICLES_ALWAYS_ON=1`, wpisane w [przed-demo.md](przed-demo.md))

## R2 · Baza i historia

- [x] **T-20** Schemat Supabase dla miejsc: punkt, opis, źródła, zdjęcia, licencja, wersja EN — `R2` — 13:00 (Jasiek, 13:10: migracje w bazie)
- [x] **T-21** Załadować [historia/sawa-historia.geojson](historia/sawa-historia.geojson) do Supabase skryptem (nie ręcznie) — `R2` — 15:00 (Jasiek, 13:08: 326 miejsc i 351 zdjęć w bazie, `pnpm --filter @sawa/scripts seed:historia`)
- [x] **T-22** Sprawdzić licencje zdjęć w [historia/zdjecia.json](historia/zdjecia.json), odfiltrować te bez licencji — `R2` — 17:00 (Jasiek, 12:55: na razie pomijamy licencje, użytek własny; wgrywamy wszystkie zdjęcia z polem licencji)
- [x] **T-24** Port `PlacesRepository` + adapter Supabase (RPC, zod, timeout 5 s) + `fake` na 5 miejscach; trasy `/v1/places` czekają na kontrakt `Place`/`PlaceSummary` w `packages/shared` — `R2` — (Jasiek, 13:24)
- [x] **T-26** `GET /v1/places?bbox=&interests=` (GeoJSON dla MapLibre) i `GET /v1/places/:id` (pełne miejsce dla opowieści), kontrakt w PR #6; na Railway potrzebne `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` (R1), bez nich API daje 5 miejsc z fake — `R2` — (Jasiek, 13:38)
- [x] **T-25** Oznaczyć miejsca kategoriami, które wybiera użytkownik: `historical`, `cultural`, `sports`, `nature` (kolumna `places.interests`). Szczegóły w karcie [R2](role/R2-baza-i-historia.md#kategorie-zainteresowań-od-1710-1430). Najpierw `sports` i `nature`, bo dziś mają 0 miejsc. Po zmianie: seed i `pnpm --filter @sawa/scripts export:places` (plik dla planera) — `R2` — 17:00 (Jasiek, 14:08: +102 miejsca z OSM w `docs/historia/osm-sport-przyroda.geojson`, reguły sport/przyroda po nazwie; w bazie 428 miejsc: historia 242, kultura 113, sport 33, przyroda 75; seed i `export:places` zrobione)
- [x] **T-27** Sport ze zbioru miasta „Otwarte boiska” (`docs/api/otwarte-boiska.md`): pobrać, zgeokodować adresy, dopisać do `osm-sport-przyroda.geojson` lub osobnego pliku w `historia/sources.ts`; potrzebny token dane.um.warszawa.pl w `.env.local` (`WAW_TOKEN`) — `R2` — 19:00 (Jasiek, 14:30: 57 szkół w obszarze tras w `docs/historia/um-otwarte-boiska.geojson`, `fetch:boiska`; sport w bazie 90 miejsc, łącznie 485)

## R3 · Frontend i mapa

- [ ] **T-123** Tryb dla dzieci: przełącznik w onboardingu, pole `audience` w kontrakcie, prostsza opowieść Sawy (dalej tylko z faktów), delikatnie o miejscach wojennych; pomysły dodatkowe w issue ([#65](https://github.com/Pawel-Uhma/Sawa/issues/65)) — `R3` (Paweł; prompt to obszar R4)
- [x] **T-128** Interfejs po angielsku: przełącznik Polski / English w menu i na ekranie powitalnym, `features/i18n` (`useT`, `pick`), wybór w localStorage — `R3` (Paweł, 17.10, 19:10)
- [ ] **T-129** Opowieści i głos po angielsku: pole `lang` w `StoryRequest` (kontrakt), prompt i TTS w języku interfejsu; web wyśle `useLang()` po dodaniu pola — `R4` (prompt) + `R3`

- [x] **T-110** Cel trasy: najpierw najszybsza droga (`destination` bez `durationMin`), suwak od jej `totalMin` ([#43](https://github.com/Pawel-Uhma/Sawa/issues/43)) — `R3` (Szczepan na prośbę użytkownika, 17:50: gałąź `r3/fastest-and-departures`, czeka na PR)
- [x] **T-111** Godziny odjazdów: rozkład vs „ok.”, opóźnienie `delaySec`, podpis z `attribution` ([#44](https://github.com/Pawel-Uhma/Sawa/issues/44)) — `R3` (Szczepan na prośbę użytkownika, 17:50: gałąź `r3/fastest-and-departures`, czeka na PR)
- [x] **T-30** Mapa MapLibre z jednym zbiorem punktów (miejsca z `/v1/places`, nie z T-10) — `R3` — 13:00 (Antek, 16:40; plan w [14-plan-mapy.md](14-plan-mapy.md); `/mapa` z kartą miejsca i trasą PR #12, API `SawaMap` dla ekranów PR #16, miejsca z kafelków widoku na całą Warszawę PR #27)
- [x] **T-119** Ciemny motyw: przełącznik Jasny / Ciemny / Auto w menu Sawy, ciemna mapa i karta miejsca, syrenka bez białych pól pod pachami, ciemna ikonka — `R3` — (Antek, 17:05; numer zmieniony z T-105, który był zajęty)
- [x] **T-121** Sawa nie mówi od razu po wyznaczeniu trasy: czeka na pierwsze miejsce (zegar jazdy albo GPS w promieniu 150 m), stuknięcie w odtwarzanie startuje od razu — `R3` — (Szczepan na prośbę użytkownika, 18:11, gałąź `r3/wait-for-first-place`)
- [x] **T-120** Ekrany demo na tokenach zamiast `bg-white` i hexów, ciemny motyw w całej aplikacji (`.motyw` na `<body>`); rzeki i woda na mapie na niebiesko w obu motywach — `R3` — (Antek, 17:52, gałąź `r3/demo-tokens`)
- [x] **T-123** Tryb dla dzieci ([#65](https://github.com/Pawel-Uhma/Sawa/issues/65)): krok „Kto będzie słuchał?” w onboardingu i „Kto słucha” w menu, `audience: "adult" | "kids"` w kontrakcie opowieści i trasy, osobny prompt dla dzieci (prościej, krócej o 30%, pytanie albo „Wypatrz przez okno” na koniec, wojna delikatnie) — `R3` + `R4` — (Paweł z agentem, 18:20–18:45, gałąź `r3/kids-mode`; planer jeszcze nie używa `audience`, wolniejszy głos dla dzieci to następny krok)
- [x] **T-122** Przełącznik jasny / ciemny już w onboardingu: słońce / księżyc w prawym górnym rogu nagłówka (`ThemeToggleButton` z `features/theme`), „Auto” zostaje w menu Sawy — `R3` — (Antek, 18:13, gałąź `r3/onboarding-theme`)
- [x] **T-30b** Mapa w demo (ekran główny) z jednym zbiorem punktów — `R3` — 13:00 (Paweł z agentem, 13:51: prawdziwa mapa MapLibre + OpenFreeMap; 14:54: demo na `SawaMap` Antka, piny z `/v1/places`, trasa z `POST /v1/routes/plan`, zob. `stan.md`)
- [x] **T-66** Ekran główny według wariantu A (arkusz na mapie), mobile-first — `R3` — (Paweł z agentem, 17.10 13:25: mock bez API, mapa szkicowa zamiast Mapbox; 13:51: wariant A6 z makiety, Sawa z dymkiem, pasek zakładek, prawdziwa mapa)
- [x] **T-67** Wersja desktopowa (ten sam UI na szerokim ekranie) — `R3` — (Paweł z agentem, 17.10 13:25: panel boczny od 768 px, mock; 13:51: mapa na cały ekran, pływający szklany panel 360/400 px, kamera omija panel, skróty klawiszowe w trasie)
- [x] **T-31** Onboarding: ekran startowy i wybór ok. 3 zainteresowań — `R3` — (Paweł z agentem, 17.10 13:25: mock, lista 8 kluczy z 13-plan-bazy §5; 13:47: nowy przepływ z Sawą, 3 pytania i grafikami z fal.ai, [ui/onboarding.md](ui/onboarding.md); do podpięcia w demo-app przez sesję R3 od mapy)
- [x] **T-32** Slider czasu (30 min – 4 h) i przycisk „generuj” — `R3` — (Paweł z agentem, 17.10 13:25: mock)
- [x] **T-33** Widok trasy: lista punktów i odtwarzacz opowieści (pauza, przejście do następnego; „dalej” wg decyzji) — `R3` — (Paweł z agentem, 17.10 13:25: mock, tekst opowieści to placeholder, czeka na T-42; 14:50: odtwarzacz gra opowieść z API głosem ElevenLabs)
- [x] **T-35** Wersja mobilna: 16 px marginesu, bez poziomego scrolla — `R3` — 22:00 (Paweł z agentem, 13:51: arkusz trasy z 3 punktami zatrzymania i rzutem, swipe opowieści, sprężyny motion, safe area, reduced motion; sprawdzone 390–1920 px bez poziomego scrolla)
- [ ] **T-36** Podstrona demo: stała lokalizacja, symulowana jazda ok. 1,5 min — `R3` — niedziela 08:00
- [x] **T-105** Cel przejażdżki w UI: wybór punktu końcowego (stuknięcie w mapę albo karta miejsca) i `destination: { lat, lng }` w `planRoute` (`apps/web/src/features/demo/lib/api-data.ts`); przy `endsAtDestination: false` pokazać, że trasa nie kończy się przy celu. Bez `returnToStart` jednocześnie. API gotowe na Railway (PR #19) — `R3` — (zgłosił Szczepan, R1; już zrobione przez Pawła, commit `d8448f3`: przed siebie, wracam, do celu)
- [x] **T-106** Trasy piesze po ulicach i chodnikach zamiast linii prostej: geometria odcinków `walk` z OSRM (profil pieszy, FOSSGIS), przy awarii proste odcinki; czasy bez zmian — `R1` (zlecone Jaśkowi, R2, za zgodą R1) — (Jasiek z agentem, 16:57)
- [x] **T-107** Start przejażdżki z prawdziwej lokalizacji (GPS) z 42 Warsaw jako zapasem (brak zgody, poza Warszawą, w trakcie szukania); przełącznik „Skąd ruszamy” w menu Sawy, wybór w `localStorage` (`lib/start-point.ts`) — `R3` → `R1` — (zlecił Szczepan swojemu agentowi, 16:58, PR #40, zaakceptował Paweł, scalone 17:16)
- [x] **T-124** Sterowanie opowieścią (wariant A z podglądu): stop, wstecz, odtwarzanie, dalej, „więcej o miejscu” i suwak całej przejażdżki (`podcast-controls.tsx`, `seekTo` w zegarze jazdy, `restart` w odtwarzaczu); arkusz trasy ma dwa położenia: samo sterowanie nad mapą albo z zapisem opowieści. Zmienia decyzję R3 „bez poprzednia/następna” — `R3` → `R1` — (zlecił Szczepan swojemu agentowi, 18:39, PR #68, scalone 18:46; 19:03: pauza i stop zatrzymują też zegar jazdy, PR z `r1/clock-pause`)
- [x] **T-132** Spacer nie wraca tą samą ulicą: ostry zwrot (`turnBackM` w `walk-tour.ts`) liczy się jako droga z powrotem, a miejsca przy prostej linii powrotu nie dają punktów. Powtórzona droga 45–120 min: z 12–28% do 2–14% — `R1` — (Szczepan z agentem, 20:01, gałąź `r1/walk-loop`)
- [x] **T-131** Mapa trasy: pod kółkiem startu i każdej przesiadki nazwa przystanku z numerem słupka („Centrum 09”, dwie ostatnie cyfry id ZTM) i godzina wsiadania (czas warszawski, „ok.”, gdy szacowana); `route-to-geojson.ts`, `route-layer.tsx` — `R3` → `R1` — (zlecił Szczepan swojemu agentowi, 19:20, PR #84)
- [x] **T-104** Najszybsza trasa do celu: `POST /v1/routes/plan` z `destination` bez `durationMin`; trasa z czasem, która nie dojeżdża do celu, przechodzi na najszybszy przejazd — `R1` — (Szczepan, 19:10, PR w toku)
- [x] **T-108** Czasy na żywo: opóźnienie pierwszego pojazdu z pozycji (`Leg.delaySec`), podpis danych miasta w trasie, `/health` z datą grafu GTFS — `R1` — (Szczepan, 19:40, PR w toku)
- [x] **T-109** Słabe punkty planera: bez dobijania czasu czekaniem, przesiadki pieszo do 300 m, wiązka bez kopii — `R1` — (Szczepan, 19:40, PR w toku)
- [x] **T-100** Pojazdy na mapie trasy (PR, Paweł, 17.10, ok. 16:45): hook `useLiveVehicles` (co 10 s), osobne ikony tramwaju i autobusu, płynny ruch przez `positionOnTrack` w `requestAnimationFrame`, wyróżniony pojazd `ride`. Gotowe przykłady kodu w [15-pojazdy-na-zywo.md](15-pojazdy-na-zywo.md) — `R3` (Paweł, issue #30) — po T-99 (PR #29)
- [~] **T-101** Mapa: `fitBounds` trasy z uwzględnieniem otwartej karty miejsca (trasa chowa się pod kartą) i ostrzeżenie „Expected number, found null” w konsoli — `R3` (Antek, 16:55: karta doliczana do paddingu kamery, `paddingWithSheet`, gałąź `r3/fit-place-sheet`; ostrzeżenie zostaje)
- [~] **T-126** Drobniejsze znaczniki miejsc: `places.subkind` (35 podrodzajów, 8 kolorów grup), migracja, reguły w seedzie, ikony „Naklejka” — `R3` (Paweł z agentem, od 18:15; zmiana schematu R2 na prośbę Pawła, gałąź `r3/subkind`)
- [ ] **T-102** Pozycja „za oknem”: znacznik jedzie wzdłuż `Leg.lngLats` w czasie odtwarzania (krok 8 w [14-plan-mapy.md](14-plan-mapy.md) §10, M2 planu MVP); potrzebne do T-36 — `R3` (Antek) — niedziela 08:00
- [ ] **T-103** Mapa na 2 prawdziwych telefonach: karta miejsca z przeciąganiem, 16 px marginesu, bez poziomego scrolla (krok 7 w [14-plan-mapy.md](14-plan-mapy.md) §10) — `R3` (Antek)
- [x] **T-130** Podcast za lokalizacją: GPS przesuwa zegar jazdy Jaśka (T-119, `ride-clock.ts`) także po pierwszym miejscu (to robi T-121) — przy kolejnym punkcie trasy (`isAt`, 150 m, najwyżej 2 punkty do przodu, żeby pętla nie skoczyła na koniec) `syncTo` ustawia „jestem tutaj”; bez lokalizacji sam zegar. Przejścia w `story-player.ts`: przerwany temat cichnie, oddech 0,6 s po końcu, nowy wchodzi łagodnie (na iOS bez wyciszania, `volume` tylko do odczytu). Kod: `features/demo/lib/ride-sync.ts`. Zostaje: zdanie-pomost od Sawy w prompcie (`R4`); zegar idzie tylko do przodu, więc przy spóźnionym tramwaju temat może ruszyć przed punktem — `R3` (Antek, 18:13, issue #35; zastępuje PR #39)
- [x] **T-118** Mapa: przy oddaleniu punkty miejsc grupują się w kółka z liczbą punktów zamiast znikać (`cluster: true` w źródle, stuknięcie w kółko przybliża i rozbija grupę) — `R3` (issue #42) — (Antek z agentem, 17:42)
- [x] **T-125** Znaczniki miejsc na mapie od nowa (było T-119, numer zajęty): ilustracje były za drobne, zostaje wariant I „Naklejka” (pełny glif w kolorze grupy z białą obwódką, 5 kształtów, ok. 36 px przy zoomie 15) — `R3` (Paweł z agentem, 17:50 → 18:08)
- [ ] **T-115** Ekrany demo na tokeny kolorów (`bg-powierzchnia`, `bg-tlo-2`) zamiast `bg-white` i hexów, potem klasa `.motyw` na `<body>`, żeby ciemny motyw działał wszędzie (dziś w trybie jazdy syrenka ma ciemne pachy na jasnym tle) — `R3` (Paweł)
- [ ] **T-116** Usunąć „Przed siebie” z wyboru końca trasy (wywozi w przypadkowe miejsce); zostają „Wracam tu” i „Do celu” — `R3` (Paweł)
- [x] **T-117** „Do celu” ze startu z GPS nie wyznacza trasy; 5 min do odległego celu wysypało produkcję (powinien być najszybszy przejazd albo komunikat) — `R3` (Paweł) + `R1`; zrobione razem z T-110 (suwak nie schodzi poniżej najszybszej trasy, Paweł, 17.10 18:02)
- [ ] **T-112** Śledzenie lokalizacji na żywo: z pozycji użytkownika wybierać opowieść (`activeIndex` do ekranu „Na żywo”) — `R3` (Antek)
- [x] **T-119** Kolory według tematu (historia, kultura, sport, przyroda): kółko pod ikoną miejsca na mapie, chipy tematów w tych samych kolorach jako legenda; reguła dla miejsca z kilkoma tematami, kontrast AA w obu motywach ([#53](https://github.com/Pawel-Uhma/Sawa/issues/53)) — `R3` — (Paweł z agentem, 19:04 → 19:10)
- [x] **T-130** Ekran wyznaczania trasy wg propozycji 1900-A z suwakiem: mała Sawa w nagłówku karty zamiast dużej z dymkiem, podpisane przełączniki „Jak jedziesz” i „Gdzie kończysz”, przycisk „Wyznacz pętlę” / „Wyznacz trasę do celu”. Bez paska zakładek: Przejażdżki i Sawa w menu pod logo, a gdy Sawa mówi poza trasą, pigułka „Sawa opowiada” w prawym górnym rogu (`sawa-speaking.tsx`); panele mają przycisk powrotu na mapę — `R3` — (Paweł z agentem, 19:05–19:25)
- [x] **T-131** Stany czekania w całej aplikacji (`components/waiting.tsx`: spinner jak w iOS, szkielet z połyskiem, pigułka statusu, komunikat zmieniający się z czasem): zasłona „Wczytuję mapę Warszawy…”, przycisk „Wyznacz” mówi, co robi planer, i przyznaje, gdy trwa długo; spinner przy najszybszej drodze, wyszukiwaniu celu i szukaniu lokalizacji; pigułka „Szukam miejsc w okolicy…” / błąd z „Ponów” u góry mapy; w odtwarzaczu „Sawa szykuje opowieść” i pierścień wokół play, szkielet tekstu z krokami (fakty → opowieść → głos); karta miejsca ze szkieletem i zamykaniem, spinner w „Posłuchaj”, zdjęcia wjeżdżają po wczytaniu; podgląd przejażdżki ze szkieletem. Reduced motion zatrzymuje połysk — `R3` — (Paweł z agentem, 19:10–19:35)
- [x] **T-149** Mapa: puste kółka bez ikon i za duże ikony miejsc ([#90](https://github.com/Pawel-Uhma/Sawa/issues/90)). Obwódki tematu nie ma już na main (19:30), więc kółko bez ikony nie wraca; `ICON_SIZE` mniejsze (ok. 24 px przy zoomie 15 zamiast 36), obwódka zaznaczenia rośnie z zoomem — `R3` — (Paweł z agentem, 20:10–20:15)
- [x] **T-60** Pierwszy deploy na Vercel — `R3` — 22:00 (Paweł, 13:20: https://sawa-hackathon.vercel.app; auto-deploy z GitHuba czeka na dostęp aplikacji Vercel do repo)
- [x] **T-150** Mapa: punkty znów grupują się w klastry z liczbą przy oddaleniu (usunięte w `17d8870`/`578b21d`; jeśli celowo, powód do `stan.md`) ([#101](https://github.com/Pawel-Uhma/Sawa/issues/101)) — `R3` (Paweł) — (Paweł z agentem, 20:45–21:10: `cluster: true`, szklane kółko z liczbą, stuknięcie przybliża i rozbija grupę)
- [x] **T-151** Mapa: jedno źródło koloru punktu, zgodne z chipami tematów, plus zwijana legenda kolor → kategoria ([#102](https://github.com/Pawel-Uhma/Sawa/issues/102)) — `R3` (Paweł) — (Paweł z agentem, 20:45–21:10: glif podrodzaju w kolorze tematu, rysowany w przeglądarce; legenda pod zoomem; paleta grup rodzajów usunięta); 21:35 Paweł: ikony wracają do kolorów grup rodzajów, legenda pokazuje grupy
- [x] **T-152** Wyszukiwanie celu: stara odpowiedź bez ulicy przez cache ([#107](https://github.com/Pawel-Uhma/Sawa/issues/107)). Cache HTTP `private, max-age=60`, w web `staleTime` 5 min; adapter zwraca `partial`, gdy Autocomplete/Place Details padnie, i loguje `logger.warn` ze statusem Google; serwis nie cache'uje `partial`, TTL 1 h — `R3` — (Paweł z agentem, 20:55–21:05)
- [x] **T-154** Mapa: ulica zostaje ikoną, ale po kliknięciu (na desktopie też po najechaniu) podświetla się cała jej linia z kafelków OpenFreeMap (`transportation_name`, filtr po nazwie); propozycje w `ui/propozycje/html/ulice-jako-linie.html` — `R3` (Paweł z agentem, 21:20)
- [x] **T-155** Mapa: jeden ruch kamery przy pierwszym kliknięciu miejsca ([#117](https://github.com/Pawel-Uhma/Sawa/issues/117)). Zanim dojdzie pozycja miejsca, kamera stoi (`{ type: "stay" }`), zamiast wracać na start; logika w `demo/lib/screen-camera.ts` z testami — `R3` (Paweł) — (Paweł z agentem, 22:13, gałąź `r3/camera-one-move`)
- [x] **T-156** Spacer w pętli wraca po okręgu, nie tą samą ani równoległą ulicą ([#131](https://github.com/Pawel-Uhma/Sawa/issues/131)): beam search w `walk-tour.ts` dla pętli (koniec ≤ 50 m od startu) dolicza `loopRoundnessBonus` (2) × `roundness` (4π·pole/obwód², 1 dla koła, 0 dla tam i z powrotem); `pickWalkOnPaths` to samo na ścieżce OSRM. Spacery do celu bez zmian — `R1` → `R3` (zlecił Szczepan, zgoda na pliki R1) — (Paweł z agentem, 22:45, gałąź `r3/loop-walk`)
- [x] **T-157** Opowieść jak przewodnik: najpierw gdzie patrzeć i co widać („Po lewej stronie widzimy…”), nazwa miejsca na głos (słuchacz nie patrzy w telefon), jedna historia z otwartym pytaniem; bez firm, pracowni, wykonawców i inwestorów. Pole `side` w `StoryRequest`, web liczy stronę z geometrii odcinka (`demo/lib/side.ts`) — `R3` + `R4` (prompt R4, na prośbę Pawła) — (Paweł z agentem, 22:40, gałąź `r3/prompt-przewodnik`)
- [x] **T-158** Karta miejsca bez surowego markdownu w faktach ([#135](https://github.com/Pawel-Uhma/Sawa/issues/135)): `demo/lib/fact-markup.ts` tnie fakt na fragmenty `<strong>`/`<em>`/tekst (bez HTML z danych), usuwa dwukropek po etykiecie (`**BUDOWA:**:` → **Budowa:**), escape’y (`\-`, `\[`) i formułkę po `* * *`; testy na przykładach z produkcji. `features/map/place-sheet.tsx` (Antek) i prompt opowieści bez zmian — `R3` (Paweł z agentem, 22:50, gałąź `r3/facts-markdown`)
- [~] **T-159** Spacer „Wracam tu” jako kwadrat z ciekawych miejsc; liczy się kształt i miejsca, czas luźno (±25%). Bok z budżetu (4 × bok × 1,3 przy 1,2 m/s; też 0,85 i 0,7 boku), 16 obrotów, przy każdym rogu do 3 najlepszych miejsc w promieniu 0,4 boku albo goły róg, boki zaginane przez najciekawsze miejsca do 60 m (`walkThrough`, do +20%), kwadratowość ≥ 0,7 (`planSquareLoops`, `walk-tour.ts`). `walkFor` w `plan-route.ts` mierzy 3 różne najlepsze pętle na prawdziwych ścieżkach naraz i bierze najlepszą wg miejsc przy ścieżce i kształtu (`loopObjective`, `scoreAlongPath`); gdy żadna nie mieści się w ±25%, przesuwa gołe rogi (`resizeLoop`) albo planuje od nowa. Premia `roundness` z T-156 usunięta; spacery do celu bez zmian — `R1` (Szczepan z agentem, od 23:00, gałąź `r1/square-loop`)
- [x] **T-160** Muzyka w tle podczas jazdy: dwa utwory generowane w przeglądarce (Web Audio, bez plików i licencji): „Lo-fi w tramwaju” (84 BPM) i „Puls miasta” (100 BPM), na przemian co 2,5–5 min, zmiana pod głosem Sawy. Cichnie do 20%, gdy Sawa mówi, wraca w przerwach; gra przez całą trasę, pauza Sawy ścisza też ją; przełącznik „Muzyka w tle” w menu (domyślnie włączona). `demo/lib/ride-music.ts` (utwory, reguły, testy), `ride-music-player.ts` (dźwięk); pliki R3 na polecenie Jaśka — `R2` (Jasiek z agentem, 23:50, gałąź `r2/ride-music`)
- [x] **T-161** Zapis opowieści nie wraca sam do głosu przy przewijaniu (#146): odpina go tylko przewinięcie przez użytkownika (palec, mysz/pasek, kółko, klawisze), nasze `scrollTo` nie; przypina „Wróć do Sawy” albo koniec gestu z granicą słów z powrotem na jej wysokości (nie w trakcie gestu ani bezwładności). `demo/lib/transcript-follow.ts` (reducer, testy), `route-live.tsx` — `R3` (Paweł z agentem, 23:54, gałąź `r3/transcript-scroll`)

## R4 · AI i głos

Paweł robi frontend i generowanie głosu (T-43). Opowieści (T-45, T-41, T-42) nie mają jeszcze właściciela, zob. `stan.md`.

- [~] **T-45** Port `LlmProvider` z implementacjami `bielik`, `claude`, `fake` i `POST /v1/stories` z `story_cache` — `R4` — 17:00 (Paweł, 14:50: w `main` OpenRouter + `POST /v1/stories` i `/v1/stories/audio`, cache w pamięci; Bielik i `story_cache` w Supabase jeszcze nie)
- [ ] **T-41** Prompt Sawy: persona rówieśniczki, która mieszka w Warszawie rok, zasady „fakty ze źródłami, bez zmyślania” — `R4` — 20:00
- [ ] **T-42** Opowieść „z okna”: tekst o punkcie na trasie z faktów z Supabase; długość zależna od czasu do punktu — `R4` — 22:00

## R2 · Produkt, pitch i QA (dawna R5)

- [ ] **T-50** Scenariusz demo 1,5 min (ścieżka z [10-prd.md](10-prd.md)) i tekst pitcha 5 min — `R2` — 15:00
- [ ] **T-51** Zaktualizować pitch deck w [pitch/](pitch/) pod MVP — `R2` — 22:00
- [ ] **T-52** Test na telefonie co 2 h: wszystkie ścieżki z PRD, zgłoszenia w tym pliku (robią wszyscy na zmianę, R2 pilnuje) — `R2` — od 17:00
- [ ] **T-55** Nagranie wideo demo jako zapas: nagrywamy ludzi używających aplikacji, nie sam ekran; montaż po działającym deployu — `R2` — dziś w nocy albo jutro rano (spotkanie 17.10 wieczór)
- [~] **T-126** Trasa pieszo: zahaczać o punkty (nie linia prosta do nich w przecznicy) i nie wracać tą samą drogą — `R1` (Szczepan z agentem: miejsca dobierane wzdłuż wybranej ścieżki OSRM, PR #100 zmergowany; planowanie ścieżki bez zmian, PR #108 zamknięty na prośbę Szczepana; zostaje test na telefonie po deployu; własny OSRM w kontenerze `api` zmergowany w #121 (T-153), planer na ścieżkach OSRM z #121 cofnięty, czeka na `WALK_ROUTER_URL` na Railway i redeploy) — przed testem na telefonie
- [ ] **T-127** Sub-kind miejsc w bazie (np. budynki, instytucje), każdy typ z własną ikoną; wpływ na schemat i ikony — `R2` (Jasiek, do potwierdzenia) — przed zamrożeniem
- [ ] **T-114** Pitch pod „Warszawa 2076” według uwag mentorów (spotkanie 19:30): kto jest odbiorcą, co miasto zyska za 50 lat, dowód, że dane miasta dają wartość; sprawdzić źródło liczby „20% warszawiaków spoza Warszawy”; z gotową prezentacją do Bartka (Play) — `R2` (z T-50). Plan: [pitch/plan-pitchu.md](pitch/plan-pitchu.md) (Paweł, 17.10 w nocy), zadania w §10
- [~] **T-53** Opis zakresu użycia AI (z historii git, PR-ów i archiwum `ai-log.md`) i dokumentacja na oddanie (`README.md`, regulamin §4 ust. 4) — `R2` — niedziela 10:30 · Jasiek od 17.10: README pod jury gotowe (zrzuty ekranu, problem, zbiory z licencjami, architektura, stack, użycie AI); sekcja AI do przejrzenia przez Pawła (issue #77); 17.10: sekcja uzupełniona (modele grafik, źródła faktów, film, plan pitchu), PR do #77
- [ ] **T-54** Checklista z [06-plan-dnia.md](06-plan-dnia.md): repo, deck, dokumentacja, nagranie — `R2` — niedziela 10:30

## Z przeglądu stanu (Jasiek, 15:00; numery T-90+, bo T-76 zajął R1)

- [x] **T-90** Railway nie wdraża `main` (stoi na `19c97a1`): sprawdzić auto-deploy i watch paths serwisu, wdrożyć `main`, potwierdzić `version` w `/health`; bez tego odtwarzacz na produkcji daje 404 — `R3` (Paweł, konto Railway) — (16:10, Jasiek: sprawdzone, `/health` pokazuje 01ed0e3)
- [x] **T-91** Zmienne na Railway: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_KEY`, `ELEVENLABS_KEY`; sprawdzić w logach `api listening` i `planner places loaded` (`isFallback: false`) — `R3` (Paweł) — (16:10, Jasiek: sprawdzone z zewnątrz: `/v1/places` 1303 miejsc z bazy, `/v1/stories` z LLM, `/v1/speech` daje mp3)
- [x] **T-92** `POST /v1/speech` przyjmuje dowolny tekst bez limitu zapytań (każdy może zużyć kredyty ElevenLabs): web na `/v1/stories/audio`, a `/v1/speech` wyłączyć albo dodać rate limit — `R4` → `R2` (Jasiek, z polecenia użytkownika, 18:15: odtwarzacz bierze głos z `/v1/stories/audio`; `/v1/speech` tylko przy `DEBUG_PAGES=1`; `/v1/stories*` mają limit 300 zapytań na 10 min na IP, potem 429 `RATE_LIMITED`)
- [x] **T-93** Odtwarzacz (`story-player.ts`) trzyma klipy po samym `stop.id`: po zmianie zainteresowań lub czasu gra starą opowieść o złej długości; klucz z zainteresowaniami i `targetSec` — `R3` → `R2` (Jasiek, z polecenia użytkownika, 18:15: klucz `clipKey` = punkt + `targetSec` + cały profil słuchacza, z testem)
- [x] **T-94** Cache opowieści i głosu jest w pamięci, restart Railway go czyści: przed pitchem rozgrzać trasę demo albo zapisać ją jako fixture (z T-18, T-36) — `R1` + `R3` (Antek, 21:20: tryb demo `DEMO_MODE=record|replay`, [16-tryb-demo.md](16-tryb-demo.md), gałąź `r3/tryb-demo`)
- [ ] **T-152** Nagrać opowieści i głos trasy pitchu do `apps/api/data/demo/` (`demo:record` albo przeklikanie trasy z API w `record`), commit, potem `DEMO_MODE=replay` na Railway i `NEXT_PUBLIC_VOICE=1` na Vercelu. **Zablokowane:** ElevenLabs ma 82 kredyty (opowieść ok. 200–600); potrzebny nowy klucz albo dokupienie — `R3` + `R4` — niedziela 08:00
- [ ] **T-95** Pokazać zbiór z dane.um.warszawa.pl na scenie: dziś tylko „Otwarte boiska” (sport), transport idzie z GTFS mkuran.pl, `WAW_TOKEN` nieustawiony (T-17). Ścieżka demo musi go zawierać, pitch musi go nazwać — `R2` (z T-50) + `R1`
- [x] **T-96** Dwie mapy (`features/demo/` Pawła na `/` i `features/map/` Antka na `/mapa`): zdecydować, która idzie na demo, drugą zamrozić — `R3` — (Paweł, 14:54: demo używa `SawaMap` Antka, stara mapa usunięta)
- [ ] **T-97** Zdjęcia bez sprawdzonej licencji (T-22 zamknięte decyzją „pomijamy”): na demo i w decku tylko zdjęcia z licencją i autorem albo z podpisem źródła — `R2`
- [x] **T-98** Opowieść z produkcji ma cyfry („założone w 1867 roku”), a TTS czyta je źle (decyzja 13:55: LLM pisze liczby słownie): dopisać to do promptu albo zamieniać cyfry przed `/v1/speech` — `R4` → `R2` (Jasiek, z polecenia użytkownika, 18:15: prompt mówił „Lata zapisujesz cyframi”, teraz liczby, lata i daty słownie; do sprawdzenia na produkcji, czy model słucha)

## Ze spotkania ok. 20:00 ([podsumowanie](spotkania/2026-10-17-2000-proxy-dane-mentorzy.md))

- [x] **T-140** Wyszukiwanie celu znajduje też ulice i adresy (dziś Google Places zwraca tylko miejsca) ([#97](https://github.com/Pawel-Uhma/Sawa/issues/97)). Równolegle z Text Search: Autocomplete (New) z typami adresu i ulicy + Place Details, adres pierwszy, pole `kind` w kontrakcie, pinezka w UI — `R3` — (Paweł z agentem, 20:25–20:40; do sprawdzenia na produkcji po deployu)
- [ ] **T-141** Ciemny motyw: jaśniejsze ulice na mapie, syrenka czytelna na ciemnym tle — `R3` (Antek)
- [ ] **T-142** Stany czekania (spinner, kółka) w czcionce i kolorach Sawy — `R3`
- [x] **T-157** Modal „Co już Ci opowiedziałam” z menu: miejsca od najnowszych, stuknięcie zaznacza miejsce na mapie (`?p=`), „Zapomnij wszystko” w modalu (`told-modal.tsx`) — `R3` — (Paweł z agentem, 18.10 00:05)
- [x] **T-143** Suwak czasu: rzadsze podziałki (np. co 30 min), gęste się nakładają — `R3` (Paweł, 23:10: podziałki 5 min, 1 h, 2 h, 3 h, 4 h; wartość czasu w osobnym wierszu nad suwakiem, bo ucinała „Ile masz czasu?”, wariant 2300-A)
- [x] **T-148** Stop i pauza zatrzymują zegar jazdy także przed pierwszym miejscem: osobny stan „zatrzymane przez użytkownika” (`held` w `useRideClock`), wznowienie od tego samego miejsca, GPS (`useGpsClockSync`) nie przesuwa zegara przy zatrzymanej Sawie (#93) — `R3` — (Paweł z agentem, 17.10, 20:11, PR w toku)
- [ ] **T-144** Głos czyta lata źle („1099” zamiast 1939, „1090” zamiast 1940, „5355” zamiast 53/55): sprawdzić, czy prompt pisze liczby słownie (T-98) — `R4`
- [x] **T-145** Przetestować proxy z home labu (#63) na produkcji: API miasta, pojazdy — `R1` + Antek — (Jasiek, 20:15: PR #86, `WAW_API_BASE_URL` i `WAW_PROXY_KEY` na Railway; `/v1/vehicles/track` `stale: false` z pojazdami, odjazdy `realDeparture: true`)
- [ ] **T-148** Railway nie wdraża merge'ów do `main` sam (stał na `2829bf3` z 18:52 mimo zmian w `apps/api/**`): sprawdzić trigger GitHub w serwisie `api`; do tego czasu po merge'u `railway redeploy --from-source --service api --yes` i `version` w `/health` — `R1`
- [ ] **T-146** Firecrawl: klucz z drugiego konta, kolejne miejsca rzadziej i po całej Warszawie (poza Śródmieściem i Wolą) — `R2`
- [ ] **T-147** Pitch wg mentorów: problem → rozwiązanie, lista wymagań funkcjonalnych, aktorzy systemu (np. emeryci, biuro miasta, lokalny przewoźnik) — `R2`

## Wszyscy · końcówka

- [ ] **T-68** Sprawdzić repo pod kątem kluczy API i tokenów przed pierwszym pushem — `Wszyscy` — przed pushem
- [ ] **T-61** Zamrożenie zmian w kodzie, tylko poprawki błędów — `Wszyscy` — niedziela 09:00

## Poza MVP (nie ruszamy bez decyzji zespołu w `stan.md`)

Zakres to tylko lista MVP z [10-prd.md](10-prd.md), zob. [12-plan-mvp.md](12-plan-mvp.md) §10.

- [x] **T-05** Decyzja o toaletach (OSM czy rezygnacja) — `R1` — 14:00 (Szczepan, 19:40: rezygnacja w MVP, brak zbioru w portalu)
- [x] **T-06** Decyzja o Google Places (klucz każdego czy tylko Wikipedia) — `R2` — 14:00 (Jasiek, 13:43: używamy danych Google pobranych 15–16.10, bez zapytań na żywo i bez klucza; warstwa `dzis` → `places.today_nearby`, `Place.todayNearby`)
- [x] **T-12** Kalendarz wydarzeń i pogoda (zbiory z [03-dane.md](03-dane.md)) — `R1` — 17:00 (Szczepan, 19:40: R1 nie robi, poza MVP; do wzięcia, jeśli ktoś ma czas)
- [ ] **T-14** Przewidywanie, co będzie za oknem za X s (pozycja + rozkład); przy korku dłuższa historia — `R1` — po 22:00 (19:40: część jest w T-99 Jaśka i w opóźnieniu na żywo T-108; reszta po MVP)
- [x] **T-23** ~~Cache Google Places w Supabase~~ niepotrzebne: nie odpytujemy Google na żywo (T-06) — `R2` — (Jasiek, 13:43)
- [x] **T-34** Zakładka czatu z Sawą (UI, podpięcie do T-40) — `R3` — (Paweł z agentem, 17.10 ok. 17:00: zamiast czatu zakładka Sawa na środku paska z głową, która świeci się, gdy mówi; transkrypcja, sterowanie, „opowiedz więcej”, lista „co już opowiedziała”. Rozmowa w wolnym tekście wciąż czeka na T-40)
- [x] **T-75** Zakładka Przejażdżki (makieta D): przełącznik czasu, karta trasy z podglądem z planera, zapowiedzi Śródmieścia i Pragi — `R3` — (Paweł z agentem, 17.10 14:46)
- [ ] **T-40** `POST /v1/chat` (SSE) z LLM (Bielik lub zapasowy); klucz tylko na serwerze — `R4` — 17:00
- [x] **T-43** TTS: wybrany ElevenLabs (17.10, 13:30), test polskiego w ramach T-71 — `R4`
- [ ] **T-44** Awatar Sawy wygenerowany od zera po 11:00 wg [awatar/](awatar/) — `R4` — 15:00

## Ze spotkania 13:30

- [x] **T-70** Planer: limit miejsc na trasie albo minimalny czas na opowieść (30 min daje teraz 120 miejsc) — `R1` — (Jasiek 14:45: na produkcji 30 min 9 miejsc, 120 min 15; Szczepan, 18:30: liczba miejsc już nie 120, ok. 2–5 na 10 min; naprawione okna: min. odstęp stylu także na końcu, maks. 60/120/300 s, opowieści na dojściu do przystanku; PR w toku)
- [x] **T-71** Integracja ElevenLabs w API (`ELEVENLABS_KEY` w Railway) — `R4` → zrobił Pawel na własną prośbę (17.10, 13:55), gałąź `r4/tts-elevenlabs`: `POST /v1/speech` → mp3 głosem Asi, cache w pamięci. W `main` od 14:50
- [x] **T-72** Styl mapy Mapbox i kategorie punktów (budynek, ulica, pomnik…) z ikonami — `R3` — Pawel z agentem, 17:15: ikony wariantu 3 „płaski kontrast” (`docs/ui/ikony-mapy/`) dla 9 rodzajów miejsc i przystanków na trasie. Podkład mapy bez zmian (OpenFreeMap positron)
- [x] **T-73** Scraping kolejnych miejsc (budynki → Wikipedia) prosto do Supabase — `R2` — (Jasiek z agentami, 15:50: 1092 miejsc; 16:30: 1347 miejsc na całą Warszawę, w tym 260 poza pasem Śródmieście–Praga; zabytki z OSM + Wikipedia w `docs/historia/osm-historia.geojson`, parki, sport i „Otwarte boiska” z 18 dzielnic; seed i `export:places` zrobione)
- [ ] **T-74** Opisać w `docs/` repo przydatne na hackathon (link na Discordzie zespołu) — `Wszyscy` (kto znalazł)

## Zrobione

- [x] **T-63** Backend: Railway — decyzja 17.10, 11:40
- [x] **T-64** Domena: darmowa subdomena Vercela — decyzja 17.10, 11:40

- [x] **T-07** Zasady pracy i mózg zespołu — zrobione 17.10 ok. 11:30

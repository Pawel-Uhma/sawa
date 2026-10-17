"use client";

import { HACKATHON_VENUE, type Route, type Travel } from "@sawa/shared";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import dynamic from "next/dynamic";
import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoadingCover } from "@/components/waiting";
import { type Lang, pick, useLang, useT } from "@/features/i18n";
import type { MapCamera, MapPadding } from "@/features/map";
import { listenerOf, planRoute, routeStops } from "../lib/api-data";
import { useDemoDrive } from "../lib/demo-drive";
import { SPRING, useIsDesktop, useIsWide } from "../lib/device";
import { shortestStopFor, useFastestRoute } from "../lib/fastest-route";
import { forgetAll, useMemory } from "../lib/memory";
import type { MockStop } from "../lib/mock-data";
import { EMPTY_PROFILE, loadProfile, type Profile, saveProfile } from "../lib/onboarding";
import { isAt, useRideClock } from "../lib/ride-clock";
import {
  CUSTOM_DESTINATION_NAME,
  CUSTOM_DESTINATION_NAME_EN,
  type RideEnd,
  type RideEndType,
} from "../lib/ride-end";
import { isSawaSpeaking, musicPlays } from "../lib/ride-music";
import { useMusicOn, useRideMusic } from "../lib/ride-music-player";
import { useGpsClockSync } from "../lib/ride-sync";
import { screenCamera } from "../lib/screen-camera";
import { startLabel, useStartPoint } from "../lib/start-point";
import { useStoryPlayer } from "../lib/story-player";
import { claimVoice, ROUTE_VOICE } from "../lib/voice";
import { HomePanel } from "./home-panel";
import { OnboardingFlow } from "./onboarding-flow";
import type { PlaceSelection } from "./place-card-host";
import { ProfileModal, type ProfileStep } from "./profile-modal";
import { RidesPanel } from "./rides-panel";
import { RouteSheet } from "./route-sheet";
import { type SawaMenuActions, SawaMenuProvider } from "./sawa-menu";
import { SawaSpeaking } from "./sawa-speaking";
import { SawaTab } from "./sawa-tab";
import { TopBar } from "./top-bar";

// Ekrany nad mapą. Paska zakładek nie ma: Przejażdżki i Sawa są w menu pod logo,
// a gdy Sawa mówi poza trasą, do jej ekranu prowadzi pigułka w rogu (SawaSpeaking).
type Tab = "map" | "rides" | "sawa";

// Mapa Antka (features/map). MapLibre potrzebuje window i WebGL, więc tylko w przeglądarce.
const SawaMap = dynamic(() => import("@/features/map").then((mod) => mod.SawaMap), {
  ssr: false,
  loading: MapChunkLoading,
});

/** Póki kod mapy się ściąga: ta sama zasłona, którą potem pokazuje sama mapa, więc nic nie skacze. */
function MapChunkLoading() {
  const t = useT();
  return <LoadingCover show label={t("Wczytuję mapę Warszawy…", "Loading the map of Warsaw…")} />;
}

// Karta miejsca czyta wybór z URL-a (`?p=`) i dane mapy, więc też tylko w przeglądarce.
const PlaceCardHost = dynamic(() => import("./place-card-host").then((mod) => mod.PlaceCardHost), {
  ssr: false,
});

type Stage = "onboarding" | "map" | "route";

// Lista „co już opowiedziałam” zaznacza miejsce w URL-u (`?p=`), więc też tylko w przeglądarce.
const ToldModal = dynamic(() => import("./told-modal").then((mod) => mod.ToldModal), {
  ssr: false,
});

// Szerokość panelu (md: 360, lg: 400) i margines wokół niego, jak w route-sheet.tsx i home-panel.tsx
const PANEL_PX = { tablet: 360, laptop: 400 };
const DESKTOP_GAP_PX = 24;

// Podstrona /demo na scenę: bez onboardingu, start zawsze spod 42 Warsaw, trasa układa się sama.
const DEMO_PROFILE: Profile = {
  familiarity: "first_time",
  interests: ["historical"],
  storyStyle: "fun",
  audience: "adult",
};
const DEMO_DURATION_MIN = 90;

export function DemoApp({ scenario }: { scenario?: "stage" } = {}) {
  const isStage = scenario === "stage";
  const lang = useLang();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const [stage, setStage] = useState<Stage>(isStage ? "map" : "onboarding");
  const [profile, setProfile] = useState<Profile>(isStage ? DEMO_PROFILE : EMPTY_PROFILE);
  // Edycja jednego pola profilu idzie przez modal, nigdy przez onboarding.
  const [editing, setEditing] = useState<ProfileStep | null>(null);
  const [toldOpen, setToldOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const [durationMin, setDurationMin] = useState(isStage ? DEMO_DURATION_MIN : 90);
  const [endType, setEndType] = useState<RideEndType>("loop");
  const [travel, setTravel] = useState<Travel>("transit");
  // Celu nie podsuwamy: do wyboru użytkownika. Wybrany wraca po przełączeniu „Wracam tu” → „Do celu”
  const [chosenDestination, setChosenDestination] = useState<Extract<
    RideEnd,
    { type: "destination" }
  > | null>(null);
  // „Do celu” bez wybranego celu: trasy jeszcze nie liczymy, przycisk czeka na cel
  const rideEnd: RideEnd = useMemo(
    () => (endType === "destination" && chosenDestination ? chosenDestination : { type: "loop" }),
    [endType, chosenDestination],
  );
  const needsDestination = endType === "destination" && chosenDestination === null;
  const [route, setRoute] = useState<MockStop[]>([]);
  const [planned, setPlanned] = useState<Route | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sheetCoverPx, setSheetCoverPx] = useState(360);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(null);
  const [placeCoverPx, setPlaceCoverPx] = useState(360);
  // O zgodę na lokalizację pytamy dopiero po onboardingu
  // Na scenie nie pytamy o lokalizację: stała pozycja pod 42 Warsaw
  const start = useStartPoint(!isStage && stage !== "onboarding");
  const origin = isStage ? HACKATHON_VENUE : start.point;
  // Kropka „tu jesteś”: GPS na żywo; 42 Warsaw tylko, gdy to wybrany start (scena, menu).
  // Bez lokalizacji kropki nie ma, bo pod 42 Warsaw wyglądałaby jak zamrożony GPS.
  const userDot =
    isStage || start.mode === "venue" ? HACKATHON_VENUE : (start.position ?? undefined);
  const fastest = useFastestRoute(origin, profile, rideEnd, travel);
  // Suwak nie schodzi poniżej najszybszej drogi do celu (#43)
  const minDurationMin =
    fastest.status === "ready" ? shortestStopFor(fastest.route.totalMin) : null;

  const fastestRoute = fastest.status === "ready" ? fastest.route : null;

  // Każdy nowy cel (i zmiana startu albo sposobu jazdy): suwak sam staje na najszybszej drodze.
  // Użytkownik może go potem przesunąć dalej, dłuższy czas to trasa krajoznawcza.
  useEffect(() => {
    if (fastestRoute) setDurationMin(shortestStopFor(fastestRoute.totalMin));
  }, [fastestRoute]);

  const showRoute = useCallback((next: Route) => {
    setPlanned(next);
    setRoute(routeStops(next));
    setActiveIndex(0);
    setStage("route");
  }, []);

  const generateRoute = useCallback(async () => {
    setPlanning(true);
    setPlanError(null);
    try {
      // Na najkrótszym kroku to po prostu najszybsza droga, już pobrana
      if (fastest.status === "ready" && durationMin === minDurationMin) {
        showRoute(fastest.route);
        return;
      }
      showRoute(await planRoute(origin, durationMin, profile, rideEnd, travel));
    } catch {
      setPlanError(
        start.status === "located"
          ? pick(
              lang,
              "Nie udało się ułożyć trasy stąd. Może w pobliżu nie ma przystanku? Spróbuj startu spod 42 Warsaw w menu Sawy.",
              "Couldn't plan a route from here. Maybe there's no stop nearby? Try starting from 42 Warsaw in the Sawa menu.",
            )
          : pick(
              lang,
              "Nie udało się ułożyć trasy. Spróbuj jeszcze raz.",
              "Couldn't plan a route. Please try again.",
            ),
      );
    } finally {
      setPlanning(false);
    }
  }, [
    lang,
    origin,
    start.status,
    durationMin,
    profile,
    rideEnd,
    travel,
    fastest,
    minDurationMin,
    showRoute,
  ]);

  const changeRideEnd = useCallback((next: RideEnd | null) => {
    if (next?.type === "destination") setChosenDestination(next);
    else if (next === null) setChosenDestination(null);
    setEndType(next?.type ?? "destination");
  }, []);

  // Safari na iOS pomija user-scalable=no, więc szczypanie strony blokujemy wprost. Mapa ma własny zoom na dotyku.
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
    };
  }, []);

  // Kto już przeszedł onboarding na tym urządzeniu, wraca od razu na mapę.
  // Do sprawdzenia localStorage onboarding się nie pokazuje, żeby nie mignął.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const saved = isStage ? null : loadProfile();
    if (saved) {
      setProfile(saved);
      setStage("map");
    }
    setRestored(true);
  }, [isStage]);

  // Na scenie trasa układa się sama raz, zaraz po wejściu (bez zapisu profilu w przeglądarce).
  const autoPlanned = useRef(false);
  useEffect(() => {
    if (!isStage || autoPlanned.current) return;
    autoPlanned.current = true;
    generateRoute();
  }, [isStage, generateRoute]);

  const finishOnboarding = useCallback((next: Profile) => {
    setProfile(next);
    saveProfile(next);
    setStage("map");
  }, []);

  const editProfile = useCallback((step: ProfileStep) => setEditing(step), []);

  const closeEditing = useCallback(() => setEditing(null), []);

  // Zapis z modalu zmienia tylko profil, bez wracania do ekranów wstępu.
  const saveEditing = useCallback((next: Profile) => {
    setProfile(next);
    saveProfile(next);
    setEditing(null);
  }, []);

  const restart = useCallback(() => {
    saveProfile(null);
    forgetAll();
    setProfile(EMPTY_PROFILE);
    setRoute([]);
    setPlanned(null);
    setTab("map");
    setEditing(null);
    setStage("onboarding");
  }, []);

  // Mapa jest jedna pod wszystkimi ekranami. Ekrany zmieniają tylko kamerę i to, co na niej leży.
  const isRoute = stage === "route" && planned !== null && route.length > 0;
  const activeStop = route[activeIndex];
  const isHome = stage === "map" && tab === "map";
  const destination = rideEnd.type === "destination" ? rideEnd : null;
  const isPickingEnd = endType === "destination";
  // Karta miejsca działa też na trasie: klik w pinezkę spoza trasy pokazuje to miejsce.
  const isPlaceOpen = (isHome || isRoute) && selectedPlace !== null;

  const padding: MapPadding = useMemo(() => {
    if (isDesktop) {
      return {
        top: 96,
        right: DESKTOP_GAP_PX,
        bottom: DESKTOP_GAP_PX,
        left: (isWide ? PANEL_PX.laptop : PANEL_PX.tablet) + DESKTOP_GAP_PX * 2,
      };
    }
    if (isPlaceOpen) return { top: isRoute ? 88 : 120, right: 0, bottom: placeCoverPx, left: 0 };
    if (isRoute) return { top: 88, right: 0, bottom: sheetCoverPx, left: 0 };
    return { top: 88, right: 0, bottom: panelCollapsed ? 96 : isPickingEnd ? 470 : 380, left: 0 };
  }, [
    isDesktop,
    isWide,
    isRoute,
    isPlaceOpen,
    sheetCoverPx,
    placeCoverPx,
    panelCollapsed,
    isPickingEnd,
  ]);

  const camera: MapCamera = useMemo(() => {
    const stop =
      isRoute && activeStop ? { lat: activeStop.coord[1], lng: activeStop.coord[0] } : null;
    return screenCamera({
      place: isPlaceOpen ? { position: selectedPlace.position } : null,
      activeStop: stop,
      destination: isHome && destination ? destination.point : null,
      origin,
      isDesktop,
    });
  }, [isRoute, activeStop, isDesktop, isHome, destination, isPlaceOpen, selectedPlace, origin]);

  const listener = useMemo(() => listenerOf(profile), [profile]);
  const memory = useMemory();
  // Odtwarzacz jest tu, a nie w arkuszu trasy: zakładka Sawa steruje tą samą opowieścią.
  const player = useStoryPlayer(route, activeIndex, listener);
  const { setIsPlaying, rewind } = player;
  // Kolejne opowieści ruszają z zegarem jazdy; wybór punktu ręcznie znaczy „jestem tutaj”.
  // Pauza i stop Sawy zatrzymują też zegar (suwak i odliczanie), także przed pierwszym miejscem.
  const clock = useRideClock(route, player.isPlaying);
  const { syncTo, held, setHeld } = clock;
  const heldRef = useRef(held);
  heldRef.current = held;
  const musicOn = useMusicOn();
  // Z lokalizacją zegar staje przy punkcie, do którego naprawdę dojechaliśmy.
  useGpsClockSync(route, start.position, clock);
  const pickStop = useCallback(
    (index: number) => {
      syncTo(index);
      setActiveIndex(index);
    },
    [syncTo],
  );
  // Na scenie autobus jedzie sam: aktywny punkt idzie po trasie w ok. 1,5 min (T-36)
  useDemoDrive(isStage && isRoute, route, pickStop);
  // Sawa nie zaczyna zaraz po wyznaczeniu trasy: czeka, aż dojedziesz do pierwszego miejsca
  // (zegar jazdy albo GPS). Po wyjściu z trasy pauza, a po wejściu wznowienie.
  const waiting = clock.waitSec !== null;
  // Muzyka w tle przez całą jazdę, także w oczekiwaniu na pierwsze miejsce; pauza Sawy zatrzymuje też ją.
  useRideMusic(
    musicOn && musicPlays({ onRoute: isRoute, held, waiting, isPlaying: player.isPlaying }),
    isSawaSpeaking(player),
  );
  const wasWaiting = useRef(false);
  useEffect(() => {
    const arrived = wasWaiting.current && !waiting;
    wasWaiting.current = waiting;
    // Start z zakładki Sawa (poza ekranem trasy) zostaje, nie pauzujemy go od razu
    if (arrived && !isRoute) return;
    // Zatrzymana przez użytkownika Sawa nie rusza sama po powrocie na trasę
    setIsPlaying(isRoute && !waiting && !heldRef.current);
  }, [isRoute, waiting, setIsPlaying]);
  const firstStop = route[0];
  useEffect(() => {
    if (held || !waiting || !firstStop || start.status !== "located") return;
    if (isAt(origin, firstStop)) syncTo(0);
  }, [held, waiting, firstStop, start.status, origin, syncTo]);
  // Sterowanie użytkownika: stop i pauza zatrzymują zegar, odtwarzanie go wznawia.
  // Stuknięcie w odtwarzanie przed pierwszym miejscem znaczy „opowiadaj już teraz”,
  // a po stopie w tym czasie: zegar rusza od miejsca, w którym stanął.
  const ridePlayer = useMemo(() => {
    const toggle = () => {
      if (player.isPlaying) {
        setHeld(true);
        player.toggle();
        return;
      }
      setHeld(false);
      if (!waiting) player.toggle();
      else if (!held) {
        syncTo(0);
        player.toggle();
      }
    };
    const restart = (keepPlaying: boolean) => {
      setHeld(!keepPlaying);
      player.restart(keepPlaying);
    };
    const setPlaying = (action: SetStateAction<boolean>) => {
      const playing = typeof action === "function" ? action(player.isPlaying) : action;
      setHeld(!playing);
      player.setIsPlaying(playing);
    };
    return { ...player, toggle, restart, setIsPlaying: setPlaying };
  }, [waiting, held, player, syncTo, setHeld]);
  const playStop = useCallback(
    (index: number) => {
      if (index < 0 || index >= route.length) return;
      // Wybór punktu to „opowiadaj o trasie”, więc ucisza dygresję z karty miejsca.
      claimVoice(ROUTE_VOICE);
      rewind();
      setHeld(false);
      setIsPlaying(true);
      pickStop(index);
    },
    [route.length, rewind, setHeld, setIsPlaying, pickStop],
  );
  const menu: SawaMenuActions = useMemo(
    () => ({
      profile,
      onEditProfile: editProfile,
      lastRouteStops: planned && route.length > 0 ? route.length : null,
      onOpenLastRoute: () => {
        setTab("map");
        setStage("route");
      },
      onOpenRides: () => {
        setStage("map");
        setTab("rides");
      },
      onOpenSawa: () => {
        setStage("map");
        setPanelCollapsed(false);
        setTab("sawa");
      },
      onRestart: restart,
      rememberedPlaces: Object.keys(memory.places).length,
      onOpenTold: () => setToldOpen(true),
      startMode: start.mode,
      startLabel: startLabel(start.status, lang),
      onStartModeChange: start.setMode,
    }),
    [
      profile,
      editProfile,
      planned,
      route.length,
      restart,
      memory,
      start.mode,
      start.status,
      start.setMode,
      lang,
    ],
  );

  return (
    <MotionConfig reducedMotion="user">
      <SawaMenuProvider value={menu}>
        <div className="fixed inset-0 overflow-hidden bg-mapa">
          <div className="absolute inset-0">
            <SawaMap
              route={
                isRoute ? (planned ?? undefined) : isHome ? (fastestRoute ?? undefined) : undefined
              }
              camera={camera}
              padding={padding}
              user={userDot}
              destination={isRoute || isHome ? destination?.point : undefined}
              onMapClick={
                isHome && isPickingEnd
                  ? (point) =>
                      changeRideEnd({
                        type: "destination",
                        name: pick(lang, CUSTOM_DESTINATION_NAME, CUSTOM_DESTINATION_NAME_EN),
                        point,
                      })
                  : undefined
              }
              activeStopId={isRoute ? activeStop?.id : undefined}
              interests={profile.interests}
              onStopClick={(id) => {
                const index = route.findIndex((stop) => stop.id === id);
                if (index >= 0) pickStop(index);
              }}
              // Ekrany mają własne karty nad mapą; wbudowana karta miejsca wjechałaby pod nie
              hasPlaceSheet={false}
            />
          </div>

          {/* Mgiełka pod paskiem statusu na telefonie */}
          <div className="mgla pointer-events-none absolute inset-x-0 top-0 z-10 h-28 md:hidden" />

          <AnimatePresence>
            {stage !== "onboarding" && <TopBar key="top" hideOnDesktop={isRoute} />}
          </AnimatePresence>

          <AnimatePresence>
            {isHome && !isPlaceOpen && (
              <HomePanel
                key="home"
                durationMin={durationMin}
                onDurationChange={setDurationMin}
                fastestMin={fastestRoute?.totalMin ?? null}
                isFindingFastest={fastest.status === "loading"}
                minDurationMin={minDurationMin}
                travel={travel}
                onTravelChange={setTravel}
                rideEnd={rideEnd}
                endType={endType}
                onRideEndTypeChange={setEndType}
                onRideEndChange={changeRideEnd}
                collapsed={panelCollapsed}
                onCollapsedChange={setPanelCollapsed}
                onGenerate={generateRoute}
                canGenerate={!needsDestination}
                planning={planning}
                planError={planError}
                locating={!isStage && start.status === "locating"}
              />
            )}
            {stage === "map" && tab === "rides" && (
              <RidesPanel
                key="rides"
                profile={profile}
                origin={origin}
                originLabel={startLabel(start.status, lang)}
                durationMin={durationMin}
                onDurationChange={setDurationMin}
                rideEnd={rideEnd}
                travel={travel}
                lastRoute={route}
                onClose={() => setTab("map")}
                onOpenLastRoute={() => {
                  setTab("map");
                  setStage("route");
                }}
                onStart={(preview) => {
                  setTab("map");
                  if (preview) showRoute(preview);
                  else generateRoute();
                }}
              />
            )}
            {stage === "map" && tab === "sawa" && (
              <SawaTab
                key="sawa"
                collapsed={panelCollapsed}
                onCollapsedChange={setPanelCollapsed}
                stops={route}
                activeIndex={activeIndex}
                player={ridePlayer}
                places={memory.places}
                onPrev={() => playStop(activeIndex - 1)}
                onNext={() => playStop(activeIndex + 1)}
                onClose={() => setTab("map")}
              />
            )}
            {isRoute && (
              <RouteSheet
                key="route"
                listener={listener}
                durationMin={durationMin}
                end={planned ? routeEnd(planned, rideEnd, lang) : null}
                legs={planned?.legs ?? []}
                attribution={planned?.attribution ?? []}
                stops={route}
                player={ridePlayer}
                activeIndex={activeIndex}
                onActiveChange={setActiveIndex}
                onPlayStop={playStop}
                clock={clock}
                totalSec={(planned?.totalMin ?? 0) * 60}
                onBack={() => setStage("map")}
                isDesktop={isDesktop}
                onCoverChange={setSheetCoverPx}
              />
            )}
          </AnimatePresence>

          {stage !== "onboarding" && (
            <PlaceCardHost
              isActive={isHome || isRoute}
              listener={listener}
              onSelectionChange={setSelectedPlace}
              onCoverChange={setPlaceCoverPx}
              onRideTo={(name, point) => {
                changeRideEnd({ type: "destination", name, point });
                // Z trasy wracamy na ekran główny, żeby wyznaczyć przejazd do nowego celu
                setStage("map");
                setTab("map");
                setPanelCollapsed(false);
              }}
            />
          )}

          <AnimatePresence>
            {stage === "map" && tab !== "sawa" && player.isPlaying && player.text !== null && (
              <SawaSpeaking
                key="mowi"
                place={activeStop?.name ?? null}
                onOpen={() => {
                  setPanelCollapsed(false);
                  setTab("sawa");
                }}
              />
            )}
          </AnimatePresence>

          {/* Onboarding to warstwa nad mapą. Po wyjściu mapa „wyjeżdża” spod spodu. */}
          <AnimatePresence>
            {stage === "onboarding" && restored && (
              <motion.div
                key="onboarding"
                className="fixed inset-0 z-40"
                exit={{ opacity: 0, scale: 1.02 }}
                transition={SPRING}
              >
                <OnboardingFlow onDone={finishOnboarding} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal edycji nad wszystkim: zmienia jedno pole i wraca na to, co było pod spodem */}
          <ProfileModal
            step={editing}
            profile={profile}
            onSave={saveEditing}
            onClose={closeEditing}
          />
          <ToldModal
            open={toldOpen}
            onClose={() => setToldOpen(false)}
            onShowPlace={() => {
              setStage("map");
              setTab("map");
            }}
          />
        </div>
      </SawaMenuProvider>
    </MotionConfig>
  );
}

/** Podpis końca trasy w arkuszu; gdy planer nie dojechał do celu albo nie zamknął pętli, mówi to wprost. */
function routeEnd(route: Route, end: RideEnd, lang: Lang): { label: string; reached: boolean } {
  switch (end.type) {
    case "loop":
      return route.endsAtStart
        ? { label: pick(lang, "Wracasz na start", "Back to the start"), reached: true }
        : {
            label: pick(
              lang,
              "Nie udało się wrócić na start w tym czasie",
              "Couldn't get back to the start in this time",
            ),
            reached: false,
          };
    case "destination":
      return route.endsAtDestination
        ? { label: pick(lang, `Do celu: ${end.name}`, `To: ${end.name}`), reached: true }
        : {
            label: pick(
              lang,
              `Nie udało się dojechać do celu (${end.name}) w tym czasie`,
              `Couldn't reach ${end.name} in this time`,
            ),
            reached: false,
          };
  }
}

"use client";

import type { Leg } from "@sawa/shared";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/features/i18n";
import type { Listener } from "../lib/api-data";
import { haptic, project, SPRING, SPRING_FLICK } from "../lib/device";
import { rubberband, useVerticalDrag } from "../lib/gesture";
import type { MockStop } from "../lib/mock-data";
import { backTarget } from "../lib/podcast";
import { dueIndex as placeAt, type RideClock, storyStartSec } from "../lib/ride-clock";
import type { StoryPlayer } from "../lib/story-player";
import { claimVoice, ROUTE_VOICE } from "../lib/voice";
import { RoutesIcon } from "./icons";
import { PodcastDock, PodcastHeader, usePodcast } from "./podcast-controls";
import { RouteLive } from "./route-live";
import { StorySuggestion } from "./story-suggestion";

type RouteSheetProps = {
  durationMin: number;
  /** Koniec trasy (pętla albo cel); null przy trasie „przed siebie”. */
  end: { label: string; reached: boolean } | null;
  /** Odcinki trasy z planera: tramwaje, autobusy i spacery. */
  legs: Leg[];
  /** Podpis źródeł danych trasy. */
  attribution: string[];
  stops: MockStop[];
  /** Odtwarzacz opowieści jest w `DemoApp`, bo zakładka Sawa steruje tą samą opowieścią. */
  player: StoryPlayer;
  /** Kto słucha: do opowieści o miejscu obok, które Sawa poleca. */
  listener: Listener;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  /** Przejście do miejsca z przycisków: zegar jazdy staje przy nim, opowieść gra od początku. */
  onPlayStop: (index: number) => void;
  /** Zegar jazdy: który punkt już powinien mieć opowieść, ile trwa jazda i przeskok suwakiem. */
  clock: Pick<RideClock, "dueIndex" | "waitSec" | "rideSec" | "held" | "seekTo">;
  /** Długość przejażdżki z planera (s), zakres suwaka. */
  totalSec: number;
  onBack: () => void;
  isDesktop: boolean;
  /** Ile pikseli od dołu zasłania arkusz (telefon), żeby mapa wiedziała, gdzie jest jej widoczna część. */
  onCoverChange: (px: number) => void;
};

/** Trasa: arkusz z punktami zatrzymania na telefonie, pływający panel na desktopie. */
export function RouteSheet(props: RouteSheetProps) {
  const { stops, activeIndex, onActiveChange, onPlayStop, player, clock } = props;
  const { setIsPlaying, rewind, restart, more } = player;
  const hasNext = activeIndex < stops.length - 1;
  const { progress, toggle: togglePlay } = player;
  const { seekTo } = clock;

  // Po końcu opowieści Sawa czeka, aż zbliżysz się do następnego punktu (zegar jazdy, do czasu
  // lokalizacji). Gdy opowieść się przeciągnęła, od razu bierze punkt, przy którym już jesteś.
  const { dueIndex } = clock;
  useEffect(() => {
    if (progress < 100) return;
    if (!hasNext) {
      setIsPlaying(false);
      return;
    }
    if (dueIndex <= activeIndex) return;
    rewind();
    setIsPlaying(true);
    onActiveChange(dueIndex);
  }, [progress, hasNext, activeIndex, dueIndex, onActiveChange, setIsPlaying, rewind]);

  // Wszystko, co Sawa powiedziała w tej jeździe, jako jeden ciągły tekst z podziałem na tematy.
  // Docelowo (T-106) to jeden strumień z pomostami od Sawy; dziś składamy go z kolejnych opowieści.
  const [said, setSaid] = useState<Record<string, string>>({});
  const activeId = stops[activeIndex]?.id;
  useEffect(() => {
    if (activeId && player.text) setSaid((prev) => ({ ...prev, [activeId]: player.text ?? "" }));
  }, [activeId, player.text]);
  const transcript = stops.flatMap((stop, index) =>
    said[stop.id] && index <= activeIndex ? [{ stopIndex: index, text: said[stop.id] }] : [],
  );

  // Wstecz: w trakcie opowieści od jej początku, na samym początku do poprzedniego miejsca.
  const goBack = useCallback(() => {
    const target = backTarget(activeIndex, progress);
    if (target === activeIndex) restart(true);
    else onPlayStop(target);
  }, [activeIndex, progress, restart, onPlayStop]);
  const goNext = useCallback(() => {
    if (hasNext) onPlayStop(activeIndex + 1);
  }, [hasNext, activeIndex, onPlayStop]);
  // Suwak przesuwa zegar jazdy; inne miejsce pod suwakiem znaczy nową opowieść od początku.
  const seek = useCallback(
    (sec: number) => {
      seekTo(sec);
      const index = placeAt(stops, sec);
      if (index === activeIndex) return;
      claimVoice(ROUTE_VOICE);
      rewind();
      setIsPlaying(true);
      onActiveChange(index);
    },
    [seekTo, stops, activeIndex, rewind, setIsPlaying, onActiveChange],
  );

  // Klawiatura na desktopie: spacja wstrzymuje, strzałki przechodzą między miejscami.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, button, [contenteditable]")) return;
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowLeft") {
        goBack();
      } else if (event.key === "ArrowRight") {
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, goBack, goNext]);

  // Suwak obejmuje całą jazdę, a co najmniej start ostatniej opowieści
  const last = stops[stops.length - 1];
  const totalSec = Math.max(props.totalSec, last ? storyStartSec(last) + 60 : 0);
  const headerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const podcast = usePodcast({
    stops,
    activeIndex,
    rideSec: clock.rideSec,
    totalSec,
    isPlaying: player.isPlaying,
    waiting: clock.waitSec !== null,
    held: clock.held,
    loading: player.loading,
  });

  const content = (
    <RouteLive
      {...props}
      isPlaying={player.isPlaying}
      progress={progress}
      spokenWords={player.spokenWords}
      waitSec={clock.waitSec}
      storyText={player.text}
      transcript={transcript}
      storyFooter={
        player.suggestion && (
          <StorySuggestion
            key={player.suggestion.placeId}
            suggestion={player.suggestion}
            listener={props.listener}
          />
        )
      }
      storyState={player.loading ? "loading" : player.failed ? "failed" : "ready"}
      header={
        <div ref={headerRef}>
          <PodcastHeader podcast={podcast} onLeave={props.onBack} />
        </div>
      }
    />
  );
  const dock = (
    <PodcastDock
      podcast={podcast}
      onToggle={togglePlay}
      onStop={() => restart(false)}
      onBack={goBack}
      onNext={goNext}
      onMore={more}
      onSeek={seek}
    />
  );

  return props.isDesktop ? (
    <DesktopPanel headerRef={headerRef} dockRef={dockRef} dock={dock}>
      {content}
    </DesktopPanel>
  ) : (
    <MobileSheet
      onCoverChange={props.onCoverChange}
      headerRef={headerRef}
      dockRef={dockRef}
      dock={dock}
    >
      {content}
    </MobileSheet>
  );
}

/**
 * Dół nagłówka od góry arkusza i wysokość doku (px), mierzone, bo zależą od czcionek i długości
 * nazw. Zapis opowieści bierze z nich wysokość (`--trasa-glowa`, `--trasa-dok`).
 */
function useChrome(
  headerRef: RefObject<HTMLDivElement | null>,
  dockRef: RefObject<HTMLDivElement | null>,
) {
  const [chrome, setChrome] = useState({ headerBottom: 150, dockHeight: 190 });
  useEffect(() => {
    const header = headerRef.current;
    const dock = dockRef.current;
    if (!header || !dock) return;
    const update = () =>
      setChrome({
        headerBottom: header.offsetTop + header.offsetHeight,
        dockHeight: dock.offsetHeight,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [headerRef, dockRef]);
  return chrome;
}

function DesktopPanel({
  children,
  dock,
  headerRef,
  dockRef,
}: {
  children: ReactNode;
  dock: ReactNode;
  headerRef: RefObject<HTMLDivElement | null>;
  dockRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useT();
  const { headerBottom, dockHeight } = useChrome(headerRef, dockRef);
  return (
    <motion.section
      aria-label={t("Trasa", "Route")}
      initial={{ opacity: 0, x: -32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={SPRING}
      style={{
        ["--trasa-widoczne" as string]: "calc(100dvh - 48px)",
        ["--trasa-glowa" as string]: `${headerBottom}px`,
        ["--trasa-dok" as string]: `${dockHeight}px`,
      }}
      className="karta absolute bottom-6 left-6 top-6 z-20 flex w-[360px] flex-col overflow-hidden rounded-[28px] lg:w-[400px]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-6">
        {children}
      </div>
      <div ref={dockRef} className="shrink-0 border-t border-tekst/[0.06] px-6 pb-5 pt-3">
        {dock}
      </div>
    </motion.section>
  );
}

function useViewportHeight() {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 844 : window.innerHeight,
  );
  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return height;
}

/** Ile pikseli od dołu zajmuje przycisk „Trasa”, gdy arkusz jest schowany (mapa ma wtedy wolny cały ekran). */
const HIDDEN_COVER_PX = 96;
// Odstęp między nagłówkiem a dokiem w zwiniętym arkuszu
const CONTROLS_GAP_PX = 8;

/**
 * Arkusz z dwoma punktami zatrzymania: zwinięty pokazuje nagłówek i dok (reszta ekranu to mapa),
 * rozwinięty także zapis Sawy między nimi. Dok jest przypięty do dolnej krawędzi ekranu, więc
 * przy przeciąganiu arkusza zostaje pod kciukiem, a zapis wyłania się nad nim (jak tekst w Muzyce).
 * Schowany zostaje tylko przycisk w prawym dolnym rogu. Rzut wybiera punkt z rozpędu,
 * ściągnięcie w dół chowa arkusz.
 */
function MobileSheet({
  children,
  dock,
  onCoverChange,
  headerRef,
  dockRef,
}: {
  children: ReactNode;
  dock: ReactNode;
  onCoverChange: (px: number) => void;
  /** Nagłówek na górze treści: zwinięty arkusz kończy się tuż pod nim, plus dok. */
  headerRef: RefObject<HTMLDivElement | null>;
  dockRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const height = useViewportHeight();
  const { headerBottom, dockHeight } = useChrome(headerRef, dockRef);
  const controlsBottom = headerBottom + CONTROLS_GAP_PX + dockHeight;
  const detents = {
    full: 64,
    controls: Math.max(Math.round(height * 0.35), height - controlsBottom),
  };
  const y = useMotionValue(height);
  // Dok stoi na dole ekranu: arkusz zjeżdża o y, dok wraca o tyle samo (sam transform, bez układu).
  // Poniżej zwiniętego punktu zatrzymania jedzie już z arkuszem, więc chowa się razem z nim.
  const lowestRef = useRef(detents.controls);
  lowestRef.current = detents.controls;
  const dockY = useTransform(y, (value) => -Math.min(value, lowestRef.current));
  const [detent, setDetent] = useState<keyof typeof detents>("controls");
  const [isHidden, setIsHidden] = useState(true);
  const sheetRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const base = useRef(0);
  const isFull = detent === "full";

  // Schowany arkusz zjeżdża za dół ekranu, otwarty staje na swoim punkcie zatrzymania
  // biome-ignore lint/correctness/useExhaustiveDependencies: reagujemy na rozmiar okna, punkt zatrzymania i schowanie
  useEffect(() => {
    const target = isHidden ? height : detents[detent];
    const animation = animate(y, target, reduce ? { duration: 0 } : SPRING);
    onCoverChange(isHidden ? HIDDEN_COVER_PX : height - detents[detent]);
    return () => animation.stop();
  }, [height, detent, isHidden, controlsBottom]);

  // Poza pełnym rozmiarem treść się nie przewija, tylko ciągnie arkusz. Wracamy wtedy na górę listy.
  useEffect(() => {
    if (!isFull) scrollRef.current?.scrollTo({ top: 0 });
  }, [isFull]);

  useVerticalDrag(sheetRef, {
    // W pełnym rozmiarze arkusz przejmuje gest tylko, gdy lista jest na górze i palec idzie w dół (jak w iOS).
    shouldStart: (dy) =>
      !isHidden && (!isFull || (dy > 0 && (scrollRef.current?.scrollTop ?? 0) <= 0)),
    onStart: () => {
      y.stop();
      base.current = y.get();
    },
    onMove: (dy) => {
      const raw = base.current + dy;
      // W górę opór za pełnym rozmiarem, w dół 1:1, bo tam arkusz się chowa
      y.set(raw < detents.full ? detents.full - rubberband(detents.full - raw, height) : raw);
    },
    onEnd: (velocity) => {
      // Cel wybieramy z miejsca, w które arkusz by doleciał, a nie z miejsca puszczenia
      const landing = y.get() + project(velocity);
      if (landing > detents.controls + (height - detents.controls) * 0.5 && velocity >= 0) {
        haptic();
        setIsHidden(true);
        animate(y, height, reduce ? { duration: 0 } : { ...SPRING_FLICK, velocity });
        return;
      }
      const nearest = (Object.keys(detents) as (keyof typeof detents)[]).reduce((best, key) =>
        Math.abs(detents[key] - landing) < Math.abs(detents[best] - landing) ? key : best,
      );
      if (nearest !== detent) haptic();
      setDetent(nearest);
      animate(y, detents[nearest], reduce ? { duration: 0 } : { ...SPRING_FLICK, velocity });
      onCoverChange(height - detents[nearest]);
    },
  });

  function show() {
    haptic();
    setDetent("controls");
    setIsHidden(false);
  }

  return (
    <>
      <motion.section
        ref={sheetRef}
        aria-label={t("Trasa", "Route")}
        aria-hidden={isHidden}
        inert={isHidden}
        exit={reduce ? { opacity: 0 } : { y: height }}
        transition={SPRING}
        // Zapis Sawy ma od razu wysokość z pełnego arkusza, więc przy wyciąganiu tylko się odsłania
        style={{
          y,
          ["--trasa-widoczne" as string]: `${height - detents.full}px`,
          ["--trasa-glowa" as string]: `${headerBottom}px`,
          ["--trasa-dok" as string]: `${dockHeight}px`,
        }}
        className={`karta absolute inset-x-0 top-0 z-20 flex h-dvh flex-col rounded-t-[28px] border-b-0 ${
          isFull ? "" : "touch-none"
        }`}
      >
        <div className="flex shrink-0 cursor-grab justify-center pb-2 pt-2.5 active:cursor-grabbing">
          <button
            type="button"
            aria-label={
              isFull
                ? t("Pokaż tylko sterowanie", "Show controls only")
                : t("Pokaż zapis opowieści", "Show the story transcript")
            }
            onClick={() => {
              haptic();
              setDetent((current) => (current === "full" ? "controls" : "full"));
            }}
            className="flex h-6 w-16 items-center justify-center"
          >
            <span className="h-[5px] w-9 rounded-full bg-tekst/20" />
          </button>
        </div>
        {/* Stała wysokość (widoczna część przy pełnym rozmiarze): arkusz jedzie transformem, bez przeliczania układu w każdej klatce */}
        <div
          ref={scrollRef}
          style={{ height: height - detents.full - 34, paddingBottom: dockHeight + 24 }}
          className={`overscroll-contain px-4 ${
            isFull ? "touch-pan-y overflow-y-auto" : "overflow-hidden"
          }`}
        >
          {children}
        </div>
        <motion.div
          ref={dockRef}
          style={{ y: dockY }}
          // Pas pod dokiem zakrywa treść, gdy sprężyna arkusza przestrzeli w górę
          className="absolute inset-x-0 bottom-0 after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-powierzchnia border-t border-tekst/[0.06] bg-powierzchnia px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(16,43,42,0.06)]"
        >
          {dock}
        </motion.div>
      </motion.section>

      <motion.button
        type="button"
        aria-label={t("Pokaż trasę", "Show route")}
        onClick={show}
        inert={!isHidden}
        initial={false}
        animate={{ opacity: isHidden ? 1 : 0, scale: isHidden ? 1 : 0.8 }}
        transition={reduce ? { duration: 0 } : SPRING}
        className={`absolute right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-full bg-glebia text-white shadow-[0_8px_20px_rgba(23,112,111,0.35)] transition-transform duration-150 active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-glebia ${
          isHidden ? "" : "pointer-events-none"
        }`}
      >
        <RoutesIcon className="size-6" />
      </motion.button>
    </>
  );
}

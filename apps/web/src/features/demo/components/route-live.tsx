"use client";

import type { Leg, Place } from "@sawa/shared";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, type Ref, useEffect, useReducer, useRef } from "react";
import { FadeImage, RollingText, SkeletonLines, Spinner } from "@/components/waiting";
import { useLang, useT } from "@/features/i18n";
import { usePlace } from "@/features/map";
import { SPRING } from "../lib/device";
import { formatDuration } from "../lib/format";
import type { MockStop } from "../lib/mock-data";
import { spokenCut } from "../lib/story-player";
import { useStoryWaitMessage } from "../lib/story-wait";
import { FOLLOW_INITIAL, followReducer, SCROLL_KEYS } from "../lib/transcript-follow";
import { Attribution, Itinerary } from "./departures";
import { PinIcon } from "./icons";
import { LiveDot } from "./podcast-controls";
import { SawaMenuButton } from "./sawa-menu";
import { StoryPhotos } from "./story-photos";

/*
 * Ekran trasy na żywo (wybrany wariant A, propozycje w docs/ui/README.md).
 * Sawa sama przechodzi od tematu do tematu z zegarem jazdy, ale słuchacz może ją prowadzić:
 * sterowanie (stop, wstecz, odtwarzanie, dalej, suwak przejażdżki) jest na górze arkusza,
 * więc zwinięty arkusz pokazuje tylko je, a rozwinięty także zapis tego, co Sawa mówi,
 * i dojazd (jedna lista odcinków, bez powtarzania linii).
 */

/** Fragment strumienia Sawy przypisany do punktu trasy (temat, o którym wtedy mówiła). */
export type TranscriptPart = { stopIndex: number; text: string };

export type RouteLiveProps = {
  durationMin: number;
  end: { label: string; reached: boolean } | null;
  legs: Leg[];
  /** Podpis źródeł danych trasy (`Route.attribution`). */
  attribution: string[];
  stops: MockStop[];
  /** Punkt, przy którym jest użytkownik i o którym Sawa teraz mówi. */
  activeIndex: number;
  onBack: () => void;
  isDesktop: boolean;
  isPlaying: boolean;
  /** Ile bieżącego tematu już padło (0–100). */
  progress: number;
  /** Ile słów `storyText` Sawa już zaczęła mówić (`StoryPlayer.spokenWords`). */
  spokenWords: number;
  /** Za ile sekund pierwsze miejsce; do tego czasu Sawa milczy. Null, gdy już może mówić. */
  waitSec: number | null;
  storyText: string | null;
  storyState: "loading" | "ready" | "failed";
  /** Całe dotychczasowe opowiadanie, ostatni fragment jest na żywo. */
  transcript: TranscriptPart[];
  /** Nagłówek z nazwą miejsca (`PodcastHeader`), na samej górze arkusza; sterowanie jest w doku. */
  header: ReactNode;
  /** Pod tekstem bieżącej opowieści, np. miejsce obok, które Sawa poleca (`StorySuggestion`). */
  storyFooter?: ReactNode;
};

/* ------------------------------------------------------------------ */
/* Wspólne klocki                                                      */
/* ------------------------------------------------------------------ */

function EndPill({ end }: { end: RouteLiveProps["end"] }) {
  if (!end) return null;
  return (
    <p
      role={end.reached ? undefined : "status"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${
        end.reached ? "bg-mieta-jasna text-glebia" : "bg-koral/15 text-tekst"
      }`}
    >
      <PinIcon className="size-4 shrink-0" />
      {end.label}
    </p>
  );
}

/**
 * Tekst na żywo: wypowiedziane słowa pełnym kolorem, reszta jaśniej (jak napisy karaoke).
 * Przy strumieniu tekst rośnie, a granica idzie za głosem.
 */
function LiveText({
  text,
  spokenWords,
  state,
  className = "",
  edgeRef,
}: {
  text: string | null;
  spokenWords: number;
  state: RouteLiveProps["storyState"];
  className?: string;
  /** Znacznik w miejscu, do którego doszedł głos (do przewijania za nim). */
  edgeRef?: Ref<HTMLSpanElement>;
}) {
  const t = useT();
  const waitText = useStoryWaitMessage(state === "loading");
  if (state === "failed") {
    return (
      <p className={`text-tekst-3 ${className}`}>
        {t(
          "Tu Sawa milczy. Odezwie się przy następnym miejscu.",
          "Sawa is quiet here. She'll speak up at the next place.",
        )}
      </p>
    );
  }
  if (state === "loading" || !text) {
    // Szkielet akapitu w miejscu tekstu, nad nim to, co Sawa teraz robi
    return (
      <div aria-live="polite" className="flex flex-col gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-tekst-3">
          <Spinner className="size-3.5 text-glebia" />
          <RollingText
            text={waitText ?? t("Sawa zbiera myśli…", "Sawa is gathering her thoughts…")}
          />
        </p>
        <SkeletonLines lines={3} className="[&>span]:h-3.5" />
      </div>
    );
  }
  const cut = spokenCut(text, spokenWords);
  return (
    <p aria-live="off" className={className}>
      <span className="text-tekst transition-colors">{text.slice(0, cut)}</span>
      <span ref={edgeRef} />
      <span className="text-tekst-3/70">{text.slice(cut)}</span>
    </p>
  );
}

const PREVIEW_FACTS = 3;

/**
 * Zanim Sawa zacznie mówić: to, co baza wie o miejscu (zdjęcie, epoka, adres, kilka faktów),
 * żeby arkusz nie był pusty. Sawa milczy, aż dojedziesz albo stukniesz odtwarzanie.
 */
function PlacePreview({ placeId }: { placeId: string }) {
  const t = useT();
  const detail = usePlace(placeId);
  const hint = (
    <p className="text-[15px] leading-relaxed text-tekst-3">
      {t(
        "Sawa opowie więcej na miejscu. Nie chcesz czekać? Stuknij odtwarzanie.",
        "Sawa will tell you more when you get there. Don't want to wait? Tap play.",
      )}
    </p>
  );
  if (detail.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <SkeletonLines lines={3} className="[&>span]:h-3.5" />
      </div>
    );
  }
  if (!detail.data) return hint;
  return (
    <div className="flex flex-col gap-4">
      <PlaceFacts place={detail.data} />
      {hint}
    </div>
  );
}

function PlaceFacts({ place }: { place: Place }) {
  const lang = useLang();
  const photo = place.photos[0];
  const meta = [place.period, place.addressToday].filter(Boolean).join(" · ");
  // Fakty są po polsku; po angielsku pokazujemy krótki opis, jeśli jest
  const facts =
    lang === "en" && place.summaryEn ? [place.summaryEn] : place.facts.slice(0, PREVIEW_FACTS);
  return (
    <>
      {photo && (
        <figure>
          <FadeImage
            src={photo.url}
            alt={photo.caption ?? place.name}
            className="aspect-[16/9] w-full rounded-xl"
          />
          <figcaption className="mt-1 text-xs text-tekst-3">
            {[photo.caption, photo.year, photo.author, photo.license].filter(Boolean).join(" · ")}
          </figcaption>
        </figure>
      )}
      {meta && <p className="text-[13px] font-semibold text-tekst-3">{meta}</p>}
      {facts.length > 0 && (
        <ul className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-tekst">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ekran: jeden ciągły zapis tego, co mówi Sawa, jak napisy w radiu   */
/* ------------------------------------------------------------------ */

/** Wysokość zapisu (od góry), na której trzymamy granicę wypowiedzianych słów. */
const FOLLOW_AT = 0.66;

/** Po tylu ms bez zdarzenia scroll uznajemy, że przewijanie (z bezwładnością) się skończyło. */
const SETTLE_MS = 140;

/** Odległość granicy słów od górnej krawędzi widocznego zapisu. */
function edgeOffset(el: HTMLElement, edge: HTMLElement) {
  return edge.getBoundingClientRect().top - el.getBoundingClientRect().top;
}

export function RouteLive({
  durationMin,
  end,
  legs,
  attribution,
  stops,
  activeIndex,
  isDesktop,
  isPlaying,
  progress,
  spokenWords,
  waitSec,
  storyText,
  storyState,
  transcript,
  header,
  storyFooter,
}: RouteLiveProps) {
  const t = useT();
  const waiting = waitSec !== null;
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLSpanElement>(null);
  const [{ following }, dispatch] = useReducer(followReducer, FOLLOW_INITIAL);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stop = stops[activeIndex];
  const past = transcript.filter((part) => part.stopIndex < activeIndex);

  // Zapis jedzie za głosem (granica wypowiedzianych słów na ok. 2/3 wysokości),
  // dopóki użytkownik sam nie przewinie (lib/transcript-follow.ts). Reduced motion: bez płynnego przewijania
  // biome-ignore lint/correctness/useExhaustiveDependencies: przewijamy przy każdym nowym słowie
  useEffect(() => {
    const el = scrollRef.current;
    const edge = edgeRef.current;
    if (!el || !following) return;
    // Zanim Sawa zacznie mówić, podgląd miejsca czyta się od góry
    const top = waiting
      ? 0
      : edge
        ? edgeOffset(el, edge) + el.scrollTop - el.clientHeight * FOLLOW_AT
        : el.scrollHeight;
    if (Math.abs(el.scrollTop - top) < 4) return;
    el.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }, [following, waiting, progress, storyText, activeIndex, reduce]);

  // Koniec przewijania: jeśli użytkownik sam wrócił granicą słów na jej wysokość, zapis znowu jedzie za głosem
  function settleSoon() {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      const edge = edgeRef.current;
      if (!el) return;
      const edgeGapPx = edge ? edgeOffset(el, edge) - el.clientHeight * FOLLOW_AT : null;
      dispatch({ type: "settle", edgeGapPx, viewportPx: el.clientHeight });
    }, SETTLE_MS);
  }
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // Palec albo przycisk myszy (także na pasku przewijania) trzyma zapis. Puszczenie łapiemy na oknie,
  // bo kursor mógł zjechać poza zapis
  function hold() {
    dispatch({ type: "hold" });
    const release = () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", release);
      dispatch({ type: "release" });
      settleSoon();
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("touchend", release);
    window.addEventListener("touchcancel", release);
  }

  // Przewinięcie odpina zapis tylko wtedy, gdy robi je użytkownik; nasze scrollTo leci bez trzymania
  function onScroll() {
    dispatch({ type: "scroll" });
    settleSoon();
  }

  return (
    <div className="flex flex-col gap-4">
      {isDesktop && <SawaMenuButton variant="inline" />}
      {header}
      {/* Zapis wypełnia miejsce między nagłówkiem a dokiem (wysokości mierzy arkusz) */}
      <div className="relative">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: zdarzenia tylko rozpoznają przewijanie przez użytkownika */}
        <div
          ref={scrollRef}
          onTouchStart={hold}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") hold();
          }}
          onWheel={(e) => {
            if (e.deltaY !== 0) dispatch({ type: "user-scroll" });
          }}
          onKeyDown={(e) => {
            if (SCROLL_KEYS.has(e.key)) dispatch({ type: "user-scroll" });
          }}
          onScroll={onScroll}
          className="h-[max(160px,calc(var(--trasa-widoczne,60dvh)-var(--trasa-glowa,150px)-var(--trasa-dok,190px)-16px))] touch-pan-y overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_28px,black_calc(100%-24px),transparent)]"
        >
          <div className="pb-[40%] pt-6">
            {past.map((part) => (
              <section key={part.stopIndex} className="mb-4">
                <p className="mb-1 text-xs font-bold text-tekst-3">
                  {part.stopIndex + 1} · {stops[part.stopIndex]?.name}
                </p>
                <p className="text-[15px] leading-relaxed text-tekst-3">{part.text}</p>
              </section>
            ))}
            {stop && (
              <section>
                {/* Bez etykiety: nazwa bieżącego miejsca jest w nagłówku tuż nad zapisem */}
                {!waiting && <StoryPhotos placeId={stop.id} name={stop.name} className="mb-4" />}
                {waiting ? (
                  <PlacePreview placeId={stop.id} />
                ) : (
                  <LiveText
                    text={storyText}
                    spokenWords={spokenWords}
                    state={storyState}
                    edgeRef={edgeRef}
                    className="text-[19px] font-medium leading-[1.5] tracking-[-0.005em]"
                  />
                )}
                {!waiting && storyFooter}
              </section>
            )}
          </div>
        </div>
        <AnimatePresence>
          {!following && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={SPRING}
              onClick={() => dispatch({ type: "resume" })}
              className="szklo absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold"
            >
              <LiveDot on={isPlaying} />
              {t("Wróć do Sawy", "Back to Sawa")}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {activeIndex === stops.length - 1 && <EndPill end={end} />}

      <Itinerary legs={legs} duration={formatDuration(durationMin)} />

      <Attribution lines={attribution} />
    </div>
  );
}

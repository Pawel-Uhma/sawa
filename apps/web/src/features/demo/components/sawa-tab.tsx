"use client";

import { useMemo } from "react";
import { RollingText, SkeletonLines, Spinner } from "@/components/waiting";
import { useLang, useT } from "@/features/i18n";
import { formatWhen } from "../lib/format";
import type { PlaceMemory } from "../lib/memory";
import type { MockStop } from "../lib/mock-data";
import type { StoryPlayer } from "../lib/story-player";
import { useStoryWaitMessage } from "../lib/story-wait";
import { FloatingCard, Grabber } from "./floating-card";
import { CloseIcon, PauseIcon, PlayIcon, SkipNextIcon, SkipPrevIcon } from "./icons";
import { SawaHead } from "./logo";
import { StoryPhotos } from "./story-photos";

type SawaTabProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Punkty trasy; pusta lista znaczy, że nie ma jeszcze trasy. */
  stops: MockStop[];
  activeIndex: number;
  player: StoryPlayer;
  /** Co Sawa już opowiedziała, po id miejsca (lib/memory.ts). */
  places: Record<string, PlaceMemory>;
  onPrev: () => void;
  onNext: () => void;
  /** Powrót na mapę (nie ma już paska zakładek). */
  onClose: () => void;
};

/** Podgląd podcastu: co Sawa mówi teraz, sterowanie i lista miejsc, o których już opowiedziała. */
export function SawaTab({
  collapsed,
  onCollapsedChange,
  stops,
  activeIndex,
  player,
  places,
  onPrev,
  onNext,
  onClose,
}: SawaTabProps) {
  const t = useT();
  const lang = useLang();
  const stop = stops[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < stops.length - 1;
  const words = useMemo(() => player.text?.split(/\s+/) ?? [], [player.text]);
  const spoken = player.spokenWords;
  const told = useMemo(() => Object.entries(places).sort(([, a], [, b]) => b.at - a.at), [places]);

  const waitText = useStoryWaitMessage(Boolean(stop) && player.loading);
  const status = !stop
    ? t("Ułóż trasę, to coś opowiem", "Plan a route and I'll tell you something")
    : player.loading
      ? t("Szykuję opowieść…", "Getting a story ready…")
      : player.failed
        ? t("Tym razem cisza", "Quiet this time")
        : player.isPlaying
          ? t("Opowiada", "Telling a story")
          : t("Wstrzymana", "Paused");

  return (
    <FloatingCard
      label="Sawa"
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      peekPx={88}
      className="flex flex-col gap-4 rounded-[32px] p-5 md:p-6"
    >
      <Grabber />
      <div className="flex items-center gap-3">
        <SawaHead className="size-14" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-extrabold leading-tight tracking-[-0.02em]">Sawa</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-glebia">
            {stop && player.loading && <Spinner className="size-3" />}
            {status}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("Wróć do mapy", "Back to the map")}
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center self-start rounded-full bg-tekst/[0.06] text-tekst-2 transition-transform duration-100 active:scale-[0.92]"
        >
          <CloseIcon className="size-[18px]" />
        </button>
      </div>

      <div
        data-scroll="true"
        className="flex max-h-[55vh] touch-pan-y flex-col gap-5 overflow-y-auto overscroll-contain md:max-h-[70vh]"
      >
        {stop && (
          <section aria-label={t("Teraz opowiada", "Now telling")} className="flex flex-col gap-3">
            <div>
              <p className="etykieta">
                {t(
                  `Punkt ${activeIndex + 1} z ${stops.length} · po ok. ${stop.etaMin} min`,
                  `Stop ${activeIndex + 1} of ${stops.length} · after about ${stop.etaMin} min`,
                )}
              </p>
              <h3 className="text-[17px] font-extrabold leading-snug tracking-[-0.01em]">
                {stop.name}
              </h3>
            </div>

            <StoryPhotos placeId={stop.id} name={stop.name} />

            {/* Transkrypcja: słowa już wypowiedziane są ciemniejsze, reszta jaśniejsza */}
            <p className="min-h-[72px] text-[15px] leading-relaxed text-tekst-3">
              {player.text ? (
                words.map((word, index) => (
                  <span
                    // Słowa nie zmieniają się w trakcie opowieści, więc indeks jest kluczem
                    // biome-ignore lint/suspicious/noArrayIndexKey: stała lista słów
                    key={index}
                    className={index < spoken ? "text-tekst" : undefined}
                  >
                    {word}{" "}
                  </span>
                ))
              ) : player.failed ? (
                t("Tym razem Sawa nic nie powie.", "Sawa won't say anything this time.")
              ) : (
                <span aria-live="polite" className="flex flex-col gap-3 pt-1">
                  <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
                    <Spinner className="size-3.5 text-glebia" />
                    <RollingText
                      text={waitText ?? t("Sawa zbiera myśli…", "Sawa is gathering her thoughts…")}
                    />
                  </span>
                  <SkeletonLines lines={3} />
                </span>
              )}
            </p>

            <div
              role="progressbar"
              aria-label={t("Postęp opowieści", "Story progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(player.progress)}
              className="h-1.5 overflow-hidden rounded-full bg-tlo-2"
            >
              <div
                className="h-full origin-left rounded-full bg-glebia"
                style={{ transform: `scaleX(${player.progress / 100})` }}
              />
            </div>

            <div className="flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={onPrev}
                disabled={!hasPrev}
                aria-label={t("Poprzedni punkt", "Previous stop")}
                className="flex size-12 items-center justify-center rounded-full text-tekst transition-[transform,opacity,background-color] hover:bg-tlo-2 active:scale-[0.92] disabled:opacity-30"
              >
                <SkipPrevIcon className="size-6" />
              </button>
              <button
                type="button"
                onClick={player.toggle}
                aria-label={player.isPlaying ? t("Pauza", "Pause") : t("Odtwarzaj", "Play")}
                className="flex size-16 items-center justify-center rounded-full bg-glebia text-white shadow-[0_6px_16px_rgba(23,112,111,0.3)] transition-[transform,background-color] hover:bg-glebia-ciemna active:scale-[0.92]"
              >
                {player.isPlaying ? (
                  <PauseIcon className="size-7" />
                ) : (
                  <PlayIcon className="size-7 translate-x-[1px]" />
                )}
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!hasNext}
                aria-label={t("Następny punkt", "Next stop")}
                className="flex size-12 items-center justify-center rounded-full text-tekst transition-[transform,opacity,background-color] hover:bg-tlo-2 active:scale-[0.92] disabled:opacity-30"
              >
                <SkipNextIcon className="size-6" />
              </button>
            </div>

            <button
              type="button"
              onClick={player.more}
              disabled={!player.text}
              className="h-11 rounded-full bg-mieta-jasna text-sm font-bold text-glebia-ciemna transition-[transform,opacity] hover:bg-mieta active:scale-[0.97] disabled:opacity-40"
            >
              {t("Opowiedz więcej o tym miejscu", "Tell me more about this place")}
            </button>
          </section>
        )}

        <section
          aria-label={t("Co już opowiedziała", "What she's told you")}
          className="flex flex-col gap-2"
        >
          <p className="etykieta">{t("Co już opowiedziała", "What she's told you")}</p>
          {told.length === 0 ? (
            <p className="text-sm leading-snug text-tekst-2">
              {t(
                "Po pierwszej opowieści zobaczysz tu miejsca, o których mówiła, i kiedy.",
                "After the first story you'll see here the places she talked about, and when.",
              )}
            </p>
          ) : (
            <ul className="flex flex-col">
              {told.map(([id, place]) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 border-t border-tlo-2 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-semibold">
                    {place.name ?? t("Miejsce z trasy", "A place on the route")}
                  </span>
                  <time
                    dateTime={new Date(place.at).toISOString()}
                    className="shrink-0 text-tekst-3 tabular-nums"
                  >
                    {formatWhen(place.at, Date.now(), lang)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </FloatingCard>
  );
}

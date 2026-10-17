"use client";

import type { Story } from "@sawa/shared";
import { motion, useReducedMotion } from "motion/react";
import { SkeletonLines, Spinner } from "@/components/waiting";
import { useT } from "@/features/i18n";
import type { Listener } from "../lib/api-data";
import { SPRING } from "../lib/device";
import { usePlaceStory } from "../lib/place-story";
import { PauseIcon, PlayIcon } from "./icons";

type StorySuggestionProps = {
  suggestion: NonNullable<Story["suggestion"]>;
  listener: Listener;
};

/**
 * Po „Więcej”, gdy o miejscu nic nowego nie zostało: Sawa poleca miejsce obok. Stuknięcie
 * odtwarza opowieść o nim jak z karty miejsca (dygresja: trasa cichnie i wraca po niej).
 */
export function StorySuggestion({ suggestion, listener }: StorySuggestionProps) {
  const t = useT();
  const reduce = useReducedMotion();
  const story = usePlaceStory(suggestion.placeId, listener);
  const isPlaying = story.state === "playing";
  const label = {
    idle: t("Opowiedz o miejscu obok", "Tell me about the place nearby"),
    loading: t("Sawa sobie przypomina…", "Sawa is remembering…"),
    playing: t("Pauza", "Pause"),
    paused:
      story.progress >= 100 ? t("Jeszcze raz", "Play again") : t("Słuchaj dalej", "Keep listening"),
    failed: t("Spróbuj jeszcze raz", "Try again"),
  }[story.state];

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="mt-4 flex flex-col gap-3"
    >
      <button
        type="button"
        onClick={story.toggle}
        aria-label={`${label}: ${suggestion.name}`}
        className="relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-[18px] bg-mieta-jasna px-4 py-2.5 text-left text-glebia-ciemna transition-[transform,background-color] duration-150 hover:bg-mieta active:scale-[0.97]"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-full origin-left bg-glebia/10"
          style={{ transform: `scaleX(${story.state === "idle" ? 0 : story.progress / 100})` }}
        />
        <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-glebia text-white">
          {story.state === "loading" ? (
            <Spinner className="size-4" />
          ) : isPlaying ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4 translate-x-[1px]" />
          )}
        </span>
        <span className="relative flex min-w-0 flex-col leading-tight">
          <span className="text-[13px] font-semibold">{label}</span>
          <span className="truncate text-[15px] font-bold">{suggestion.name}</span>
        </span>
      </button>
      {story.state === "loading" && !story.text && <SkeletonLines lines={2} />}
      {story.text && (
        <p aria-live="polite" className="text-[15px] leading-relaxed text-tekst-2">
          {story.text}
        </p>
      )}
    </motion.div>
  );
}

"use client";

import type { Story } from "@sawa/shared";
import { useSyncExternalStore } from "react";

// Pamięć Sawy o słuchaczu: które fakty o których miejscach już opowiedziała i jakie tło wyjaśniła.
// Żyje w localStorage tego urządzenia (bez logowania). Bez localStorage działa do odświeżenia strony.

const KEY = "sawa.memory.v1";

/** Ile opowieści trzeba wysłuchać, żeby uznać ją za opowiedzianą (procent postępu). */
export const HEARD_AT_PROGRESS = 50;

export type PlaceMemory = { name?: string; facts: string[]; at: number };
export type Memory = { places: Record<string, PlaceMemory>; contexts: string[] };

const EMPTY: Memory = { places: {}, contexts: [] };

let current: Memory | null = null;
const listeners = new Set<() => void>();

function read(): Memory {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Memory>;
    return { places: parsed.places ?? {}, contexts: parsed.contexts ?? [] };
  } catch {
    return EMPTY;
  }
}

function write(next: Memory) {
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Tryb prywatny albo brak miejsca: pamięć zostaje tylko w tej karcie.
  }
  for (const listener of listeners) listener();
}

export function getMemory(): Memory {
  if (typeof window === "undefined") return EMPTY;
  current ??= read();
  return current;
}

/** Zapisuje wysłuchaną opowieść: jej fakty, wyjaśnione tło i nazwę miejsca (do listy „co już opowiedziała”). */
export function rememberStory(
  story: Pick<Story, "placeId" | "factIds" | "contextIds"> & { placeName?: string },
) {
  const memory = getMemory();
  const previous = memory.places[story.placeId];
  const facts = [...new Set([...(previous?.facts ?? []), ...story.factIds])];
  const contexts = [...new Set([...memory.contexts, ...story.contextIds])];
  const name = story.placeName ?? previous?.name;
  write({
    places: { ...memory.places, [story.placeId]: { name, facts, at: Date.now() } },
    contexts,
  });
}

export function forgetAll() {
  write(EMPTY);
}

/**
 * Dla planera: id miejsca → ile faktów już padło (`PlanRouteRequest.heard`). Miejsce, o którym
 * Sawa mówiła bez nowych faktów (przypomnienie, sama nazwa), liczy się jako jeden, żeby planer
 * też je omijał.
 */
export function heardCounts(memory: Memory): Record<string, number> {
  return Object.fromEntries(
    Object.entries(memory.places).map(([id, place]) => [id, Math.max(1, place.facts.length)]),
  );
}

/** Opowiedziane miejsca od najnowszego (lista „co już opowiedziała”). */
export function toldNewestFirst(memory: Memory): Array<PlaceMemory & { id: string }> {
  return Object.entries(memory.places)
    .map(([id, place]) => ({ id, ...place }))
    .sort((a, b) => b.at - a.at);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMemory(): Memory {
  return useSyncExternalStore(subscribe, getMemory, () => EMPTY);
}

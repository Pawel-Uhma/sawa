"use client";

import { useSyncExternalStore } from "react";

/**
 * Sawa ma jeden głos. Kto ostatni zaczął mówić, ten go ma: opowieść o miejscu z karty przerywa
 * opowieść trasy (dygresja), a stuknięcie w odtwarzanie trasy ucisza dygresję.
 * Trasa wraca sama, gdy dygresja odda głos (koniec, błąd, zamknięta karta).
 */
export const ROUTE_VOICE = "route";

let owner: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Bierze głos; poprzedni mówca cichnie. */
export function claimVoice(who: string) {
  if (owner === who) return;
  owner = who;
  emit();
}

/** Oddaje głos, o ile nikt go w międzyczasie nie przejął. */
export function releaseVoice(who: string) {
  if (owner !== who) return;
  owner = null;
  emit();
}

export function voiceOwner(): string | null {
  return owner;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVoiceOwner(): string | null {
  return useSyncExternalStore(subscribe, voiceOwner, () => null);
}

/** Czy teraz mówi dygresja, czyli ktoś inny niż trasa. */
export function isAside(who: string | null): boolean {
  return who !== null && who !== ROUTE_VOICE;
}

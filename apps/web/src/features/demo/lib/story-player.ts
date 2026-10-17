"use client";

import { MAX_HEARD_PLACES, type Side, type Story } from "@sawa/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Listener } from "./api-data";
import { getMemory, HEARD_AT_PROGRESS, rememberStory } from "./memory";
import type { MockStop } from "./mock-data";
import { etaSecOf } from "./ride-clock";
import { claimVoice, isAside, ROUTE_VOICE, useVoiceOwner } from "./voice";

/**
 * Sawa's voice reads about 17 characters a second (measured with whisper on three stories, 17.10).
 * Characters follow the voice closer than words: long words take longer to say.
 */
const CHARS_PER_SEC = 17.2;
/** The highlight runs this far ahead, so a word lights up as Sawa starts it, not after it. */
const LEAD_CHARS = 3;
/** Without a next stop Sawa gets a medium story. */
const LAST_STOP_SEC = 75;
const MIN_TARGET_SEC = 20;
const MAX_TARGET_SEC = 600;
/** Sawa stays quiet at a dull place: the card says so this long, then the topic ends. */
const SILENT_MS = 1500;
const SILENT_TEXT = "Tu jedziemy dalej.";
/** When even the story text fails, the card waits this long and moves on. */
const FAILED_STORY_MS = 6000;
/** Przerwany temat cichnie zamiast urywać się w pół słowa. */
const FADE_OUT_MS = 350;
/** Nowy temat wchodzi łagodnie. */
const FADE_IN_MS = 500;
/** Oddech Sawy między tematami, gdy poprzedni skończył się sam. */
const BREATH_MS = 600;

/**
 * Płynnie zmienia głośność. Na iOS `volume` jest tylko do odczytu, więc tam zostaje
 * sama pauza o tej długości, bez wyciszenia. Nowe przejście przerywa poprzednie (`token`).
 */
function fadeVolume(
  audio: HTMLAudioElement,
  to: number,
  ms: number,
  token: { current: number },
): Promise<void> {
  const id = ++token.current;
  const from = audio.volume;
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const tick = (now: number) => {
      if (token.current !== id) return resolve();
      const t = Math.min(1, (now - startedAt) / ms);
      audio.volume = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Czy element gra właśnie ten klip (a nie poprzedni, który jeszcze cichnie). */
function isLoaded(audio: HTMLAudioElement, clip: Clip | null): boolean {
  return Boolean(clip?.audioUrl) && audio.getAttribute("src") === clip?.audioUrl;
}

/**
 * What a story told, for the listener's memory. `suggestion`: nothing new was left here, Sawa
 * offers the place next door instead.
 */
export type Told = Pick<Story, "placeId" | "factIds" | "contextIds" | "suggestion"> & {
  placeName?: string;
};

/**
 * One story being told: the voice streams from `audioUrl` while the API still writes the text,
 * which `useLiveText` follows. Without the voice the story comes whole (`text`, `told`).
 */
export type Clip = {
  id: string;
  audioUrl: string | null;
  placeId: string;
  placeName?: string;
  text?: string;
  told?: Told;
  /** Nothing worth telling here (`Story.silent`): no voice, the topic ends at once. */
  silent?: boolean;
};

/**
 * Sawa may talk until the next stop: the planner's window (it knows the story style's limits),
 * else the time between the two stops.
 */
export function targetSecFor(stops: readonly MockStop[], index: number): number {
  const stop = stops[index];
  const next = stops[index + 1];
  const sec = stop?.windowSec ?? (stop && next ? etaSecOf(next) - etaSecOf(stop) : LAST_STOP_SEC);
  return Math.min(MAX_TARGET_SEC, Math.max(MIN_TARGET_SEC, Math.round(sec)));
}

/**
 * A clip depends on who listens and how long Sawa may talk, not only on the stop (T-93):
 * after a change of interests or ride length the old story must not play.
 */
export function clipKey(stopId: string, listener: Listener, targetSec: number): string {
  return JSON.stringify([stopId, targetSec, listener]);
}

/**
 * The voice (ElevenLabs) is off by default because it burns credits. `?voice=1` in the URL turns it on.
 * Without it the story text still shows and runs on a timer. On the pitch the API serves recorded
 * voice (DEMO_MODE=replay), so `NEXT_PUBLIC_VOICE=1` turns it on for everyone; `?voice=0` turns it off.
 */
export function voiceOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("voice");
    return param === null ? process.env.NEXT_PUBLIC_VOICE === "1" : param === "1";
  } catch {
    return false;
  }
}

/**
 * Starts a story with what Sawa already told this listener, so it tells something new.
 * With the voice it answers at once: the voice starts on the first sentence while the rest is
 * still written. Without it the whole text comes in one answer, and no credits are spent.
 */
export async function fetchClip(
  placeId: string,
  listener: Listener,
  targetSec: number,
  placeName?: string,
  side?: Side,
  /** „Więcej o tym miejscu”: gdy nic nowego nie zostało, Sawa poleca miejsce obok. */
  { more = false }: { more?: boolean } = {},
): Promise<Clip> {
  const memory = getMemory();
  const heardAt = memory.places[placeId]?.at;
  const json = {
    placeId,
    targetSec,
    side,
    ...listener,
    heardFacts: memory.places[placeId]?.facts ?? [],
    knownContexts: memory.contexts,
    // Sawa mówi „tydzień temu opowiadałam ci…”, a nie „pamiętasz…”.
    heardAgoSec:
      heardAt === undefined ? undefined : Math.max(0, Math.floor((Date.now() - heardAt) / 1000)),
    ...(more && { more, heardPlaceIds: Object.keys(memory.places).slice(-MAX_HEARD_PLACES) }),
  };
  if (!voiceOn()) {
    const res = await api.v1.stories.$post({ json });
    if (!res.ok) throw new Error(`POST /v1/stories: ${res.status}`);
    const { text, factIds, contextIds, suggestion, silent } = await res.json();
    const told = { placeId, factIds, contextIds, suggestion, placeName };
    const id = `${placeId}:${Date.now()}`;
    return { id, audioUrl: null, placeId, placeName, text, told, silent };
  }
  const res = await api.v1.stories.live.$post({ json });
  if (!res.ok) throw new Error(`POST /v1/stories/live: ${res.status}`);
  const { id } = await res.json();
  const audioUrl = api.v1.stories.live[":id"].audio.$url({ param: { id } }).toString();
  return { id, audioUrl, placeId, placeName };
}

/** The text of a clip as Sawa writes it; `told` once it is finished. */
export type LiveText = {
  text: string | null;
  done: boolean;
  told: Told | null;
  failed: boolean;
  /** Sawa has nothing worth telling here and stays quiet (`Story.silent`). */
  silent?: boolean;
  /** When each word starts in the voice (seconds), as far as the voice is made; API may not know. */
  wordTimes?: number[];
};

const NO_TEXT: LiveText = { text: null, done: false, told: null, failed: false };
/** The text grows a sentence or two a second; this keeps the card close behind the voice. */
const POLL_MS = 400;

/** Follows a clip's text (GET /v1/stories/live/:id) until the story is finished. */
export function useLiveText(clip: Clip | null): LiveText {
  const [live, setLive] = useState<LiveText>(NO_TEXT);
  useEffect(() => {
    setLive(NO_TEXT);
    if (!clip) return;
    if (clip.text !== undefined) {
      const { text, told, silent } = clip;
      setLive({ text, done: true, told: told ?? null, failed: !text, silent });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await api.v1.stories.live[":id"].$get({ param: { id: clip.id } });
        if (!res.ok) throw new Error(`GET /v1/stories/live: ${res.status}`);
        const { text, done, story, wordTimes } = await res.json();
        if (cancelled) return;
        const told = story && {
          placeId: clip.placeId,
          factIds: story.factIds,
          contextIds: story.contextIds,
          suggestion: story.suggestion,
          placeName: clip.placeName,
        };
        const silent = story?.silent;
        setLive({
          text: text || null,
          done,
          told,
          failed: done && !story && !text,
          silent,
          wordTimes,
        });
        if (!done) timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!cancelled) setLive((l) => ({ ...l, done: true, failed: !l.text }));
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clip]);
  return live;
}

/**
 * Progress of a voice that may still be streaming: its length is known only at the end, so
 * until then it is guessed from the words written so far (never 100 before `ended`).
 */
export function audioProgress(audio: HTMLAudioElement, live: LiveText): number {
  if (live.done && Number.isFinite(audio.duration) && audio.duration > 0) {
    return Math.min(100, (audio.currentTime / audio.duration) * 100);
  }
  const chars = live.text?.length ?? 0;
  if (!chars) return 0;
  const guess = chars / CHARS_PER_SEC;
  // Pobrany kawałek głosu nie jest dłuższy niż całość, więc przy gotowym tekście ogranicza zgadywanie.
  const total = live.done ? Math.max(guess, bufferedEnd(audio)) : guess;
  return Math.min(99, (audio.currentTime / total) * 100);
}

function bufferedEnd(audio: HTMLAudioElement): number {
  const { buffered } = audio;
  return buffered.length ? buffered.end(buffered.length - 1) : 0;
}

/** How long Sawa takes to read a text, for the timer when there is no voice. */
export function speakingMs(text: string | null): number {
  return text ? (text.length / CHARS_PER_SEC) * 1000 : 0;
}

/**
 * Where the spoken part of `text` ends at `progress` (0–100): the end of the word Sawa is saying
 * now, so the highlight shows the current word, not the last finished one.
 */
export function spokenLength(text: string, progress: number): number {
  if (progress <= 0) return 0;
  const at = Math.floor((progress / 100) * text.length) + LEAD_CHARS;
  if (at >= text.length) return text.length;
  const rest = text.slice(at).search(/\s/);
  return rest < 0 ? text.length : at + rest;
}

/** The highlight runs this far ahead of the voice, so a word lights up as Sawa starts it. */
const LEAD_SEC = 0.05;

/**
 * How many words of `text` Sawa has started saying. With the voice's word times (from the API)
 * it is the last word whose start has passed; without them, or past their end, the guess from
 * `progress` (characters per second), as in the timer without the voice.
 */
export function spokenWordCount(
  text: string | null,
  progress: number,
  wordTimes: readonly number[] | undefined,
  voiceSec: number | null,
): number {
  if (!text) return 0;
  const guess = text.slice(0, spokenLength(text, progress)).split(/\s+/).length;
  if (!wordTimes?.length || voiceSec === null) return guess;
  const words = text.split(/\s+/).length;
  let n = 0;
  while (n < wordTimes.length && (wordTimes[n] as number) <= voiceSec + LEAD_SEC) n++;
  // Times known past this moment: the voice is on word `n`.
  if (n < wordTimes.length || wordTimes.length >= words) return Math.min(n, words);
  return Math.min(words, Math.max(n, guess));
}

/** Where the first `words` words of `text` end, for cutting it into said and still to say. */
export function spokenCut(text: string, words: number): number {
  if (words <= 0) return 0;
  const word = /\S+/g;
  let end = 0;
  for (let i = 0; i < words; i++) {
    const m = word.exec(text);
    if (!m) return text.length;
    end = m.index + m[0].length;
  }
  return end;
}

/** Remembers a story once it was heard past `HEARD_AT_PROGRESS`, once per clip. */
export function useRememberHeard(clipId: string | undefined, told: Told | null, progress: number) {
  const remembered = useRef(new Set<string>());
  useEffect(() => {
    if (!clipId || !told || progress < HEARD_AT_PROGRESS || remembered.current.has(clipId)) return;
    remembered.current.add(clipId);
    rememberStory(told);
  }, [clipId, told, progress]);
}

/**
 * Plays the active stop's story with Sawa's voice and prefetches the next one.
 * The voice streams while the story is written; progress comes from the audio, and without
 * audio from the text length.
 */
export function useStoryPlayer(
  stops: readonly MockStop[],
  activeIndex: number,
  listener: Listener,
) {
  const cache = useRef(new Map<string, Promise<Clip>>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [startFailed, setStartFailed] = useState(false);
  const [voiceFailed, setVoiceFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  // Dygresja (opowieść z karty miejsca) ucisza trasę, ale nie zmienia zamiaru słuchania:
  // po jej końcu trasa wraca sama.
  const aside = isAside(useVoiceOwner());
  const speaking = isPlaying && !aside;
  const [progress, setProgress] = useState(0);
  // Where the voice of this clip is (seconds); another clip's position does not count.
  const [voiceAt, setVoiceAt] = useState<{ clipId: string; sec: number } | null>(null);
  const live = useLiveText(clip);
  const failed = startFailed || live.failed;
  const hasVoice = Boolean(clip?.audioUrl) && !voiceFailed;
  // Id punktu, który jest teraz aktywny: spóźniona odpowiedź z innego punktu nie może nadpisać klipu.
  const activeId = useRef<string | undefined>(undefined);
  // Efekty audio czytają bieżący stan bez ponownego uruchamiania przejścia.
  const clipRef = useRef<Clip | null>(null);
  clipRef.current = clip;
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const fadeToken = useRef(0);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    // Koniec starego klipu, który jeszcze cichł, nie kończy nowego tematu.
    const onEnded = () => isLoaded(audio, clipRef.current) && setProgress(100);
    // No voice (ElevenLabs down, quota): the card still shows the text and runs on a timer.
    const onError = () => audio.getAttribute("src") && setVoiceFailed(true);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.removeAttribute("src");
    };
  }, []);

  const load = useCallback(
    (index: number, more = false) => {
      const stop = stops[index];
      if (!stop) return null;
      const targetSec = targetSecFor(stops, index);
      const key = clipKey(stop.id, listener, targetSec);
      let pending = cache.current.get(key);
      if (!pending) {
        pending = fetchClip(stop.id, listener, targetSec, stop.name, stop.side, { more });
        cache.current.set(key, pending);
        pending.catch(() => cache.current.delete(key));
      }
      return pending;
    },
    [stops, listener],
  );

  useEffect(() => {
    let cancelled = false;
    activeId.current = stops[activeIndex]?.id;
    setClip(null);
    setStartFailed(false);
    setProgress(0);
    load(activeIndex)
      ?.then((next) => !cancelled && setClip(next))
      .catch(() => !cancelled && setStartFailed(true));
    return () => {
      cancelled = true;
    };
  }, [activeIndex, load, stops]);

  /**
   * „Więcej o tym miejscu”: uznaje obecną opowieść za znaną i prosi o nową o tym samym miejscu.
   * Pamięć idzie do zapytania, więc Sawa nie powtórzy faktów. Gdy nic nowego nie zostało, Sawa
   * mówi to i poleca miejsce obok (`suggestion`).
   */
  const more = useCallback(() => {
    const stop = stops[activeIndex];
    if (!stop || !clip || !live.told) return;
    rememberStory(live.told);
    claimVoice(ROUTE_VOICE);
    cache.current.delete(clipKey(stop.id, listener, targetSecFor(stops, activeIndex)));
    setClip(null);
    setStartFailed(false);
    setProgress(0);
    setIsPlaying(true);
    load(activeIndex, true)
      ?.then((next) => activeId.current === stop.id && setClip(next))
      .catch(() => activeId.current === stop.id && setStartFailed(true));
  }, [stops, activeIndex, clip, live.told, load, listener]);

  // The next story is written and voiced on the server before the tram gets there.
  useEffect(() => {
    if (live.done) load(activeIndex + 1)?.catch(() => {});
  }, [live.done, activeIndex, load]);

  // Zmiana tematu: stary klip cichnie (albo Sawa bierze oddech po jego końcu), nowy wchodzi łagodnie.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isLoaded(audio, clip)) return;
    setVoiceFailed(false);
    let cancelled = false;
    const hasSound = Boolean(audio.getAttribute("src"));
    const before = !hasSound
      ? Promise.resolve()
      : audio.ended
        ? wait(BREATH_MS)
        : audio.paused
          ? Promise.resolve()
          : fadeVolume(audio, 0, FADE_OUT_MS, fadeToken);
    before.then(() => {
      if (cancelled) return;
      if (!clip?.audioUrl) {
        audio.pause();
        audio.removeAttribute("src");
        return;
      }
      fadeToken.current++;
      audio.volume = 0;
      audio.src = clip.audioUrl;
      if (!speakingRef.current) {
        audio.volume = 1;
        return;
      }
      audio
        .play()
        .then(() => {
          if (!cancelled) return fadeVolume(audio, 1, FADE_IN_MS, fadeToken);
        })
        .catch(() => {
          audio.volume = 1;
          setIsPlaying(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [clip]);

  useEffect(() => {
    const audio = audioRef.current;
    // Przed wczytaniem klipu gra nim efekt przejścia wyżej.
    if (!audio || !hasVoice || !isLoaded(audio, clip)) return;
    if (!speaking) {
      // Dygresja wchodzi na wyciszaną trasę, pauza użytkownika zatrzymuje od razu.
      if (!aside || audio.paused) audio.pause();
      else
        fadeVolume(audio, 0, FADE_OUT_MS, fadeToken).then(
          () => !speakingRef.current && audio.pause(),
        );
      return;
    }
    // The browser blocks sound before the first tap; the play button then starts it.
    // Po dygresji trasa wraca łagodnie, tam gdzie przerwała.
    const fadeIn = audio.volume < 1;
    audio
      .play()
      .then(() => {
        if (fadeIn) return fadeVolume(audio, 1, FADE_IN_MS, fadeToken);
      })
      .catch(() => setIsPlaying(false));
  }, [speaking, aside, hasVoice, clip]);

  // Nic ciekawego w tym miejscu: Sawa milczy, temat kończy się po krótkiej pauzie.
  useEffect(() => {
    if (!speaking || !live.silent) return;
    const timer = setTimeout(() => setProgress(100), SILENT_MS);
    return () => clearTimeout(timer);
  }, [speaking, live.silent]);

  // Progress in animation frames, so the bar moves smoothly
  useEffect(() => {
    if (!speaking || (!clip && !failed) || live.silent) return;
    const audio = audioRef.current;
    // Without the voice the timer waits for the whole text, which says how long to wait.
    if (!hasVoice && !failed && !live.done) return;
    const timerMs = speakingMs(live.text) || FAILED_STORY_MS;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      if (hasVoice && audio) {
        // Cichnący poprzedni klip nie przesuwa paska nowego tematu.
        if (isLoaded(audio, clip) && !audio.ended) {
          setProgress(audioProgress(audio, live));
          if (clip) setVoiceAt({ clipId: clip.id, sec: audio.currentTime });
        }
      } else {
        setProgress((current) => Math.min(100, current + (delta / timerMs) * 100));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speaking, clip, failed, hasVoice, live]);

  useRememberHeard(clip?.id, live.told, progress);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const restart = progress >= 100;
    if (restart) setProgress(0);
    // W trakcie dygresji odtwarzanie znaczy „wróć do trasy”: dygresja cichnie, trasa gra dalej.
    if (aside) {
      claimVoice(ROUTE_VOICE);
      if (audio && hasVoice && isLoaded(audio, clip)) {
        fadeToken.current++;
        audio.volume = 1;
        if (restart) audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
      }
      setIsPlaying(true);
      return;
    }
    if (!isPlaying && audio && hasVoice && isLoaded(audio, clip)) {
      fadeToken.current++;
      audio.volume = 1;
      // Called inside the tap, so Safari lets the sound start.
      if (restart) audio.currentTime = 0;
      audio.play().catch(() => setIsPlaying(false));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, aside, progress, hasVoice, clip]);

  /** Bieżąca opowieść od początku; `keepPlaying: false` to „stop” (pauza na początku). */
  const restart = useCallback(
    (keepPlaying: boolean) => {
      const audio = audioRef.current;
      setProgress(0);
      if (keepPlaying) claimVoice(ROUTE_VOICE);
      if (audio && isLoaded(audio, clip)) {
        fadeToken.current++;
        audio.volume = 1;
        audio.currentTime = 0;
        // W geście stuknięcia, żeby Safari pozwolił na dźwięk.
        if (keepPlaying) audio.play().catch(() => setIsPlaying(false));
      }
      setIsPlaying(keepPlaying);
    },
    [clip],
  );

  const voiceSec = hasVoice && clip && voiceAt?.clipId === clip.id ? voiceAt.sec : null;

  return {
    text: live.silent ? SILENT_TEXT : live.text,
    /** Ile słów tekstu Sawa już zaczęła mówić (podświetlenie): z czasów głosu, bez nich zgadywane. */
    spokenWords: live.silent
      ? spokenWordCount(SILENT_TEXT, progress, undefined, null)
      : spokenWordCount(live.text, progress, live.wordTimes, voiceSec),
    loading: !failed && live.text === null,
    failed,
    /** Czy Sawa mówi teraz o trasie; w trakcie dygresji `false`, choć trasa wróci sama. */
    isPlaying: speaking,
    setIsPlaying,
    progress,
    /** Zeruje postęp w tym samym renderze co zmiana punktu, żeby koniec opowieści nie przeskoczył dwóch. */
    rewind: useCallback(() => setProgress(0), []),
    toggle,
    restart,
    more,
    /** Po „Więcej”, gdy o tym miejscu nic nowego nie zostało: miejsce obok, o którym Sawa opowie. */
    suggestion: live.told?.suggestion ?? null,
  };
}

export type StoryPlayer = ReturnType<typeof useStoryPlayer>;

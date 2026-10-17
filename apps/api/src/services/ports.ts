import type { Destination, LatLng, TrackLeg } from "@sawa/shared";
import type { BBox, Place, PlaceAlongLine, PlaceSummary } from "../domain/place";
import type { Network } from "../domain/routing/types";
import type { SpeechAudio } from "../domain/speech";
import type { VehicleReport } from "../domain/vehicles/types";
import type { CharTimes } from "../domain/word-times";

/** Interfaces services depend on; adapters implement them (docs/11-zasady-pracy-i-kodu.md §4). */

export interface PlacesRepository {
  /** Places inside the box, richest first. `interests` keeps places matching any of them. */
  listInBBox(bbox: BBox, interests?: string[]): Promise<PlaceSummary[]>;
  /** One place with facts, sources and photos; null when the id is unknown. */
  getById(id: string): Promise<Place | null>;
  /** Places within `radiusM` of the line, ordered from its start to its end. */
  listNearLine(line: LatLng[], radiusM: number, interests?: string[]): Promise<PlaceAlongLine[]>;
}

/** Real departures from dane.um.warszawa.pl; undefined when unknown (no token, timeout, no data). */
export interface DepartureSource {
  /** Departures of `line` from the platform on the Warsaw service day of `day`. */
  departures(stopId: string, line: string, day: Date): Promise<Date[] | undefined>;
}

/**
 * Live estimate of when the vehicle for a leg reaches its boarding stop (from ZTM positions).
 * Undefined when unknown: no token, stale positions, vehicle not found or too slow to answer.
 */
export interface LiveBoardingSource {
  boardAtMs(leg: TrackLeg): Promise<number | undefined>;
}

/** Live tram and bus positions (ZTM, refreshed every 10 s). Throws AppError when ZTM fails. */
export interface VehiclePositionSource {
  positions(): Promise<VehicleReport[]>;
}

/** Walking paths along streets and footways (OSRM foot profile). */
export interface WalkPathSource {
  /**
   * The path through `points` in order, as [lng, lat] pairs starting and ending at the first
   * and last point; undefined when unknown (router down, timeout, no path).
   */
  path(points: LatLng[]): Promise<[number, number][] | undefined>;
}

/** Tram and bus network for one service day (apps/api/data/transit/YYYY-MM-DD.json.gz). */
export type TransitData = {
  network: Network;
  serviceDate: string;
  attribution: string[];
};

/** Graphs for several service days, so the API switches at midnight without a rebuild (T-18). */
export type TransitCalendar = {
  /** Service days available, ascending. */
  dates: string[];
  /** The graph for `date`; without it the closest earlier day, before the first the first one. */
  forDate(date: string): TransitData;
};

export type LlmRequest = { system: string; user: string; maxTokens: number };

/** A web page the model read while answering. */
export type WebCitation = { url: string; title: string };

/** Chat model behind Sawa's words. Answers JSON text; throws AppError on upstream failure. */
export interface LlmProvider {
  /** Model id, logged next to every story. */
  readonly model: string;
  complete(request: LlmRequest): Promise<string>;
  /**
   * Same, but the model first searches the web with the user prompt as the query.
   * `citations` are the pages it got; missing when the provider cannot search.
   */
  completeWithWeb?(
    request: LlmRequest & { maxResults: number },
  ): Promise<{ content: string; citations: WebCitation[] }>;
  /** Same as `complete`, yielding the answer in pieces as the model writes it. */
  stream?(request: LlmRequest): AsyncIterable<string>;
}

/** Text-to-speech provider (ElevenLabs). Throws AppError on upstream failure or timeout. */
export interface SpeechSynthesizer {
  synthesize(text: string): Promise<SpeechAudio>;
  /**
   * mp3 bytes as they are made. `previousText` is what was already read, so a story said in
   * several pieces keeps one tone.
   */
  stream?(text: string, opts: { previousText: string }): AsyncIterable<Uint8Array>;
  /**
   * Like `stream`, with when each character of `text` is said: every piece has its mp3 bytes and
   * the characters it brought (often none), timed from the start of this clip.
   */
  streamWithTimes?(text: string, opts: { previousText: string }): AsyncIterable<TimedSpeech>;
}

/** A piece of a timed TTS stream. */
export type TimedSpeech = { audio: Uint8Array; times: CharTimes | null };

/** Finds a ride destination by name (Google Places). Throws AppError on upstream failure or timeout. */
export interface DestinationSearch {
  search(query: string): Promise<DestinationSearchResult>;
}

/** `partial`: one of the lookups failed (e.g. the street), so the answer must not be cached. */
export type DestinationSearchResult = { results: Destination[]; partial: boolean };

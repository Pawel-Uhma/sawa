import type { Story, StoryRequestInput } from "@sawa/shared";
import { contextFor, knownContextsOf } from "../domain/contexts";
import type { Place } from "../domain/place";
import {
  bandFor,
  bboxAround,
  cleanForSpeech,
  createStoryTextReader,
  type FactPick,
  factsStory,
  findingSources,
  fitWords,
  heardIntro,
  isGentleForKids,
  NEARBY_RADIUS_M,
  nearestUnheard,
  nothingNewText,
  parseStoryAnswer,
  pickFacts,
  type StoryDraft,
  spokenName,
  storyCacheKey,
  storyWords,
} from "../domain/story";
import { AppError } from "../lib/errors";
import { KIDS_STORY_SYSTEM_PROMPT, STORY_SYSTEM_PROMPT, storyUserPrompt } from "../prompts/story";
import type { LlmProvider, PlacesRepository } from "./ports";
import type { PlaceResearch } from "./research-place";

/** The demo replays the same route; stories stay in memory until story_cache lands (R2). */
const MAX_CACHED_STORIES = 500;
/** Polish runs about 2 tokens a word; the margin keeps the JSON from being cut off. */
const TOKENS_PER_WORD = 3;
/** The background takes at most this share of the story; the place itself comes first. */
const CONTEXT_WORD_SHARE = 0.4;

export type StoryService = {
  tell(request: StoryRequestInput): Promise<Story>;
  /** The same story, its text in pieces as the model writes it, so the voice can start early. */
  tellStream(request: StoryRequestInput): Promise<StoryStream>;
  /** Starts the research for a planned route's places, so their stories do not wait for it. */
  warm(placeIds: readonly string[]): void;
};

export type StoryStream = {
  text: AsyncIterable<string>;
  /** The whole text when it was known up front (cache, facts story): its voice may be cached. */
  whole?: string;
  /** The finished story, once `text` was read to the end. */
  story: Promise<Story>;
  /** Known up front: nothing worth telling, so there is no voice to make. */
  silent?: boolean;
};

export type StoryDeps = {
  /** `listInBBox` finds a place next door when nothing new is left to tell (`more`). */
  places: Pick<PlacesRepository, "getById" | "listInBBox">;
  /** Missing → every story is the place's facts read plainly (factsStory). */
  llm?: LlmProvider;
  /** Missing → stories use the seed's facts only. */
  research?: PlaceResearch;
  /** Called when the LLM fails and the facts story is used instead. */
  onLlmError?: (err: unknown, placeId: string) => void;
};

/** What the listener heard: the lines the model says it told, else all it was given. */
function toldIds(pick: FactPick, draft: StoryDraft) {
  if (pick.recap) return [];
  const offered = pick.facts.map((f) => f.id);
  const used = draft.usedIds.filter((id) => offered.includes(id));
  return used.length ? used : offered;
}

async function* once(text: string) {
  yield text;
}

/** A story known in full, as a stream of one piece; a silent one says nothing. */
const known = (story: Story): StoryStream =>
  story.silent
    ? { text: once(""), story: Promise.resolve(story), silent: true }
    : { text: once(story.text), whole: story.text, story: Promise.resolve(story) };

/**
 * Nothing worth telling here (only dry data, nothing found on the web): Sawa stays quiet, no
 * LLM, no voice. `text` is the place's name, for the card; the client does not read it out.
 */
const silentStory = (place: Place): Story => ({
  placeId: place.id,
  text: spokenName(place.name),
  sources: [],
  cached: false,
  factIds: [],
  contextIds: [],
  recap: false,
  suggestion: null,
  silent: true,
});

export function createStoryService({ places, llm, research, onLlmError }: StoryDeps): StoryService {
  const cache = new Map<string, Promise<StoryDraft>>();

  /**
   * The closest place around `place` the listener has not heard about, with something to tell;
   * null when there is none or the lookup fails (Sawa then just says she told everything).
   */
  async function nearby(place: Place, heardPlaceIds: readonly string[]) {
    try {
      const around = await places.listInBBox(bboxAround(place.position, NEARBY_RADIUS_M));
      return nearestUnheard(place.position, around, new Set([place.id, ...heardPlaceIds]));
    } catch {
      return null;
    }
  }

  /** "Opowiedz więcej" with nothing new left: no recap, Sawa says so and offers the place next door. */
  async function nothingNew(place: Place, heardPlaceIds: readonly string[]): Promise<Story> {
    const next = await nearby(place, heardPlaceIds);
    return {
      placeId: place.id,
      text: nothingNewText(next),
      sources: [],
      cached: false,
      factIds: [],
      contextIds: [],
      recap: true,
      suggestion: next ? { placeId: next.id, name: spokenName(next.name) } : null,
    };
  }

  function remember(key: string, draft: Promise<StoryDraft>) {
    cache.set(key, draft);
    if (cache.size > MAX_CACHED_STORIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  /** Everything a story needs before the model writes it. */
  async function prepare(request: StoryRequestInput) {
    const { placeId, targetSec, storyStyle, familiarity, audience, side } = request;
    const { interests = [], heardFacts = [], knownContexts = [], heardAgoSec, more } = request;
    const place = await places.getById(placeId);
    if (!place) throw new AppError("NOT_FOUND", `Place "${placeId}" not found`);
    const band = bandFor(targetSec);
    const context = contextFor(place, familiarity, knownContexts);
    const reservedWords = context ? Math.round(band.words * CONTEXT_WORD_SHARE) : 0;
    const findings = llm && research ? await research.find(place) : [];
    const sources = [...place.sources, ...findingSources(findings)];
    const pick = pickFacts(place, {
      heard: heardFacts,
      style: storyStyle,
      audience,
      band,
      reservedWords,
      findings,
    });
    // Asked for more, but everything here was told: not a recap, a pointer to the place next door.
    if (more && (pick.recap || pick.facts.length === 0)) {
      return { done: await nothingNew(place, request.heardPlaceIds ?? []) };
    }
    // Nothing left once the dry data is gone (dry-facts.ts): quiet instead of a dull story.
    if (pick.facts.length === 0) return { done: silentStory(place) };
    // Heard before: Sawa says when ("trzy miesiące temu opowiadałam ci…"), never "Pamiętasz…".
    // Not after "Opowiedz więcej", where the listener has just heard her.
    const heard =
      pick.recap || (!more && heardFacts.length > 0 && heardAgoSec !== undefined)
        ? heardIntro(place, heardAgoSec, pick.recap)
        : null;
    const words = fitWords(storyWords(band, storyStyle, pick.recap, audience), pick, reservedWords);
    // What the listener remembers once the story was heard (apps/web lib/memory.ts).
    const answer = (draft: StoryDraft, cached: boolean): Story =>
      // The model judged the material not worth telling (prompts/story.ts): quiet, nothing heard.
      draft.silent
        ? { ...silentStory(place), cached }
        : {
            placeId,
            text: draft.text,
            sources: draft.sources,
            cached,
            factIds: toldIds(pick, draft),
            contextIds: context ? [context.id] : [],
            recap: pick.recap,
            suggestion: null,
          };
    // Read plainly, war facts are too harsh for a child: the facts story keeps to the name.
    const plainPick = audience === "kids" && isGentleForKids(place) ? { ...pick, facts: [] } : pick;
    const plainDraft = factsStory(place, plainPick, sources, words, heard);
    // The facts story does not explain the background, so it stays unexplained.
    const plain = {
      ...answer(plainDraft, false),
      factIds: toldIds(plainPick, plainDraft),
      contextIds: [],
    };
    const key = storyCacheKey(placeId, interests, band, [
      storyStyle ?? "",
      familiarity ?? "",
      audience === "kids" ? "kids" : "",
      side ?? "",
      pick.facts.map((f) => f.id).join("."),
      context?.id ?? "",
      String(pick.recap),
      heard ?? "",
      ...knownContextsOf(place, knownContexts).map((c) => c.id),
    ]);
    const prompt = {
      system: audience === "kids" ? KIDS_STORY_SYSTEM_PROMPT : STORY_SYSTEM_PROMPT,
      user: storyUserPrompt(place, interests, {
        pick,
        sources,
        words,
        style: storyStyle,
        familiarity,
        audience,
        side,
        context,
        knownContexts: knownContextsOf(place, knownContexts),
        heardIntro: heard,
      }),
      maxTokens: band.words * TOKENS_PER_WORD,
    };
    return { done: null, placeId, sources, answer, plain, key, prompt };
  }

  async function tell(request: StoryRequestInput): Promise<Story> {
    const prepared = await prepare(request);
    if (prepared.done) return prepared.done;
    const { placeId, sources, answer, plain, key, prompt } = prepared;
    if (!llm) return plain;
    const hit = cache.get(key);
    if (hit) return answer(await hit, true);

    // The promise is cached, so two players asking at once pay for one story.
    const pending = llm.complete(prompt).then((raw) => {
      const draft = parseStoryAnswer(raw, sources);
      if (!draft) throw new AppError("UPSTREAM_ERROR", "LLM answer is not a story");
      return draft;
    });
    remember(key, pending);

    try {
      return answer(await pending, false);
    } catch (err) {
      // Not cached: the next ride asks the LLM again.
      cache.delete(key);
      onLlmError?.(err, placeId);
      return plain;
    }
  }

  return {
    tell,

    async tellStream(request) {
      if (!llm?.stream) return known(await tell(request));
      const prepared = await prepare(request);
      if (prepared.done) return known(prepared.done);
      const { placeId, sources, answer, plain, key, prompt } = prepared;
      const hit = cache.get(key);
      if (hit) return known(await hit.then((d) => answer(d, true)).catch(() => plain));

      const stream = llm.stream.bind(llm);
      let finish: (story: Story) => void = () => {};
      const story = new Promise<Story>((resolve) => {
        finish = resolve;
      });
      // Cached at once, so a second player asking now waits for this story instead of paying.
      let settle: { ok: (d: StoryDraft) => void; fail: (err: unknown) => void } | undefined;
      const pending = new Promise<StoryDraft>((ok, fail) => {
        settle = { ok, fail };
      });
      pending.catch(() => {});
      remember(key, pending);

      async function* text() {
        const reader = createStoryTextReader();
        let said = "";
        try {
          for await (const delta of stream(prompt)) {
            const piece = reader.push(delta);
            if (!piece) continue;
            said += piece;
            yield piece;
          }
          const draft = parseStoryAnswer(reader.raw, sources);
          if (!draft) throw new AppError("UPSTREAM_ERROR", "LLM answer is not a story");
          settle?.ok(draft);
          finish(answer(draft, false));
        } catch (err) {
          // Not cached: the next ride asks the LLM again.
          cache.delete(key);
          settle?.fail(err);
          onLlmError?.(err, placeId);
          if (said.trim()) {
            // Cut off mid-story: what Sawa already said is the story.
            finish(answer({ text: cleanForSpeech(said), sources, usedIds: [] }, false));
            return;
          }
          yield plain.text;
          finish(plain);
        }
      }
      return { text: text(), story };
    },

    warm(placeIds) {
      if (!llm || !research) return;
      for (const id of placeIds) {
        places
          .getById(id)
          .then((place) => place && research.find(place))
          .catch(() => {});
      }
    },
  };
}

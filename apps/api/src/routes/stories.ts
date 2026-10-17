import { StoryRequestSchema, StoryWarmRequestSchema } from "@sawa/shared";
import { Hono } from "hono";
import { AppError } from "../lib/errors";
import { type RateLimitOpts, rateLimit } from "../lib/rate-limit";
import { jsonBody } from "../lib/validate";
import type { LiveSession, LiveStoryService } from "../services/live-story";
import type { SpeechService } from "../services/speak";
import type { StoryService } from "../services/tell-story";

/**
 * Each miss costs LLM and ElevenLabs credits (T-92). A ride asks for about 30 (story + voice
 * per place); the venue Wi-Fi shares one IP, so the limit leaves room for ~100 phones at the demo.
 */
export const STORY_RATE_LIMIT: RateLimitOpts = { limit: 3000, windowMs: 10 * 60_000 };

const MP3_HEADERS = { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" };

/**
 * The voice as it is made. A finished one also answers byte ranges, since Safari asks for
 * `bytes=0-1` first and seeks with ranges when the story is replayed.
 */
function audioResponse(session: LiveSession, range: string | undefined): Response {
  const { audio } = session;
  if (audio.done && audio.error === undefined) {
    const whole = new Uint8Array(audio.items.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of audio.items) {
      whole.set(b, at);
      at += b.length;
    }
    const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && whole.length > 0) {
      const start = match[1] ? Number(match[1]) : Math.max(0, whole.length - Number(match[2]));
      const end =
        match[1] && match[2] ? Math.min(Number(match[2]), whole.length - 1) : whole.length - 1;
      if (start <= end) {
        return new Response(whole.slice(start, end + 1), {
          status: 206,
          headers: {
            ...MP3_HEADERS,
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${whole.length}`,
          },
        });
      }
    }
    return new Response(whole, { headers: { ...MP3_HEADERS, "Accept-Ranges": "bytes" } });
  }
  // Still being made: no length and no ranges, like an internet radio stream.
  const reader = audio.read();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch {
        // The voice failed midway: the listener keeps what was said.
        controller.close();
      }
    },
    cancel() {
      reader.return(undefined);
    },
  });
  return new Response(body, { headers: { ...MP3_HEADERS, "Accept-Ranges": "none" } });
}

export function createStoryRoutes(
  stories: StoryService,
  speech: SpeechService,
  live: LiveStoryService,
  limits: RateLimitOpts = STORY_RATE_LIMIT,
) {
  // One counter for both endpoints: the player calls them in pairs.
  const limiter = rateLimit(limits);
  const session = (id: string) => {
    const found = live.get(id);
    if (!found) throw new AppError("NOT_FOUND", `Live story "${id}" not found`);
    return found;
  };
  return (
    new Hono()
      .post("/v1/stories", limiter, jsonBody(StoryRequestSchema), async (c) =>
        c.json(await stories.tell(c.req.valid("json"))),
      )
      // Same story as /v1/stories (shared cache), read by Sawa's voice: one call for the player.
      .post("/v1/stories/audio", limiter, jsonBody(StoryRequestSchema), async (c) => {
        const story = await stories.tell(c.req.valid("json"));
        // Nothing worth telling here: no voice, and no credits spent on reading the name.
        if (story.silent) return c.body(null, 204);
        const { audio, contentType } = await speech.speak(story.text);
        return c.body(audio, 200, { "Content-Type": contentType, "Cache-Control": "no-store" });
      })
      // Streaming: the voice starts on the first sentence while the model still writes the rest.
      .post("/v1/stories/live", limiter, jsonBody(StoryRequestSchema), (c) =>
        c.json({ id: live.start(c.req.valid("json")) }),
      )
      .get("/v1/stories/live/:id", (c) => c.json(session(c.req.param("id")).state()))
      .get("/v1/stories/live/:id/audio", (c) =>
        audioResponse(session(c.req.param("id")), c.req.header("range")),
      )
      // A planned route: research its places now, so their stories do not wait for the web.
      .post("/v1/stories/warm", limiter, jsonBody(StoryWarmRequestSchema), (c) => {
        stories.warm(c.req.valid("json").placeIds);
        return c.json({ ok: true }, 202);
      })
  );
}

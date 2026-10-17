import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors";
import { createElevenLabsSynthesizer, SAWA_MODEL_ID, SAWA_VOICE_ID } from "./speech-synthesizer";

const synth = createElevenLabsSynthesizer({ apiKey: "test-key" });

afterEach(() => vi.unstubAllGlobals());

describe("createElevenLabsSynthesizer", () => {
  it("posts the text with Sawa's voice and model and returns the audio", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await synth.synthesize("Cześć");

    expect(result).toEqual({ audio: new Uint8Array([1, 2, 3]), contentType: "audio/mpeg" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/v1/text-to-speech/${SAWA_VOICE_ID}`);
    expect(new Headers(init.headers).get("xi-api-key")).toBe("test-key");
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: "Cześć",
      model_id: SAWA_MODEL_ID,
    });
  });

  it("turns an error answer into UPSTREAM_ERROR with the status", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response('{"detail":"quota_exceeded"}', { status: 401 }),
    );
    const err = await synth.synthesize("Cześć").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: "UPSTREAM_ERROR", message: expect.stringContaining("401") });
  });

  it("turns a timeout into UPSTREAM_TIMEOUT", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(synth.synthesize("Cześć")).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT" });
  });

  it("streams mp3 from the /stream endpoint with what was said before", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array([1, 2]));
              c.enqueue(new Uint8Array([3]));
              c.close();
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const parts: number[][] = [];
    for await (const b of synth.stream?.("Dalej.", { previousText: "Najpierw." }) ?? []) {
      parts.push([...b]);
    }
    expect(parts.flat()).toEqual([1, 2, 3]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/stream?");
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: "Dalej.",
      previous_text: "Najpierw.",
    });
  });

  describe("streamWithTimes", () => {
    // One MPEG1 layer III frame, 128 kbps, 44.1 kHz: 1152 samples.
    const FRAME_SEC = 1152 / 44100;
    const frame = () => {
      const f = new Uint8Array(417);
      f.set([0xff, 0xfb, 0x90, 0x64]);
      return f;
    };
    const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
    const align = (text: string, from: number, step = 0.1) => ({
      characters: [...text],
      character_start_times_seconds: [...text].map((_, i) => from + i * step),
      character_end_times_seconds: [...text].map((_, i) => from + (i + 1) * step),
    });
    /** A body cut at odd places, the way the network delivers it. */
    function body(lines: unknown[]) {
      const text = `${lines.map((l) => JSON.stringify(l)).join("\n")}\n\n`;
      const bytes = new TextEncoder().encode(text);
      return new Response(
        new ReadableStream({
          start(c) {
            for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
            c.close();
          },
        }),
      );
    }
    async function read(lines: unknown[]) {
      const fetchMock = vi.fn(async () => body(lines));
      vi.stubGlobal("fetch", fetchMock);
      const pieces = [];
      for await (const p of synth.streamWithTimes?.("Tu stoi", { previousText: "" }) ?? []) {
        pieces.push(p);
      }
      return { pieces, fetchMock };
    }

    it("reads JSON lines into mp3 bytes and character times", async () => {
      const { pieces, fetchMock } = await read([
        { audio_base64: b64(frame()), alignment: align("Tu ", 0), normalized_alignment: null },
        { audio_base64: b64(frame()), alignment: null },
        { audio_base64: b64(frame()), alignment: align("stoi", 0.3) },
      ]);
      expect(pieces.map((p) => p.audio.length)).toEqual([417, 417, 417]);
      expect(pieces[0]?.times?.chars).toEqual(["T", "u", " "]);
      expect(pieces[1]?.times).toBeNull();
      expect(pieces[2]?.times?.starts[0]).toBeCloseTo(0.3);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain("/stream/with-timestamps?");
      expect(JSON.parse(init.body as string)).toMatchObject({ text: "Tu stoi" });
    });

    it("moves times that start again from zero by the audio before them", async () => {
      const { pieces } = await read([
        {
          audio_base64: b64(new Uint8Array([...frame(), ...frame()])),
          alignment: align("Tu ", 0, 0.3),
        },
        { audio_base64: b64(frame()), alignment: align("stoi", 0, 0.01) },
      ]);
      expect(pieces[1]?.times?.starts[0]).toBeCloseTo(2 * FRAME_SEC);
    });

    it("falls back to the normalized alignment", async () => {
      const { pieces } = await read([
        { audio_base64: b64(frame()), alignment: null, normalized_alignment: align("tu", 0) },
      ]);
      expect(pieces[0]?.times?.chars).toEqual(["t", "u"]);
    });

    it("turns a line that is not a chunk into UPSTREAM_ERROR", async () => {
      vi.stubGlobal("fetch", async () => new Response("<html>nope</html>\n"));
      const run = async () => {
        for await (const _ of synth.streamWithTimes?.("Tu", { previousText: "" }) ?? []) {
        }
      };
      await expect(run()).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    });
  });
});

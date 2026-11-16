import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiKeys, ChatMessage } from "@/lib/workspace/types";
import { isComplex } from "./complexity";
import { runMode } from "./orchestrator";
import { ENDPOINTS, OPENROUTER_WATERFALL, callOpenRouterWaterfall } from "./providers";

const allKeys: ApiKeys = { gemini: "g", groq: "q", openrouter: "o", anthropic: "", openai: "" };

function ok(content: string, model?: string) {
  return new Response(JSON.stringify({ model, choices: [{ message: { content } }] }), {
    status: 200,
  });
}

type Call = {
  url: string;
  body: { model?: string; models?: string[] };
  headers: Record<string, string>;
};

function mockFetch(handler: (c: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const c = {
        url,
        body: JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>,
      };
      calls.push(c);
      return handler(c);
    }),
  );
  return calls;
}

const history = (text: string): ChatMessage[] => [
  { id: "1", role: "user", content: text, createdAt: 0 },
];

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouter coding waterfall", () => {
  it("sends the exact 3 fallback model IDs in priority order with referer and title headers", async () => {
    const calls = mockFetch(() => ok("hi", "particle-ai/particle-1:free"));
    await callOpenRouterWaterfall(allKeys, [{ role: "user", content: "x" }]);
    expect(calls[0]!.url).toBe(ENDPOINTS.openrouter);
    expect(calls[0]!.body.models).toEqual([
      "particle-ai/particle-1:free",
      "dots-studio/dots-3-note-preview:free",
      "openrouter/free",
    ]);
    expect(OPENROUTER_WATERFALL).toHaveLength(3);
    expect(calls[0]!.headers["HTTP-Referer"]).toBeTruthy();
    expect(calls[0]!.headers["X-Title"]).toBe("Tributary");
  });

  it("reports which fallback model took over", async () => {
    mockFetch(() => ok("hi", "dots-studio/dots-3-note-preview:free"));
    const r = await callOpenRouterWaterfall(allKeys, [{ role: "user", content: "x" }]);
    expect(r.tags[0]!.model).toBe("dots-studio/dots-3-note-preview:free");
    expect(r.tags[0]!.note).toMatch(/fallback #2/);
  });

  it("silently falls back to Groq qwen/qwen3.8-27b when OpenRouter fails", async () => {
    const calls = mockFetch((c) =>
      c.url === ENDPOINTS.openrouter
        ? new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })
        : ok("from groq"),
    );
    const r = await callOpenRouterWaterfall(allKeys, [{ role: "user", content: "x" }]);
    expect(r.content).toBe("from groq");
    expect(calls[1]!.url).toBe(ENDPOINTS.groq);
    expect(calls[1]!.body.model).toBe("qwen/qwen3.8-27b");
  });
});

describe("modes", () => {
  it("Fast mode uses gemini-3.5-flash-lite only", async () => {
    const calls = mockFetch(() => ok("fast"));
    const r = await runMode({
      mode: "fast",
      history: history("Write a full python web scraper"),
      keys: allKeys,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.model).toBe("gemini-3.5-flash-lite");
    expect(r.models.map((m) => m.model)).toEqual(["gemini-3.5-flash-lite"]);
  });

  it("Auto Mix sends simple questions to gemini-3.5-flash-lite only", async () => {
    const calls = mockFetch(() => ok("Paris"));
    await runMode({ mode: "auto", history: history("Capital of France?"), keys: allKeys });
    expect(calls.map((c) => c.body.model)).toEqual(["gemini-3.5-flash-lite"]);
  });

  it("Auto Mix sends coding tasks to gemini-3.8-flash and gpt-oss-120b, then merges", async () => {
    const calls = mockFetch(() => ok("draft"));
    const r = await runMode({
      mode: "auto",
      history: history("Fix this bug in my React hook"),
      keys: allKeys,
    });
    const drafts = calls
      .slice(0, 2)
      .map((c) => c.body.model)
      .sort();
    expect(drafts).toEqual(["gemini-3.8-flash", "openai/gpt-oss-120b"]);
    expect(calls).toHaveLength(3);
    expect(r.models.find((m) => m.role === "synth")).toBeTruthy();
  });

  it("Heavyweight Consensus consults Gemini, Groq and OpenRouter, then synthesizes", async () => {
    const calls = mockFetch((c) =>
      c.url === ENDPOINTS.openrouter ? ok("or", "particle-ai/particle-1:free") : ok("draft"),
    );
    await runMode({ mode: "consensus", history: history("hi"), keys: allKeys });
    const firstThree = calls
      .slice(0, 3)
      .map((c) => c.url)
      .sort();
    expect(firstThree).toEqual([ENDPOINTS.gemini, ENDPOINTS.groq, ENDPOINTS.openrouter].sort());
    expect(calls).toHaveLength(4);
  });
});

describe("complexity router", () => {
  it("treats short questions as simple and code/research asks as complex", () => {
    expect(isComplex("What time zone is Tokyo in?")).toBe(false);
    expect(isComplex("Implement a binary search in Rust")).toBe(true);
    expect(isComplex("Compare Postgres and MySQL for analytics")).toBe(true);
  });
});

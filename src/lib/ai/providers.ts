import type { ApiKeys, ModelTag } from "@/lib/workspace/types";

export const MODELS = {
  geminiFast: "gemini-3.5-flash-lite",
  geminiDeep: "gemini-3.8-flash",
  groqHeavy: "openai/gpt-oss-120b",
  groqQwen: "qwen/qwen3.8-27b",
} as const;

/** OpenRouter coding waterfall, in priority order. OpenRouter switches on 429s. */
export const OPENROUTER_WATERFALL = [
  "particle-ai/particle-1:free",
  "dots-studio/dots-3-note-preview:free",
  "openrouter/free",
] as const;

export const ENDPOINTS = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
} as const;

export const APP_TITLE = "Tributary";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BrainResult {
  content: string;
  tags: ModelTag[];
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function postChat(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ content: string; model: string | undefined }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: signal ?? null,
  });
  const text = await res.text();
  interface ChatJson {
    model?: unknown;
    error?: { message?: string };
    choices?: Array<{ message?: { content?: unknown } }>;
  }
  let parsed: ChatJson | ChatJson[] | null = null;
  try {
    parsed = JSON.parse(text) as ChatJson | ChatJson[];
  } catch {
    parsed = null;
  }
  const json: ChatJson | null = Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
  const errObj = json?.error;
  if (!res.ok || errObj) {
    const msg = errObj?.message || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new ProviderError(msg, res.status);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !stripThinking(content)) {
    throw new ProviderError("The model returned an empty answer.");
  }
  return {
    content: stripThinking(content),
    model: typeof json?.model === "string" ? json.model : undefined,
  };
}

export async function callGemini(
  key: string,
  model: string,
  messages: ChatTurn[],
  signal?: AbortSignal,
): Promise<BrainResult> {
  const r = await postChat(
    ENDPOINTS.gemini,
    { Authorization: `Bearer ${key}` },
    { model, messages },
    signal,
  );
  return { content: r.content, tags: [{ provider: "gemini", model, role: "answer" }] };
}

export async function callGroq(
  key: string,
  model: string,
  messages: ChatTurn[],
  signal?: AbortSignal,
): Promise<BrainResult> {
  const r = await postChat(
    ENDPOINTS.groq,
    { Authorization: `Bearer ${key}` },
    { model, messages },
    signal,
  );
  return { content: r.content, tags: [{ provider: "groq", model, role: "answer" }] };
}

/** Builds the exact OpenRouter request body: the models array drives auto-switching. */
export function openRouterBody(messages: ChatTurn[]) {
  return { models: [...OPENROUTER_WATERFALL], messages };
}

export function openRouterHeaders(key: string): Record<string, string> {
  const referer = typeof window !== "undefined" ? window.location.origin : "https://tributary.app";
  return { Authorization: `Bearer ${key}`, "HTTP-Referer": referer, "X-Title": APP_TITLE };
}

/**
 * OpenRouter coding waterfall. If the whole OpenRouter request fails (e.g. daily
 * free quota used up), silently falls back to Groq's qwen model.
 */
export async function callOpenRouterWaterfall(
  keys: ApiKeys,
  messages: ChatTurn[],
  signal?: AbortSignal,
): Promise<BrainResult> {
  let reason = "no OpenRouter key";
  if (keys.openrouter) {
    try {
      const r = await postChat(
        ENDPOINTS.openrouter,
        openRouterHeaders(keys.openrouter),
        openRouterBody(messages),
        signal,
      );
      const used = r.model ?? OPENROUTER_WATERFALL[0];
      const idx = OPENROUTER_WATERFALL.findIndex(
        (m) => used === m || used.startsWith(m.replace(":free", "")),
      );
      const note =
        idx > 0
          ? `fallback #${idx + 1}, switched from ${OPENROUTER_WATERFALL[0]}`
          : idx === -1 && used !== OPENROUTER_WATERFALL[0]
            ? "routed by openrouter/free"
            : undefined;
      return {
        content: r.content,
        tags: [{ provider: "openrouter", model: used, role: "answer", note }],
      };
    } catch (err) {
      if (isAbort(err)) throw err;
      reason = err instanceof ProviderError && err.status ? `HTTP ${err.status}` : "request failed";
    }
  }
  if (!keys.groq)
    throw new ProviderError(`OpenRouter unavailable (${reason}) and no Groq key for fallback.`);
  const g = await callGroq(keys.groq, MODELS.groqQwen, messages, signal);
  return {
    content: g.content,
    tags: [
      {
        provider: "openrouter",
        model: "coding waterfall",
        role: "answer",
        failed: true,
        note: reason,
      },
      {
        provider: "groq",
        model: MODELS.groqQwen,
        role: "answer",
        note: "took over from OpenRouter",
      },
    ],
  };
}

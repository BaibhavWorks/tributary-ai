import { BUILDER_SYSTEM_PROMPT } from "@/lib/builder/prompt";
import type { ApiKeys, ChatMessage, Mode, ModelTag, WorkspaceMode } from "@/lib/workspace/types";
import { isComplex } from "./complexity";
import {
  MODELS,
  ProviderError,
  callGemini,
  callGroq,
  callOpenRouterWaterfall,
  isAbort,
  type BrainResult,
  type ChatTurn,
} from "./providers";

export const SYSTEM_PROMPT =
  "You are a sharp, rigorous research and coding assistant inside a personal workspace. Be direct and precise. Use Markdown, fenced code blocks with language tags for code, and short sections when helpful. Admit uncertainty instead of guessing.";

const HISTORY_LIMIT = 24;

export interface RunResult {
  content: string;
  models: ModelTag[];
  route: string;
}

export interface RunOptions {
  mode: Mode;
  workspaceMode?: WorkspaceMode;
  history: ChatMessage[];
  keys: ApiKeys;
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
}

export class NoKeysError extends Error {
  constructor() {
    super("Add at least one API key in Settings to start chatting.");
    this.name = "NoKeysError";
  }
}

function getSystemPrompt(workspaceMode?: WorkspaceMode): string {
  return workspaceMode === "builder" ? BUILDER_SYSTEM_PROMPT : SYSTEM_PROMPT;
}

function toTurns(history: ChatMessage[], workspaceMode?: WorkspaceMode): ChatTurn[] {
  return [
    { role: "system", content: getSystemPrompt(workspaceMode) },
    ...history
      .filter((m) => !m.error)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }) as ChatTurn),
  ];
}

type Settled = { ok: true; value: BrainResult } | { ok: false; error: unknown; label: ModelTag };

async function settle(p: Promise<BrainResult>, label: ModelTag): Promise<Settled> {
  try {
    return { ok: true, value: await p };
  } catch (error) {
    if (isAbort(error)) throw error;
    return { ok: false, error, label };
  }
}

function asDrafts(tags: ModelTag[]): ModelTag[] {
  return tags.map((t) => ({ ...t, role: t.role === "answer" ? "draft" : t.role }));
}

/** Fast single-model path: flash-lite in general mode, or deeper model when building websites. */
async function fastAnswer(
  keys: ApiKeys,
  turns: ChatTurn[],
  signal?: AbortSignal,
  workspaceMode?: WorkspaceMode,
): Promise<BrainResult> {
  if (workspaceMode === "builder") {
    if (keys.gemini) return callGemini(keys.gemini, MODELS.geminiDeep, turns, signal);
    if (keys.groq) return callGroq(keys.groq, MODELS.groqHeavy, turns, signal);
    if (keys.openrouter) return callOpenRouterWaterfall(keys, turns, signal);
  } else {
    if (keys.gemini) return callGemini(keys.gemini, MODELS.geminiFast, turns, signal);
    if (keys.groq) return callGroq(keys.groq, MODELS.groqHeavy, turns, signal);
    if (keys.openrouter) return callOpenRouterWaterfall(keys, turns, signal);
  }
  throw new NoKeysError();
}

function synthesisTurns(
  history: ChatMessage[],
  drafts: BrainResult[],
  crossCheck: boolean,
  workspaceMode?: WorkspaceMode,
): ChatTurn[] {
  const prior = toTurns(history.slice(0, -1), workspaceMode);
  const question = history[history.length - 1]?.content ?? "";
  const basePrompt = getSystemPrompt(workspaceMode);
  const editorRules = crossCheck
    ? "You are the final reviewer in a three-model consensus system. Cross-check the independent drafts below line by line: verify facts, test the logic of any code mentally, fix bugs, and resolve contradictions by reasoning about which claim is correct. Then write ONE unified, corrected, complete final answer."
    : "You are the final editor in a multi-model system. Merge the best insights of the independent drafts below into ONE clear, accurate, complete answer. Drop redundancy and anything that looks wrong.";
  const body = drafts.map((d, i) => `### Draft ${i + 1}\n${d.content}`).join("\n\n");
  return [
    {
      role: "system",
      content: `${basePrompt}\n\n${editorRules}\nNever mention drafts, models, or this merging process in your answer.`,
    },
    ...prior.slice(1),
    {
      role: "user",
      content: `User request:\n${question}\n\n---\n${body}\n\n---\nWrite the final answer to the user request.`,
    },
  ];
}

async function synthesize(
  keys: ApiKeys,
  history: ChatMessage[],
  drafts: BrainResult[],
  crossCheck: boolean,
  signal?: AbortSignal,
  workspaceMode?: WorkspaceMode,
): Promise<BrainResult> {
  const turns = synthesisTurns(history, drafts, crossCheck, workspaceMode);
  const attempts: Array<() => Promise<BrainResult>> = [];
  if (keys.gemini) attempts.push(() => callGemini(keys.gemini, MODELS.geminiDeep, turns, signal));
  if (keys.groq) attempts.push(() => callGroq(keys.groq, MODELS.groqHeavy, turns, signal));
  for (const attempt of attempts) {
    try {
      const r = await attempt();
      return { content: r.content, tags: r.tags.map((t) => ({ ...t, role: "synth" })) };
    } catch (err) {
      if (isAbort(err)) throw err;
    }
  }
  // No synthesizer available: return the most thorough draft.
  const best = [...drafts].sort((a, b) => b.content.length - a.content.length)[0];
  return { content: best?.content ?? "", tags: [] };
}

async function mixture(
  brains: Array<{ run: () => Promise<BrainResult>; label: ModelTag }>,
  opts: RunOptions,
  crossCheck: boolean,
): Promise<{ content: string; models: ModelTag[] }> {
  const { keys, history, signal, onStage, workspaceMode } = opts;
  const settled = await Promise.all(brains.map((b) => settle(b.run(), b.label)));
  const ok = settled.filter((s): s is Extract<Settled, { ok: true }> => s.ok).map((s) => s.value);
  const failedTags: ModelTag[] = settled
    .filter((s): s is Extract<Settled, { ok: false }> => !s.ok)
    .map((s) => ({ ...s.label, role: "draft", failed: true }));

  if (ok.length === 0) {
    const first = settled.find((s) => !s.ok) as Extract<Settled, { ok: false }> | undefined;
    throw first?.error instanceof Error
      ? first.error
      : new ProviderError("All models failed to respond.");
  }
  if (ok.length === 1) {
    const only = ok[0]!;
    return { content: only.content, models: [...only.tags, ...failedTags] };
  }
  onStage?.(crossCheck ? `Cross-checking ${ok.length} answers…` : "Merging insights…");
  const final = await synthesize(keys, history, ok, crossCheck, signal, workspaceMode);
  return {
    content: final.content,
    models: [...ok.flatMap((r) => asDrafts(r.tags)), ...failedTags, ...final.tags],
  };
}

export async function runMode(opts: RunOptions): Promise<RunResult> {
  const { mode, workspaceMode, history, keys, signal, onStage } = opts;
  if (!keys.gemini && !keys.groq && !keys.openrouter) throw new NoKeysError();
  const turns = toTurns(history, workspaceMode);
  const prompt = history[history.length - 1]?.content ?? "";

  if (mode === "fast" || (mode === "auto" && !isComplex(prompt))) {
    onStage?.(workspaceMode === "builder" ? "Architecting…" : "Thinking…");
    const r = await fastAnswer(keys, turns, signal, workspaceMode);
    return {
      content: r.content,
      models: r.tags,
      route: workspaceMode === "builder" ? "Builder · deep" : mode === "fast" ? "Fast" : "Auto · quick",
    };
  }

  if (mode === "auto") {
    const brains: Array<{ run: () => Promise<BrainResult>; label: ModelTag }> = [];
    if (keys.gemini)
      brains.push({
        run: () => callGemini(keys.gemini, MODELS.geminiDeep, turns, signal),
        label: { provider: "gemini", model: MODELS.geminiDeep, role: "draft" },
      });
    if (keys.groq)
      brains.push({
        run: () => callGroq(keys.groq, MODELS.groqHeavy, turns, signal),
        label: { provider: "groq", model: MODELS.groqHeavy, role: "draft" },
      });
    if (brains.length === 0) {
      onStage?.("Thinking…");
      const r = await fastAnswer(keys, turns, signal, workspaceMode);
      return { content: r.content, models: r.tags, route: "Auto · quick" };
    }
    onStage?.(brains.length === 2 ? "Consulting Gemini + Groq…" : "Thinking deeply…");
    const r = await mixture(brains, opts, false);
    return { ...r, route: workspaceMode === "builder" ? "Builder · mix" : "Auto · mix" };
  }

  // Heavyweight consensus: Gemini + Groq + OpenRouter coding waterfall.
  const brains: Array<{ run: () => Promise<BrainResult>; label: ModelTag }> = [];
  if (keys.gemini)
    brains.push({
      run: () => callGemini(keys.gemini, MODELS.geminiDeep, turns, signal),
      label: { provider: "gemini", model: MODELS.geminiDeep, role: "draft" },
    });
  if (keys.groq)
    brains.push({
      run: () => callGroq(keys.groq, MODELS.groqHeavy, turns, signal),
      label: { provider: "groq", model: MODELS.groqHeavy, role: "draft" },
    });
  if (keys.openrouter || keys.groq)
    brains.push({
      run: () => callOpenRouterWaterfall(keys, turns, signal),
      label: { provider: "openrouter", model: "coding waterfall", role: "draft" },
    });
  onStage?.(`Consulting ${brains.length} brain${brains.length === 1 ? "" : "s"}…`);
  const r = await mixture(brains, opts, true);
  return { ...r, route: "Consensus" };
}

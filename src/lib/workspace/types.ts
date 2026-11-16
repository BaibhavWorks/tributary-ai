export type Mode = "auto" | "consensus" | "fast";

export type Provider = "gemini" | "groq" | "openrouter";

/** One model that contributed to an AI reply, shown as a badge. */
export interface ModelTag {
  provider: Provider;
  model: string;
  role: "answer" | "draft" | "synth";
  /** Short human note, e.g. "switched from particle-ai/particle-1:free". */
  note?: string | undefined;
  /** This model was attempted but did not produce an answer. */
  failed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  mode?: Mode;
  route?: string;
  models?: ModelTag[];
  error?: boolean;
}

export interface Thread {
  id: string;
  projectId: string;
  parentId: string | null;
  kind: "main" | "branch";
  title: string;
  branchedFromMessageId?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  mainThreadId: string;
  createdAt: number;
}

export interface Workspace {
  version: 1;
  projects: Project[];
  threads: Record<string, Thread>;
  prefs: {
    mode: Mode;
    collapsed: Record<string, boolean>;
    lastThreadId?: string;
  };
}

export interface ApiKeys {
  gemini: string;
  groq: string;
  openrouter: string;
  anthropic: string;
  openai: string;
}

export const EMPTY_KEYS: ApiKeys = {
  gemini: "",
  groq: "",
  openrouter: "",
  anthropic: "",
  openai: "",
};

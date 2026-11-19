import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, Copy, GitBranch, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import mark from "@/assets/tributary-mark.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { NoKeysError, runMode } from "@/lib/ai/orchestrator";
import { isAbort } from "@/lib/ai/providers";
import {
  appendMessage,
  createBranch,
  getKeys,
  getWorkspace,
  setMode,
  setPending,
  setWorkspaceMode,
  uid,
  useApiKeys,
  usePending,
  useWorkspace,
} from "@/lib/workspace/store";
import type { ChatMessage, Thread, WorkspaceMode } from "@/lib/workspace/types";
import { ModeSelector } from "./ModeSelector";
import { ModelBadges } from "./ModelBadges";
import { SettingsDialog } from "./SettingsDialog";

// Lives outside React so Stop still works after navigating away and back.
const controllers = new Map<string, AbortController>();

const GENERAL_SUGGESTIONS = [
  "Explain the CAP theorem with a concrete example",
  "Write a TypeScript debounce with cancel and flush",
  "Compare RAG vs fine-tuning for a support bot",
  "What's a good name for a CLI that diffs JSON?",
];

const BUILDER_SUGGESTIONS = [
  "Build a modern portfolio website for a software developer",
  "Create a landing page for a cozy specialty coffee shop",
  "Design a clean SaaS product waitlist landing page",
  "Build a personal fitness & MMA coaching website",
];

async function sendMessage(threadId: string, text: string) {
  const ws = getWorkspace();
  const mode = ws.prefs.mode;
  const workspaceMode = ws.prefs.workspaceMode ?? "general";
  appendMessage(threadId, { id: uid("m_"), role: "user", content: text, createdAt: Date.now() });
  const history = getWorkspace().threads[threadId]?.messages ?? [];
  const controller = new AbortController();
  controllers.set(threadId, controller);
  setPending(threadId, "Thinking…");
  try {
    const r = await runMode({
      mode,
      workspaceMode,
      history,
      keys: getKeys(),
      signal: controller.signal,
      onStage: (s) => setPending(threadId, s),
    });
    appendMessage(threadId, {
      id: uid("m_"),
      role: "assistant",
      content: r.content,
      createdAt: Date.now(),
      mode,
      route: r.route,
      models: r.models,
    });
  } catch (err) {
    if (isAbort(err)) {
      toast("Stopped");
      return;
    }
    const msg =
      err instanceof NoKeysError
        ? err.message
        : `Couldn't get an answer: ${err instanceof Error ? err.message : String(err)}`;
    appendMessage(threadId, {
      id: uid("m_"),
      role: "assistant",
      content: msg,
      createdAt: Date.now(),
      error: true,
      mode,
    });
  } finally {
    controllers.delete(threadId);
    setPending(threadId, null);
  }
}

export function ChatView({ thread }: { thread: Thread }) {
  const ws = useWorkspace();
  const keys = useApiKeys();
  const pending = usePending();
  const navigate = useNavigate();
  const stage = pending[thread.id];
  const busy = !!stage;
  const mode = ws?.prefs.mode ?? "auto";
  const workspaceMode = ws?.prefs.workspaceMode ?? "general";
  const hasKeys = !!(keys && (keys.gemini || keys.groq || keys.openrouter));
  const [text, setText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const parent = thread.parentId ? ws?.threads[thread.parentId] : undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, [thread.id, busy]);

  const branch = (messageId: string) => {
    const id = createBranch(thread.id, messageId);
    if (id) {
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
      toast.success("New branch created", {
        description: "History up to that reply was carried over.",
      });
    }
  };

  const fill = (s: string) => {
    if (!inputRef.current) return;
    inputRef.current.value = s;
    setText(s);
    inputRef.current.focus();
  };

  return (
    <div className="ambient flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-8">
          {thread.messages.length === 0 && !busy ? (
            <EmptyState
              hasKeys={hasKeys}
              isBranch={thread.kind === "branch"}
              workspaceMode={workspaceMode}
              onOpenSettings={() => setSettingsOpen(true)}
              onPick={fill}
            />
          ) : (
            thread.messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-6">
                <ChatBubble message={m} onBranch={branch} />
                {thread.kind === "branch" && m.id === thread.branchedFromMessageId && (
                  <div className="flex items-center gap-3" role="separator">
                    <div className="h-px flex-1 bg-border" />
                    <span className="eyebrow flex items-center gap-1.5 text-primary/80">
                      <GitBranch className="size-3" /> branched from {parent?.title ?? "parent"}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
              </div>
            ))
          )}
          {busy && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="font-mono text-xs">{stage}</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <ModeSelector
            value={mode}
            onChange={setMode}
            workspaceMode={workspaceMode}
            onChangeWorkspaceMode={setWorkspaceMode}
          />
          {!hasKeys && keys && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <KeyRound className="size-3.5" /> Add API keys to start
            </button>
          )}
        </div>
        <PromptInput
          className="rounded-xl bg-card shadow-lg"
          onSubmit={(msg) => {
            const value = msg.text.trim();
            if (!value || busy) return;
            setText("");
            void sendMessage(thread.id, value);
          }}
        >
          <PromptInputTextarea
            ref={inputRef}
            placeholder={
              workspaceMode === "builder"
                ? "Describe your website idea or answer the architect's questions…"
                : thread.kind === "branch"
                  ? "Continue this sub-topic…"
                  : "Ask anything — research, code, ideas…"
            }
            onChange={(e) => setText(e.currentTarget.value)}
          />
          <PromptInputFooter>
            <PromptInputTools>
              <span className="px-1 font-mono text-[10.5px] text-muted-foreground">
                Enter to send · Shift+Enter for new line
              </span>
            </PromptInputTools>
            <PromptInputSubmit
              status={busy ? "streaming" : "ready"}
              onStop={() => controllers.get(thread.id)?.abort()}
              disabled={!busy && !text.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function ChatBubble({
  message,
  onBranch,
}: {
  message: ChatMessage;
  onBranch: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  if (message.role === "user") {
    return (
      <Message from="user">
        <MessageContent className="group-[.is-user]:bg-chat-user group-[.is-user]:text-chat-user-foreground whitespace-pre-wrap">
          {message.content}
        </MessageContent>
      </Message>
    );
  }
  if (message.error) {
    return (
      <Message from="assistant">
        <MessageContent className="flex-row items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{message.content}</span>
        </MessageContent>
      </Message>
    );
  }
  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent className="w-full">
        <MessageResponse>{message.content}</MessageResponse>
      </MessageContent>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModelBadges models={message.models} route={message.route} />
        <MessageActions className="opacity-70 transition-opacity group-hover:opacity-100">
          <MessageAction
            tooltip="Copy"
            onClick={() => {
              void navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />}
          </MessageAction>
          <MessageAction
            size="xs"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
            label="Branch here"
            onClick={() => onBranch(message.id)}
          >
            <GitBranch /> Branch here
          </MessageAction>
        </MessageActions>
      </div>
    </Message>
  );
}

function EmptyState({
  hasKeys,
  isBranch,
  workspaceMode,
  onOpenSettings,
  onPick,
}: {
  hasKeys: boolean;
  isBranch: boolean;
  workspaceMode: WorkspaceMode;
  onOpenSettings: () => void;
  onPick: (s: string) => void;
}) {
  const isBuilder = workspaceMode === "builder";
  const suggestions = isBuilder ? BUILDER_SUGGESTIONS : GENERAL_SUGGESTIONS;

  return (
    <div className="flex flex-col items-center gap-6 pt-[12vh] text-center">
      <img src={mark} alt="" width={56} height={56} className="size-14" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isBuilder
            ? "Guided Website Builder"
            : isBranch
              ? "A fresh sub-topic"
              : "Three brains, one answer"}
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {isBuilder
            ? "Answer 5 quick questions about your project and theme, and Tributary will architect a complete responsive website."
            : (
              <>
                Mix Gemini, Groq and OpenRouter. Fork any reply with{" "}
                <span className="text-primary">Branch here</span> to explore a tangent without losing
                the thread.
              </>
            )}
        </p>
      </div>
      {hasKeys ? (
        <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-left">
          <p className="eyebrow mb-2">Step 1</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Add at least one free API key — Gemini, Groq or OpenRouter. They're stored only in this
            browser.
          </p>
          <Button onClick={onOpenSettings} className="w-full gap-2">
            <KeyRound /> Add API keys
          </Button>
        </div>
      )}
    </div>
  );
}

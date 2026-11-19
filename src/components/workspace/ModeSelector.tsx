import { Globe, Layers, MessageSquare, Scale, Zap } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Mode, WorkspaceMode } from "@/lib/workspace/types";

const MODES: { id: Mode; label: string; icon: typeof Zap; hint: string }[] = [
  {
    id: "auto",
    label: "Auto Mix",
    icon: Layers,
    hint: "Simple questions → gemini-3.5-flash-lite. Code or research → Gemini + Groq in parallel, merged into one answer.",
  },
  {
    id: "consensus",
    label: "Heavyweight",
    icon: Scale,
    hint: "Gemini + Groq + OpenRouter coding waterfall, cross-checked and synthesized into one answer.",
  },
  { id: "fast", label: "Fast", icon: Zap, hint: "gemini-3.5-flash-lite only. Instant." },
];

interface ModeSelectorProps {
  value: Mode;
  onChange: (m: Mode) => void;
  workspaceMode?: WorkspaceMode;
  onChangeWorkspaceMode?: (wm: WorkspaceMode) => void;
}

export function ModeSelector({
  value,
  onChange,
  workspaceMode = "general",
  onChangeWorkspaceMode,
}: ModeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 1. General vs. Website Builder Toggle */}
      {onChangeWorkspaceMode && (
        <div
          role="radiogroup"
          aria-label="Workspace mode"
          className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={workspaceMode === "general"}
                onClick={() => onChangeWorkspaceMode("general")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  workspaceMode === "general"
                    ? "bg-primary text-primary-foreground glow-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <MessageSquare className="size-3.5" />
                General
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64 text-xs">
              Standard multi-AI research, coding, and branching chat.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={workspaceMode === "builder"}
                onClick={() => onChangeWorkspaceMode("builder")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  workspaceMode === "builder"
                    ? "bg-primary text-primary-foreground glow-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Globe className="size-3.5" />
                Builder
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64 text-xs">
              Guided 5-question website architect that builds a complete live preview.
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 2. Existing AI Brain Speed/Mix Selector */}
      <div
        role="radiogroup"
        aria-label="Answer mode"
        className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
      >
        {MODES.map((m) => {
          const active = value === m.id;
          return (
            <Tooltip key={m.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(m.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground glow-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <m.icon className="size-3.5" />
                  {m.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64 text-xs">
                {m.hint}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

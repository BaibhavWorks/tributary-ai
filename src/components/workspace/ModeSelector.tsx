import { Layers, Scale, Zap } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Mode } from "@/lib/workspace/types";

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

export function ModeSelector({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
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
  );
}

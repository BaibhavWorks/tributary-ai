import { cva } from "class-variance-authority";
import { ArrowRight, Combine, X } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ModelTag } from "@/lib/workspace/types";

const badge = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] leading-none",
  {
    variants: {
      provider: {
        gemini: "border-brain-gemini/25 bg-brain-gemini/10 text-brain-gemini",
        groq: "border-brain-groq/25 bg-brain-groq/10 text-brain-groq",
        openrouter: "border-brain-openrouter/25 bg-brain-openrouter/10 text-brain-openrouter",
      },
      failed: { true: "border-dashed opacity-60 line-through decoration-1", false: "" },
      synth: { true: "border-brain-synth/30 bg-brain-synth/10 text-brain-synth", false: "" },
    },
    defaultVariants: { failed: false, synth: false },
  },
);

const LABEL = { gemini: "Gemini", groq: "Groq", openrouter: "OpenRouter" } as const;

export function ModelBadges({
  models,
  route,
}: {
  models?: ModelTag[] | undefined;
  route?: string | undefined;
}) {
  if (!models?.length) return null;
  const drafts = models.filter((m) => m.role !== "synth");
  const synth = models.find((m) => m.role === "synth");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {route && <span className="eyebrow mr-0.5 text-[10px]">{route}</span>}
      {drafts.map((m, i) => {
        const next = drafts[i + 1];
        const handoff = m.failed && m.provider === "openrouter" && next?.provider === "groq";
        return (
          <span key={`${m.provider}-${m.model}-${i}`} className="inline-flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={badge({ provider: m.provider, failed: !!m.failed })}>
                  {m.failed && <X className="size-3 no-underline" />}
                  <span className="opacity-70">{LABEL[m.provider]}</span>
                  <span className="truncate">{m.model}</span>
                  {m.note && !m.failed && m.provider === "openrouter" && (
                    <span className="opacity-70">· {m.note.split(",")[0]}</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs font-mono text-xs">
                {LABEL[m.provider]} · {m.model}
                {m.note ? ` — ${m.note}` : ""}
                {m.failed && !m.note ? " — failed" : ""}
              </TooltipContent>
            </Tooltip>
            {handoff && <ArrowRight className="size-3 text-muted-foreground" />}
          </span>
        );
      })}
      {synth && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(badge({ provider: synth.provider, synth: true }))}>
              <Combine className="size-3" />
              <span className="opacity-70">merged by</span>
              <span className="truncate">{synth.model}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">
            Final answer synthesized by {synth.model}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

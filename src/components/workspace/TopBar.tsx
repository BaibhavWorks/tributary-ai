import { Link } from "@tanstack/react-router";
import { GitBranch, Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useApiKeys, useWorkspace } from "@/lib/workspace/store";
import type { Thread } from "@/lib/workspace/types";
import { SettingsDialog } from "./SettingsDialog";

export function TopBar({ thread }: { thread: Thread | null }) {
  const ws = useWorkspace();
  const keys = useApiKeys();
  const [open, setOpen] = useState(false);

  const project = thread && ws ? ws.projects.find((p) => p.id === thread.projectId) : undefined;
  const chain: Thread[] = [];
  if (thread && ws) {
    let cur: Thread | undefined = thread;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? ws.threads[cur.parentId] : undefined;
    }
  }

  const providers = [
    { id: "gemini", label: "Gemini", on: !!keys?.gemini, dot: "bg-brain-gemini" },
    { id: "groq", label: "Groq", on: !!keys?.groq, dot: "bg-brain-groq" },
    { id: "openrouter", label: "OpenRouter", on: !!keys?.openrouter, dot: "bg-brain-openrouter" },
  ];

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
      <SidebarTrigger className="text-muted-foreground" />
      <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        {project && (
          <span className="hidden truncate text-muted-foreground sm:inline">{project.name}</span>
        )}
        {chain.map((t, i) => (
          <span
            key={t.id}
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              i < chain.length - 2 && "max-sm:hidden",
            )}
          >
            <span className={cn("text-muted-foreground/50", i === 0 && "max-sm:hidden")}>/</span>
            {i === chain.length - 1 ? (
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                {t.kind === "branch" && <GitBranch className="size-3.5 shrink-0 text-primary" />}
                <span className="truncate">{t.title}</span>
              </span>
            ) : (
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="truncate text-muted-foreground hover:text-foreground"
              >
                {t.title}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="hidden items-center gap-2.5 rounded-full border border-border px-2.5 py-1 md:flex">
        {providers.map((p) => (
          <Tooltip key={p.id}>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span
                  className={cn("size-1.5 rounded-full", p.on ? p.dot : "bg-muted-foreground/30")}
                />
                {p.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {p.on ? `${p.label} key saved` : `No ${p.label} key yet`}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            aria-label="Settings"
          >
            <Settings />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings & API keys</TooltipContent>
      </Tooltip>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}

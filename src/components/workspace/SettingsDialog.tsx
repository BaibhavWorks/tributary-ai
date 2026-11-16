import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODELS, OPENROUTER_WATERFALL } from "@/lib/ai/providers";
import { getKeys, saveKeys } from "@/lib/workspace/store";
import { EMPTY_KEYS, type ApiKeys } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

interface FieldDef {
  id: keyof ApiKeys;
  label: string;
  placeholder: string;
  hint: string;
  href?: string;
  dot?: string;
}

const FREE: FieldDef[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    placeholder: "AIza…",
    hint: `${MODELS.geminiFast} for quick chats · ${MODELS.geminiDeep} for deep research`,
    href: "https://aistudio.google.com/apikey",
    dot: "bg-brain-gemini",
  },
  {
    id: "groq",
    label: "Groq",
    placeholder: "gsk_…",
    hint: `${MODELS.groqHeavy} · ${MODELS.groqQwen}`,
    href: "https://console.groq.com/keys",
    dot: "bg-brain-groq",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    placeholder: "sk-or-…",
    hint: `Coding waterfall: ${OPENROUTER_WATERFALL.join(" → ")}`,
    href: "https://openrouter.ai/settings/keys",
    dot: "bg-brain-openrouter",
  },
];

const PAID: FieldDef[] = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    placeholder: "sk-ant-…",
    hint: "Saved for later — not used yet",
  },
  { id: "openai", label: "OpenAI", placeholder: "sk-…", hint: "Saved for later — not used yet" },
];

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [draft, setDraft] = useState<ApiKeys>(EMPTY_KEYS);
  const [shown, setShown] = useState<Partial<Record<keyof ApiKeys, boolean>>>({});

  useEffect(() => {
    if (open) {
      setDraft({ ...getKeys() });
      setShown({});
    }
  }, [open]);

  const field = (f: FieldDef, disabledLook = false) => (
    <div key={f.id} className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={`key-${f.id}`} className="flex items-center gap-2 text-sm">
          {f.dot && <span className={cn("size-2 rounded-full", f.dot)} />}
          {f.label}
          {draft[f.id] && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-success">
              saved
            </span>
          )}
        </Label>
        {f.href && (
          <a
            href={f.href}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Get a free key
          </a>
        )}
      </div>
      <div className="relative">
        <Input
          id={`key-${f.id}`}
          type={shown[f.id] ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder={f.placeholder}
          value={draft[f.id]}
          onChange={(e) => setDraft((d) => ({ ...d, [f.id]: e.target.value.trim() }))}
          className={cn("pr-10 font-mono text-xs", disabledLook && "border-dashed")}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => setShown((s) => ({ ...s, [f.id]: !s[f.id] }))}
          aria-label={shown[f.id] ? "Hide key" : "Show key"}
        >
          {shown[f.id] ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      <p className="font-mono text-[11px] leading-snug text-muted-foreground">{f.hint}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> API keys
          </DialogTitle>
          <DialogDescription>
            Keys are stored only in this browser and sent directly to each provider.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-4">
          <p className="eyebrow">Free keys</p>
          {FREE.map((f) => field(f))}
        </section>

        <section className="grid gap-4 rounded-lg border border-dashed border-border bg-surface p-4">
          <p className="eyebrow flex items-center gap-1.5">
            <Lock className="size-3" /> Optional paid keys (future)
          </p>
          {PAID.map((f) => field(f, true))}
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              saveKeys(draft);
              toast.success("Keys saved in this browser");
              onOpenChange(false);
            }}
          >
            Save keys
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

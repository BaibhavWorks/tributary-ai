"use client";

import { cn } from "@/lib/utils";
import {
  Code2Icon,
  EyeIcon,
  Maximize2Icon,
  Minimize2Icon,
  MonitorIcon,
  RotateCwIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CodeBlock,
  CodeBlockContainer,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockHeader,
  type CustomRendererProps,
} from "streamdown";

type View = "code" | "preview";
type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

/**
 * Sandbox flags for the Live Preview iframe. `allow-same-origin` is deliberately
 * absent: previewed pages run on an opaque origin and can never read this app's
 * localStorage (where the user's API keys live).
 */
export const PREVIEW_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock";

const PREVIEW_BRIDGE_SCRIPT = `<script>(function(){document.addEventListener("click",function(e){var link=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!link)return;var href=(link.getAttribute("href")||"").trim();if(!href||href==="#"){e.preventDefault();window.scrollTo({top:0,behavior:"smooth"});return;}if(href.startsWith("#")){e.preventDefault();var target=document.querySelector(href);if(target)target.scrollIntoView({behavior:"smooth",block:"start"});return;}e.preventDefault();var slug=href.replace(/^https?:\\/\\/[^/]+/,"").replace(/^[\\/#]+/,"").split(/[?#]/)[0];var sec=slug&&(document.getElementById(slug)||document.querySelector("[data-section='"+slug+"']"));if(sec){sec.scrollIntoView({behavior:"smooth",block:"start"});return;}var toast=document.getElementById("__tributary_nav_toast");if(!toast){toast=document.createElement("div");toast.id="__tributary_nav_toast";toast.style.cssText="position:fixed;bottom:14px;right:14px;z-index:9999;padding:8px 14px;border-radius:8px;background:#111827;color:#f9fafb;border:1px solid #374151;font:12px/1.4 sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);";document.body.appendChild(toast);}toast.textContent="Preview link: "+href;clearTimeout(window.__tributary_toast_t);window.__tributary_toast_t=setTimeout(function(){toast.remove();},2200);});})();</script>`;

function injectPreviewBridge(html: string): string {
  if (!html) return html;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${PREVIEW_BRIDGE_SCRIPT}</body>`);
  }
  return `${html}\n${PREVIEW_BRIDGE_SCRIPT}`;
}

/** Live Preview is the default once the block has finished streaming. */
export function resolveView(chosen: View | null, isIncomplete: boolean): View {
  if (chosen) return chosen;
  return isIncomplete ? "code" : "preview";
}

function ToggleButton({
  active,
  onClick,
  icon,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function HtmlArtifact({ code, language, isIncomplete }: CustomRendererProps) {
  const [chosen, setChosen] = useState<View | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const view = resolveView(chosen, isIncomplete);
  const previewSrcDoc = useMemo(() => injectPreviewBridge(code), [code]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const actions = (
    <>
      <div
        role="group"
        aria-label="Code or Live Preview"
        className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5"
      >
        <ToggleButton
          active={view === "code"}
          onClick={() => {
            setIsFullscreen(false);
            setChosen("code");
          }}
          icon={<Code2Icon className="size-3.5" />}
        >
          Code
        </ToggleButton>
        <ToggleButton
          active={view === "preview"}
          onClick={() => setChosen("preview")}
          icon={<EyeIcon className="size-3.5" />}
        >
          Live Preview
        </ToggleButton>
      </div>

      {view === "preview" && (
        <>
          <div
            role="group"
            aria-label="Preview screen size"
            className="hidden items-center gap-0.5 rounded-md border border-border bg-background p-0.5 sm:flex"
          >
            <ToggleButton
              active={viewport === "desktop"}
              onClick={() => setViewport("desktop")}
              icon={<MonitorIcon className="size-3.5" />}
              title="Desktop view (100%)"
            />
            <ToggleButton
              active={viewport === "tablet"}
              onClick={() => setViewport("tablet")}
              icon={<TabletIcon className="size-3.5" />}
              title="Tablet view (768px)"
            />
            <ToggleButton
              active={viewport === "mobile"}
              onClick={() => setViewport("mobile")}
              icon={<SmartphoneIcon className="size-3.5" />}
              title="Mobile view (375px)"
            />
          </div>

          <button
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Expand fullscreen"}
            onClick={() => setIsFullscreen((f) => !f)}
            className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground"
          >
            {isFullscreen ? (
              <Minimize2Icon className="size-3.5" />
            ) : (
              <Maximize2Icon className="size-3.5" />
            )}
          </button>

          <button
            type="button"
            aria-label="Reload preview"
            title="Reload preview"
            onClick={() => setReloadKey((k) => k + 1)}
            className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground"
          >
            <RotateCwIcon className="size-3.5" />
          </button>
        </>
      )}

      <CodeBlockDownloadButton code={code} language="html" />
      <CodeBlockCopyButton code={code} />
    </>
  );

  if (view === "code") {
    return (
      <CodeBlock code={code} language={language} isIncomplete={isIncomplete}>
        {actions}
      </CodeBlock>
    );
  }

  return (
    <CodeBlockContainer
      language={language}
      isIncomplete={isIncomplete}
      className={cn(
        isFullscreen && "fixed inset-0 z-50 m-0 flex h-screen w-screen flex-col rounded-none bg-background",
      )}
    >
      <CodeBlockHeader language={language} />
      <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center">
        <div className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/90 px-1.5 py-1 backdrop-blur-sm">
          {actions}
        </div>
      </div>
      <div
        className={cn(
          "flex w-full justify-center overflow-x-auto border border-border bg-neutral-950/60 transition-all",
          isFullscreen
            ? "min-h-0 flex-1 rounded-none border-x-0 border-b-0"
            : "h-[480px] min-h-[200px] resize-y overflow-y-hidden rounded-md",
        )}
      >
        <div
          style={{ width: VIEWPORT_WIDTHS[viewport], maxWidth: "100%" }}
          className={cn(
            "h-full transition-[width] duration-200 ease-out",
            viewport !== "desktop" && "border-x border-border/80 shadow-2xl",
          )}
        >
          <iframe
            key={reloadKey}
            title="Live Preview"
            srcDoc={previewSrcDoc}
            sandbox={PREVIEW_SANDBOX}
            className="size-full border-0 bg-preview-canvas"
          />
        </div>
      </div>
    </CodeBlockContainer>
  );
}

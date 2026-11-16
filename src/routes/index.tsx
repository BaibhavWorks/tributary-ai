import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import mark from "@/assets/tributary-mark.png";
import { useWorkspace } from "@/lib/workspace/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tributary — AI research & coding workspace" },
      {
        name: "description",
        content:
          "Projects, branching chats and a three-brain AI mixer for research and code. Saved locally in your browser.",
      },
      { property: "og:title", content: "Tributary — AI research & coding workspace" },
      {
        property: "og:description",
        content:
          "Projects, branching chats and a three-brain AI mixer for research and code. Saved locally in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const ws = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ws) return;
    const last =
      ws.prefs.lastThreadId && ws.threads[ws.prefs.lastThreadId]
        ? ws.prefs.lastThreadId
        : undefined;
    const target = last ?? ws.projects[0]?.mainThreadId;
    if (target) navigate({ to: "/chat/$threadId", params: { threadId: target }, replace: true });
  }, [ws, navigate]);

  return (
    <div className="ambient flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <img src={mark} alt="Tributary" width={48} height={48} className="size-12 animate-pulse" />
        <p className="eyebrow">Opening workspace</p>
      </div>
    </div>
  );
}

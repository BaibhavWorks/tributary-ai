import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/workspace/ChatView";
import { TopBar } from "@/components/workspace/TopBar";
import { setLastThread, useWorkspace } from "@/lib/workspace/store";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat — Tributary" },
      { name: "description", content: "A branching AI conversation in your Tributary workspace." },
      { property: "og:title", content: "Chat — Tributary" },
      {
        property: "og:description",
        content: "A branching AI conversation in your Tributary workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const ws = useWorkspace();
  const thread = ws?.threads[threadId];

  useEffect(() => {
    if (thread) setLastThread(thread.id);
  }, [thread]);

  if (!ws) {
    return (
      <div className="flex h-full flex-col">
        <TopBar thread={null} />
        <div className="flex-1" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex h-full flex-col">
        <TopBar thread={null} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="eyebrow">Not found</p>
          <h1 className="text-xl font-semibold">This chat no longer exists</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            It may have been deleted along with its parent branch or project.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link to="/">Back to workspace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar thread={thread} />
      <ChatView key={thread.id} thread={thread} />
    </div>
  );
}

import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronRight,
  Eraser,
  FolderClosed,
  FolderOpen,
  GitBranch,
  Globe,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import mark from "@/assets/tributary-mark.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  createModeThread,
  createProject,
  deleteProject,
  deleteThread,
  descendantIds,
  getWorkspace,
  renameProject,
  renameThread,
  toggleProjectCollapsed,
  usePending,
  useWorkspace,
} from "@/lib/workspace/store";
import type { Project, Thread, Workspace } from "@/lib/workspace/types";
import { NameDialog } from "./NameDialog";

type DialogState =
  | { kind: "new-project" }
  | { kind: "new-builder-chat"; projectId?: string }
  | { kind: "rename-project"; project: Project }
  | { kind: "rename-thread"; thread: Thread }
  | { kind: "delete-project"; project: Project }
  | { kind: "delete-thread"; thread: Thread }
  | null;

export function AppSidebar() {
  const ws = useWorkspace();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const [dialog, setDialog] = useState<DialogState>(null);
  const pending = usePending();

  const activeThread = activeId && ws ? ws.threads[activeId] : undefined;
  const workspaceMode = activeThread?.workspaceMode ?? ws?.prefs.workspaceMode ?? "general";
  const isBuilder = workspaceMode === "builder";

  const childrenOf = useMemo(() => {
    const map: Record<string, Thread[]> = {};
    if (!ws) return map;
    for (const t of Object.values(ws.threads)) {
      if (!t.parentId) continue;
      if ((t.workspaceMode ?? "general") !== workspaceMode) continue;
      (map[t.parentId] ??= []).push(t);
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.createdAt - b.createdAt);
    return map;
  }, [ws, workspaceMode]);

  const go = (threadId: string) => {
    navigate({ to: "/chat/$threadId", params: { threadId } });
    if (isMobile) setOpenMobile(false);
  };

  const afterDeleteThread = (thread: Thread, state: Workspace) => {
    if (!activeId) return;
    const doomed = descendantIds(state, thread.id);
    if (thread.kind === "branch" && doomed.includes(activeId)) {
      go(
        thread.parentId ??
          state.projects.find((p) => p.id === thread.projectId)?.mainThreadId ??
          "",
      );
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pb-1 pt-3">
        <Link to="/" className="flex items-center gap-2.5 rounded-md px-1 py-1">
          <img src={mark} alt="" width={28} height={28} className="size-7" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">
              Tributary
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {isBuilder ? "website builder" : "research · code"}
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow">
            {isBuilder ? "Website Builds" : "Projects"}
          </SidebarGroupLabel>
          <SidebarGroupAction
            title={isBuilder ? "New website build" : "New project"}
            onClick={() =>
              setDialog(
                isBuilder
                  ? { kind: "new-builder-chat", projectId: activeThread?.projectId }
                  : { kind: "new-project" },
              )
            }
          >
            <Plus />
            <span className="sr-only">{isBuilder ? "New website build" : "New project"}</span>
          </SidebarGroupAction>
          <SidebarMenu>
            {!ws &&
              Array.from({ length: 3 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <Skeleton className="h-8 w-full bg-sidebar-accent" />
                </SidebarMenuItem>
              ))}
            {ws?.projects.map((project) => {
              const open = !ws.prefs.collapsed[project.id];
              const rootThreads = Object.values(ws.threads)
                .filter(
                  (t) =>
                    t.projectId === project.id &&
                    t.kind === "main" &&
                    (t.workspaceMode ?? "general") === workspaceMode,
                )
                .sort((a, b) => a.createdAt - b.createdAt);

              const branchCount = Object.values(ws.threads).filter(
                (t) =>
                  t.projectId === project.id &&
                  t.kind === "branch" &&
                  (t.workspaceMode ?? "general") === workspaceMode,
              ).length;

              return (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    onClick={() => toggleProjectCollapsed(project.id)}
                    className="font-medium"
                  >
                    <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
                    {open ? (
                      <FolderOpen className="text-primary" />
                    ) : (
                      <FolderClosed className="text-muted-foreground" />
                    )}
                    <span className="truncate">{project.name}</span>
                    {branchCount > 0 && (
                      <span className="ml-auto pr-5 font-mono text-[10px] text-muted-foreground">
                        {branchCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal />
                        <span className="sr-only">Project options</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-44">
                      {isBuilder && (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              setDialog({ kind: "new-builder-chat", projectId: project.id })
                            }
                          >
                            <Globe /> New website build
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDialog({ kind: "rename-project", project })}
                      >
                        <Pencil /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDialog({ kind: "delete-project", project })}
                      >
                        <Trash2 /> Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {open && (
                    <SidebarMenuSub className="mr-0 pr-0">
                      {rootThreads.map((root) => (
                        <ThreadNode
                          key={root.id}
                          thread={root}
                          childrenOf={childrenOf}
                          activeId={activeId}
                          pending={pending}
                          onOpen={go}
                          onRename={(t) => setDialog({ kind: "rename-thread", thread: t })}
                          onDelete={(t) => setDialog({ kind: "delete-thread", thread: t })}
                        />
                      ))}
                      {isBuilder && (
                        <li>
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "new-builder-chat", projectId: project.id })
                            }
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                          >
                            <Plus className="size-3.5 text-primary" />
                            <span>New website build</span>
                          </button>
                        </li>
                      )}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {isBuilder ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-sidebar-border bg-transparent"
            onClick={() =>
              setDialog({ kind: "new-builder-chat", projectId: activeThread?.projectId })
            }
          >
            <Plus /> New website build
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-sidebar-border bg-transparent"
            onClick={() => setDialog({ kind: "new-project" })}
          >
            <Plus /> New project
          </Button>
        )}
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          Saved privately in this browser.
        </p>
      </SidebarFooter>

      <NameDialog
        open={dialog?.kind === "new-project"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="New project"
        description="Each project gets its own Main Chat. Branch off any AI reply to explore sub-topics."
        placeholder="e.g. Rust async runtime research"
        submitLabel="Create"
        onSubmit={(name) => {
          const { mainThreadId } = createProject(name);
          go(mainThreadId);
        }}
      />
      <NameDialog
        open={dialog?.kind === "new-builder-chat"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="New website build"
        description="Start a fresh 5-question guided website architect session."
        placeholder="e.g. Funkey Café landing page"
        submitLabel="Start building"
        onSubmit={(name) => {
          const threadId = createModeThread(
            "builder",
            dialog?.kind === "new-builder-chat" ? dialog.projectId : undefined,
            name.trim() || "Website Builder",
          );
          go(threadId);
        }}
      />
      <NameDialog
        open={dialog?.kind === "rename-project"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Rename project"
        initialValue={dialog?.kind === "rename-project" ? dialog.project.name : ""}
        onSubmit={(name) =>
          dialog?.kind === "rename-project" && renameProject(dialog.project.id, name)
        }
      />
      <NameDialog
        open={dialog?.kind === "rename-thread"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Rename chat"
        initialValue={dialog?.kind === "rename-thread" ? dialog.thread.title : ""}
        onSubmit={(name) =>
          dialog?.kind === "rename-thread" && renameThread(dialog.thread.id, name)
        }
      />

      <AlertDialog
        open={dialog?.kind === "delete-project" || dialog?.kind === "delete-thread"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.kind === "delete-project"
                ? `Delete “${dialog.project.name}”?`
                : dialog?.kind === "delete-thread" && dialog.thread.kind === "main"
                  ? "Clear messages in this chat?"
                  : "Delete this branch?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.kind === "delete-project"
                ? "The project, its chats and every branch will be removed from this browser."
                : dialog?.kind === "delete-thread" && dialog.thread.kind === "main"
                  ? "All messages in this chat will be removed. Existing branches are kept."
                  : "This branch and all of its sub-branches will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (dialog?.kind === "delete-project") {
                  const isActive =
                    activeId && getWorkspace().threads[activeId]?.projectId === dialog.project.id;
                  deleteProject(dialog.project.id);
                  if (isActive) navigate({ to: "/" });
                } else if (dialog?.kind === "delete-thread") {
                  const before = getWorkspace();
                  afterDeleteThread(dialog.thread, before);
                  deleteThread(dialog.thread.id);
                }
              }}
            >
              {dialog?.kind === "delete-thread" && dialog.thread.kind === "main"
                ? "Clear"
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

interface ThreadNodeProps {
  thread: Thread;
  childrenOf: Record<string, Thread[]>;
  activeId: string | undefined;
  pending: Record<string, string>;
  onOpen: (id: string) => void;
  onRename: (t: Thread) => void;
  onDelete: (t: Thread) => void;
}

function ThreadNode({
  thread,
  childrenOf,
  activeId,
  pending,
  onOpen,
  onRename,
  onDelete,
}: ThreadNodeProps) {
  const kids = childrenOf[thread.id] ?? [];
  const isMain = thread.kind === "main";
  const isBuilder = (thread.workspaceMode ?? "general") === "builder";
  const Icon = isMain ? (isBuilder ? Globe : MessageSquare) : GitBranch;
  return (
    <li className="group/row relative">
      <SidebarMenuSubButton
        asChild
        isActive={activeId === thread.id}
        className="pr-7 data-[active=true]:shadow-[inset_2px_0_0_var(--color-primary)]"
      >
        <Link
          to="/chat/$threadId"
          params={{ threadId: thread.id }}
          onClick={(e) => {
            e.preventDefault();
            onOpen(thread.id);
          }}
        >
          <Icon className={cn(isMain ? "text-foreground" : "text-primary/80")} />
          <span className="truncate">{thread.title}</span>
          {pending[thread.id] && (
            <span
              className="absolute right-7 size-1.5 animate-pulse rounded-full bg-primary"
              aria-label="Working"
            />
          )}
        </Link>
      </SidebarMenuSubButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute right-1 top-1 flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
            aria-label="Chat options"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-44">
          {(!isMain || isBuilder) && (
            <DropdownMenuItem onClick={() => onRename(thread)}>
              <Pencil /> Rename
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(thread)}
          >
            {isMain ? (
              <>
                <Eraser /> Clear messages
              </>
            ) : (
              <>
                <Trash2 /> Delete branch
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {kids.length > 0 && (
        <SidebarMenuSub className="mx-2.5 mr-0 px-1.5 pr-0">
          {kids.map((k) => (
            <ThreadNode
              key={k.id}
              thread={k}
              childrenOf={childrenOf}
              activeId={activeId}
              pending={pending}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </SidebarMenuSub>
      )}
    </li>
  );
}

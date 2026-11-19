import { useSyncExternalStore } from "react";
import {
  EMPTY_KEYS,
  type ApiKeys,
  type ChatMessage,
  type Mode,
  type Project,
  type Thread,
  type Workspace,
  type WorkspaceMode,
} from "./types";

const WS_KEY = "tributary.workspace.v1";
const KEYS_KEY = "tributary.keys.v1";

export function uid(prefix = ""): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function makeProject(
  name: string,
  workspaceMode: WorkspaceMode = "general",
): { project: Project; main: Thread } {
  const now = Date.now();
  const projectId = uid("p_");
  const main: Thread = {
    id: uid("t_"),
    projectId,
    parentId: null,
    kind: "main",
    workspaceMode,
    title: workspaceMode === "builder" ? "Website Builder" : "Main Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  return { project: { id: projectId, name, mainThreadId: main.id, createdAt: now }, main };
}

function freshWorkspace(): Workspace {
  const { project, main } = makeProject("My first project", "general");
  return {
    version: 1,
    projects: [project],
    threads: { [main.id]: main },
    prefs: { mode: "auto", workspaceMode: "general", collapsed: {}, lastThreadId: main.id },
  };
}

function readWorkspace(): Workspace {
  let ws: Workspace | null = null;
  try {
    const raw = window.localStorage.getItem(WS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Workspace;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.projects) && parsed.threads)
        ws = parsed;
    }
  } catch {
    ws = null;
  }
  // Idempotent bootstrap: only create a default project when none are stored.
  if (!ws || ws.projects.length === 0) {
    ws = freshWorkspace();
    window.localStorage.setItem(WS_KEY, JSON.stringify(ws));
  }
  ws.prefs = {
    ...ws.prefs,
    mode: ws.prefs?.mode ?? "auto",
    workspaceMode: ws.prefs?.workspaceMode ?? "general",
    collapsed: ws.prefs?.collapsed ?? {},
  };
  return ws;
}

function readKeys(): ApiKeys {
  try {
    const raw = window.localStorage.getItem(KEYS_KEY);
    return raw ? { ...EMPTY_KEYS, ...(JSON.parse(raw) as Partial<ApiKeys>) } : { ...EMPTY_KEYS };
  } catch {
    return { ...EMPTY_KEYS };
  }
}

/* ---------- workspace store ---------- */

let ws: Workspace | null = null;
let keys: ApiKeys | null = null;
const listeners = new Set<() => void>();
let storageBound = false;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!storageBound && typeof window !== "undefined") {
    storageBound = true;
    // Keep multiple tabs in sync.
    window.addEventListener("storage", (e) => {
      if (e.key === WS_KEY) ws = readWorkspace();
      else if (e.key === KEYS_KEY) keys = readKeys();
      else return;
      emit();
    });
  }
  return () => listeners.delete(listener);
}

export function getWorkspace(): Workspace {
  if (!ws) ws = readWorkspace();
  return ws;
}

export function getKeys(): ApiKeys {
  if (!keys) keys = readKeys();
  return keys;
}

function update(fn: (draft: Workspace) => Workspace) {
  ws = fn(getWorkspace());
  window.localStorage.setItem(WS_KEY, JSON.stringify(ws));
  emit();
}

export function saveKeys(next: ApiKeys) {
  keys = { ...next };
  window.localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
  emit();
}

/** Returns null during SSR / before hydration, then the live workspace. */
export function useWorkspace(): Workspace | null {
  return useSyncExternalStore(subscribe, getWorkspace, () => null);
}

export function useApiKeys(): ApiKeys | null {
  return useSyncExternalStore(subscribe, getKeys, () => null);
}

/* ---------- actions ---------- */

export function createProject(name: string): { projectId: string; mainThreadId: string } {
  const currentMode = getWorkspace().prefs.workspaceMode ?? "general";
  const { project, main } = makeProject(name.trim() || "Untitled project", currentMode);
  update((s) => ({
    ...s,
    projects: [...s.projects, project],
    threads: { ...s.threads, [main.id]: main },
  }));
  return { projectId: project.id, mainThreadId: main.id };
}

export function createModeThread(
  workspaceMode: WorkspaceMode,
  projectId?: string,
  title?: string,
): string {
  const s = getWorkspace();
  const targetProjectId = projectId ?? s.projects[0]?.id;
  if (!targetProjectId) {
    const created = createProject("My first project");
    return created.mainThreadId;
  }
  const now = Date.now();
  const thread: Thread = {
    id: uid("t_"),
    projectId: targetProjectId,
    parentId: null,
    kind: "main",
    workspaceMode,
    title: title ?? (workspaceMode === "builder" ? "Website Builder" : "Main Chat"),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  update((st) => ({
    ...st,
    threads: { ...st.threads, [thread.id]: thread },
    prefs: {
      ...st.prefs,
      workspaceMode,
      lastThreadId: thread.id,
      collapsed: { ...st.prefs.collapsed, [targetProjectId]: false },
    },
  }));
  return thread.id;
}

export function renameProject(projectId: string, name: string) {
  update((s) => ({
    ...s,
    projects: s.projects.map((p) =>
      p.id === projectId ? { ...p, name: name.trim() || p.name } : p,
    ),
  }));
}

export function deleteProject(projectId: string) {
  update((s) => {
    const threads = Object.fromEntries(
      Object.entries(s.threads).filter(([, t]) => t.projectId !== projectId),
    );
    const projects = s.projects.filter((p) => p.id !== projectId);
    if (projects.length === 0) return freshWorkspace();
    return { ...s, projects, threads };
  });
}

export function toggleProjectCollapsed(projectId: string) {
  update((s) => ({
    ...s,
    prefs: {
      ...s.prefs,
      collapsed: { ...s.prefs.collapsed, [projectId]: !s.prefs.collapsed[projectId] },
    },
  }));
}

export function setMode(mode: Mode) {
  update((s) => ({ ...s, prefs: { ...s.prefs, mode } }));
}

export function setWorkspaceMode(workspaceMode: WorkspaceMode, activeProjectId?: string): string {
  const s = getWorkspace();
  const matchingThreads = Object.values(s.threads)
    .filter((t) => (t.workspaceMode ?? "general") === workspaceMode)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const existing = matchingThreads[0];
  if (existing) {
    update((st) => ({
      ...st,
      prefs: { ...st.prefs, workspaceMode, lastThreadId: existing.id },
    }));
    return existing.id;
  }

  return createModeThread(workspaceMode, activeProjectId);
}

export function setLastThread(threadId: string) {
  const s = getWorkspace();
  const thread = s.threads[threadId];
  const threadMode = thread?.workspaceMode ?? "general";
  if (s.prefs.lastThreadId === threadId && s.prefs.workspaceMode === threadMode) return;
  update((st) => ({
    ...st,
    prefs: { ...st.prefs, lastThreadId: threadId, workspaceMode: threadMode },
  }));
}

export function renameThread(threadId: string, title: string) {
  update((s) => {
    const t = s.threads[threadId];
    if (!t) return s;
    return {
      ...s,
      threads: { ...s.threads, [threadId]: { ...t, title: title.trim() || t.title } },
    };
  });
}

/** Collects a thread and all its descendant branches. */
export function descendantIds(s: Workspace, threadId: string): string[] {
  const out = [threadId];
  for (let i = 0; i < out.length; i++) {
    for (const t of Object.values(s.threads)) if (t.parentId === out[i]) out.push(t.id);
  }
  return out;
}

/** Deletes a branch and its sub-branches. Main chats are cleared instead. */
export function deleteThread(threadId: string) {
  update((s) => {
    const t = s.threads[threadId];
    if (!t) return s;
    if (t.kind === "main") {
      return {
        ...s,
        threads: { ...s.threads, [threadId]: { ...t, messages: [], updatedAt: Date.now() } },
      };
    }
    const doomed = new Set(descendantIds(s, threadId));
    return {
      ...s,
      threads: Object.fromEntries(Object.entries(s.threads).filter(([id]) => !doomed.has(id))),
    };
  });
}

export function appendMessage(threadId: string, message: ChatMessage) {
  update((s) => {
    const t = s.threads[threadId];
    if (!t) return s;
    return {
      ...s,
      threads: {
        ...s.threads,
        [threadId]: { ...t, messages: [...t.messages, message], updatedAt: Date.now() },
      },
    };
  });
}

/** Forks a thread at a message: the new branch keeps all history up to and including it. */
export function createBranch(threadId: string, messageId: string): string | null {
  const s = getWorkspace();
  const source = s.threads[threadId];
  if (!source) return null;
  const idx = source.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return null;
  const history = source.messages.slice(0, idx + 1);
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const base = (lastUser?.content ?? source.title).replace(/\s+/g, " ").trim();
  const now = Date.now();
  const branch: Thread = {
    id: uid("t_"),
    projectId: source.projectId,
    parentId: source.id,
    kind: "branch",
    workspaceMode: source.workspaceMode ?? "general",
    title: base.length > 42 ? base.slice(0, 40) + "…" : base || "New branch",
    branchedFromMessageId: messageId,
    messages: history.map((m) => ({ ...m })),
    createdAt: now,
    updatedAt: now,
  };
  update((st) => ({
    ...st,
    threads: { ...st.threads, [branch.id]: branch },
    prefs: { ...st.prefs, collapsed: { ...st.prefs.collapsed, [source.projectId]: false } },
  }));
  return branch.id;
}

/* ---------- in-memory pending state (not persisted) ---------- */

let pending: Record<string, string> = {};
const pendingListeners = new Set<() => void>();
export function setPending(threadId: string, stage: string | null) {
  const next = { ...pending };
  if (stage) next[threadId] = stage;
  else delete next[threadId];
  pending = next;
  pendingListeners.forEach((l) => l());
}
export function usePending(): Record<string, string> {
  return useSyncExternalStore(
    (l) => {
      pendingListeners.add(l);
      return () => pendingListeners.delete(l);
    },
    () => pending,
    () => pending,
  );
}

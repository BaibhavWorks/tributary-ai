# Tributary — Multi-Model AI Research & Coding Workspace

A privacy-first, dark-mode AI research and coding workspace featuring **non-linear conversation branching**, **project-based thread organization**, and a **three-brain Mixture-of-Agents (MoA) routing engine** with automated rate-limit fallbacks.

Built to run locally or as a static web app using Bring-Your-Own-Key (BYOK) architecture—zero backend servers, zero database costs, and complete client-side data ownership.

---

## Key Features

- **Non-Linear Conversation Branching:** Fork any AI response into a nested sub-topic thread (`Branch Here`) while preserving full upstream conversation context, preventing main threads from getting derailed by tangents.
- **Three-Brain Mixture-of-Agents (MoA) Routing:**
  - **Fast Mode:** Routes lightweight queries directly to `gemini-3.5-flash-lite` for sub-second responses.
  - **Auto Mix:** Dispatches complex prompts concurrently (`Promise.all`) to **Google Gemini** (`gemini-3.8-flash`) and **Groq** (`openai/gpt-oss-120b`), then synthesizes their outputs into a single unified answer.
  - **Heavyweight Consensus:** Cross-checks responses across **Gemini**, **Groq**, and an **OpenRouter Coding Waterfall** to resolve contradictions and debug edge cases.
- **Resilient Coding Waterfall Fallback:** Automatically handles HTTP `429` rate limits and daily quota caps across OpenRouter free-tier coding models before falling back cleanly to Groq (`qwen/qwen3.8-27b`).
- **Interactive Artifact Previews:** Renders generated HTML/CSS/JS code blocks inside sandboxed live previews directly in the chat stream alongside one-click copy and file export.
- **100% Client-Side Privacy:** All projects, conversation trees, and API keys are persisted locally in browser `localStorage`—keys are never transmitted to any third-party backend.

---

## System Architecture

```mermaid
flowchart TD
    User([User Prompt & Mode Selection]) --> Router{Mixture Router}

    Router -->|Fast Mode| G_Lite[Google Gemini 3.5 Flash-Lite]
    
    Router -->|Auto Mix| Parallel2[Concurrent Dispatch: Promise.all]
    Parallel2 --> G_Main[Google Gemini 3.8 Flash]
    Parallel2 --> Groq_Main[Groq: GPT-OSS-120B]
    G_Main & Groq_Main --> Synth[Synthesis & Deduplication]

    Router -->|Heavyweight Consensus| Parallel3[3-Brain Consensus Dispatch]
    Parallel3 --> G_Main
    Parallel3 --> Groq_Main
    Parallel3 --> OR_Chain[OpenRouter Coding Waterfall]

    subgraph Fallback Waterfall
        OR_Chain -->|1st Priority| M1[particle-ai/particle-1:free]
        M1 -->|429 / Quota Limit| M2[dots-studio/dots-3-note-preview:free]
        M2 -->|429 / Quota Limit| M3[openrouter/free Auto-Router]
        M3 -->|Daily Cap Exhausted| Groq_Fallback[Groq Fallback: Qwen 3.8 27B]
    end

    G_Lite & Synth & Groq_Fallback --> UI[Chat UI + Model Attribution Badge + Branch Forking]
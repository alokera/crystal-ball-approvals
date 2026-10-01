# Crystal Ball — Approvals Assistant

A working rebuild of the OomniEye **Approvals** assistant panel. Each of its five actions is backed by a real Claude call that is streamed or schema-validated, with an 8-second timeout and a deterministic fallback.

```
web/ (Next.js + Zustand)  ──HTTP/SSE──▶  server/ (Express + TS strict)  ──▶  Claude API (Anthropic SDK)
          ▲                                     ▲
          └──────── packages/contracts (shared Zod schemas) ────────┘
```

## Quick start

Requires Node 20+.

```bash
npm install
cp server/.env.example server/.env        # add ANTHROPIC_API_KEY
cp web/.env.example web/.env.local
npm run dev                               # server :4000, web :3000
```

Open http://localhost:3000. The app also runs **without a key**: every action degrades to its rule-based fallback and is labelled "AI unavailable".

```bash
npm test          # server (Jest + Supertest), then web (Vitest + Testing Library)
npm run typecheck
```

### Seeing the failure handling
| Try this | What you should see |
|---|---|
| Remove `ANTHROPIC_API_KEY` and restart | Every action still answers, labelled "AI unavailable, showing basic summary." (or a similar badge) |
| `LLM_TIMEOUT_MS=1` | Same as above, triggered by the timeout path |
| Stop the server while the page is open | Inline error and **Retry** button; the UI never freezes |
| `RATE_LIMIT_MAX=2`, then click quickly | Typed 429 message shown in the panel |

## The five actions

| Action | Endpoint | AI output | Non-AI fallback |
|---|---|---|---|
| **Present me Summary** | `POST /api/ai/summary` | Structured JSON (`SummaryLLMOutput`), Zod-validated, then **cross-checked against the queue**: unknown, duplicate or missing ids are rejected | Rule-based ranking (safety first, then items that block work, then SLA age). Includes **Read aloud** via the browser's speech API |
| **Talk to me** | `POST /api/ai/chat` `mode=talk` (SSE) | Streamed, multi-turn, grounded in the queue | The rule-based ranking as text |
| **Help me** | `POST /api/ai/chat` `mode=help` (SSE) | Streamed; the prompt contains **only** the retrieved policy chunks; sources are cited | Returns the retrieved policy sections verbatim. If retrieval finds nothing, **the model is not called at all** |
| **Teach me** | `POST /api/ai/chat` `mode=teach` (SSE) | Streamed; a 5-step overview first, then follow-ups that re-explain one step | Static walkthrough built from the policy |
| **Replay Greeting** | `POST /api/ai/greeting` | Structured JSON (`GreetingLLMOutput`) | Template that includes the pending and overdue counts |

The panel also has a language picker, and every prompt tells the model to answer in the operator's language.

## How the stack maps to the requirements

| Requirement | Implementation |
|---|---|
| React + Next.js + Tailwind | `web/` (App Router, Tailwind v4, styled to match the reference screenshot: white panel, navy header, orange Replay Greeting; responsive to phone width). The panel has avatar, header, info/expand/close controls, action cards, Replay Greeting and footer. The page around it is intentionally minimal (title, search, queue table): only the panel is in scope, so no decorative controls that do nothing. Loading skeletons, typing indicator, error banners and Retry everywhere |
| Streaming | SSE from Express (`start → delta* → done`), read with `fetch` + `ReadableStream`, rendered token by token |
| State | Zustand (`web/src/store/assistant.ts`) holds chats per mode, summary, greeting, view and locale. No prop-drilling |
| Backend | Express + TypeScript `strict` (plus `noUncheckedIndexedAccess`) |
| API contract | `packages/contracts/src/index.ts` was written before any route (see git history). The server validates requests and model output; the client re-validates every response **and every SSE event** |
| LLM | Anthropic SDK, server-side only. Model is `claude-opus-5-5` at `effort: low` (configurable with `ANTHROPIC_MODEL`). SDK retries are off so the 8s budget holds. Server-side refusal fallback is on (`fallbacks: "default"`) |
| Structured output | `messages.parse` + `betaZodOutputFormat`, **then** our own `safeParse`. The UI never parses model text |
| Prompt versioning | `server/prompts/<id>.v1.ts` (summary, chat, help, teach, greeting), each exporting `id` + semver `version`. A breaking rewrite gets a new `.v2.ts` file so versions can be compared side by side. The version is sent in the `x-prompt-version` header and logged with every call |
| Fallbacks | `withTimeout` / `nextWithin` (`server/src/lib/timeout.ts`), with rules in `server/src/services/rules.ts` |
| Rate limiting | `express-rate-limit` on `/api/ai/*` only: 20 requests/min, keyed by `x-session-id` + IP |
| RAG | `server/src/knowledge/`: a ~330-word policy note, 5 chunks, IDF-weighted keyword retrieval |

**Substitutions:** no database. The queue is a seeded fixture (`server/src/data/approvals.json`), as the spec allows. In production, approvals would live in MongoDB, and sessions and rate-limit counters in Redis. Retrieval uses keyword matching instead of pgvector, which is sufficient for 5 chunks.

## Design note

**AI-necessary vs. AI-unnecessary.** *Talk*, *Teach* and *Help* need an LLM. Free-form follow-ups, re-explaining one step more simply, and phrasing a policy answer for a specific question cannot be enumerated in advance. *Summary* needs AI only for the prose (the headline and per-item reasons). The ranking itself is deterministic, so the model output is checked against the queue, and the rule-based version is a first-class fallback. *Replay Greeting* is the least necessary: a template with live counts covers 90% of the value. I kept the LLM call for tone and language, but it would be the first to cut for cost. *Help me* skips the model entirely when retrieval finds nothing, because an ungrounded answer is worse than "the policy doesn't cover that".

**Fallback design.** Every call has an 8s budget. Structured calls race a timer that also aborts the upstream request. Streams apply the budget to the first token and to each gap between tokens: a healthy answer can legitimately stream for longer than 8s, so an 8s total cap would cut off good answers. A failure before any text streams a labelled deterministic answer. A failure mid-answer keeps the partial text and flags it with Retry, instead of splicing canned text into it. Nothing surfaces as a raw 500.

**With more time:** an eval set (golden queue states → expected rankings, plus grounding checks for Help) run in CI, so prompt version bumps are measured rather than eyeballed.

## Assumptions and challenged criteria

- **"8s timeout" on streams** is read as time-to-first-token plus an idle timeout, not a total cap (see above).
- **"Per-session" rate limiting:** a client-sent session id is trivially rotated, so the key combines it with the IP address. Production would key on the authenticated user.
- **Dates:** the fixture items are from Sep 18. Against today's date they are all past their SLA, and both the AI and rule paths say so rather than hiding it.
- **Localisation:** AI answers follow the selected language. Fallback text is English-only.
- **Illustrations:** the reference uses custom character art. I used emoji and a small SVG avatar, not copies of their assets.

## Testing

Tests were written first; `git log` shows each red commit before its implementation.

- **Unit (Jest):** services are tested through an injected `LlmClient` fake, not by mocking modules. The tests cover wrong shapes, hallucinated or dropped ids, thrown errors (such as a revoked key), stalls, mid-stream failure and multi-turn history.
- **Integration (Supertest):** every AI endpoint on its success, timeout and failure paths, typed 400s, per-session 429s, and SSE frames parsed against the contract.
- **Component (Vitest + Testing Library):** a controllable SSE stream drives the chat, so the tests can assert on the UI *between* tokens. They cover loading, incremental streaming, retry, typed server errors, fallback labelling, interrupted replies, contract-breaking events (never rendered), and streams that end without `done`.

## Where AI tools were used

Built with Claude Code (Claude Opus 5.5) as a pair programmer: scaffolding, test and implementation drafts, and CSS. I directed the design decisions (the contract-first flow, the fallback semantics and the grounding checks) and reviewed each commit. The tests caught two real bugs along the way: a timeout-vs-abort race that mislabelled timeouts as generic errors, and a rule that over-prioritised items whose description merely mentioned "emergency".

## Layout

```
packages/contracts/   Zod schemas shared by server and web
server/
  prompts/            summary.v1.ts, chat.v1.ts, help.v1.ts, teach.v1.ts, greeting.v1.ts
  src/app.ts          Express app factory (DI for LLM, timeout, limits)
  src/llm/            LlmClient interface + Anthropic implementation
  src/services/       summary, greeting, chat stream, deterministic rules
  src/knowledge/      policy note + retrieval
  test/               Jest unit + Supertest integration
web/
  src/components/     Dashboard, ApprovalsTable, AssistantPanel, ChatView, SummaryView
  src/store/          Zustand store
  src/lib/            typed API client (SSE parser), session id
  test/               Vitest + Testing Library
```

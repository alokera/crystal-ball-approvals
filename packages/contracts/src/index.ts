/**
 * API contract for the Approvals assistant.
 *
 * Written before any route exists (OpenAPI-first spirit): the server validates
 * every request and every LLM output against these schemas, and the web client
 * re-validates every response before rendering it. Nothing downstream trusts
 * raw model text.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

export const ApprovalType = z.enum(['folder', 'video', 'pdf', 'image']);
export type ApprovalType = z.infer<typeof ApprovalType>;

export const ApprovalItem = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: ApprovalType,
  submittedBy: z.string().min(1),
  status: z.literal('pending_review'),
  submittedAt: z.string().date(),
  path: z.array(z.string()),
  description: z.string(),
});
export type ApprovalItem = z.infer<typeof ApprovalItem>;

export const ApprovalQueue = z.array(ApprovalItem);

/** BCP-47-ish language tag, e.g. "en", "hi", "es-MX". */
export const Locale = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Expected a language tag like "en" or "es-MX"')
  .default('en');

export const AnswerSource = z.enum(['ai', 'fallback']);
export type AnswerSource = z.infer<typeof AnswerSource>;

export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum(['bad_request', 'rate_limited', 'not_found', 'internal']),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

// ---------------------------------------------------------------------------
// GET /api/approvals
// ---------------------------------------------------------------------------

export const ApprovalsResponse = z.object({ items: ApprovalQueue });
export type ApprovalsResponse = z.infer<typeof ApprovalsResponse>;

// ---------------------------------------------------------------------------
// POST /api/ai/greeting
// ---------------------------------------------------------------------------

export const GreetingRequest = z.object({ locale: Locale }).strict();
export type GreetingRequest = z.infer<typeof GreetingRequest>;

/** Shape the model must return. Validated before it leaves the server. */
export const GreetingLLMOutput = z.object({
  greeting: z.string().min(1).max(280),
});

export const GreetingResponse = z.object({
  greeting: z.string().min(1).max(280),
  pendingCount: z.number().int().nonnegative(),
  source: AnswerSource,
});
export type GreetingResponse = z.infer<typeof GreetingResponse>;

// ---------------------------------------------------------------------------
// POST /api/ai/summary
// ---------------------------------------------------------------------------

export const Priority = z.enum(['high', 'medium', 'low']);
export type Priority = z.infer<typeof Priority>;

export const SummaryRequest = z.object({ locale: Locale }).strict();
export type SummaryRequest = z.infer<typeof SummaryRequest>;

/** Shape the model must return. Item ids are checked against the queue server-side. */
export const SummaryLLMOutput = z.object({
  headline: z.string().min(1).max(400),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        priority: Priority,
        reason: z.string().min(1).max(400),
        recommendedAction: z.string().min(1).max(200),
      }),
    )
    .min(1),
});
export type SummaryLLMOutput = z.infer<typeof SummaryLLMOutput>;

export const SummaryItem = z.object({
  id: z.string(),
  title: z.string(),
  type: ApprovalType,
  priority: Priority,
  reason: z.string(),
  recommendedAction: z.string(),
});
export type SummaryItem = z.infer<typeof SummaryItem>;

export const SummaryResponse = z.object({
  headline: z.string().min(1),
  items: z.array(SummaryItem),
  pendingCount: z.number().int().nonnegative(),
  source: AnswerSource,
  generatedAt: z.string().datetime(),
});
export type SummaryResponse = z.infer<typeof SummaryResponse>;

// ---------------------------------------------------------------------------
// POST /api/ai/chat  (Server-Sent Events)
// Serves "Talk to me", "Help me" and "Teach me".
// ---------------------------------------------------------------------------

export const ChatMode = z.enum(['talk', 'help', 'teach']);
export type ChatMode = z.infer<typeof ChatMode>;

export const ChatMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatRequest = z
  .object({
    mode: ChatMode,
    locale: Locale,
    messages: z.array(ChatMessage).min(1).max(30),
  })
  .strict()
  .refine((r) => r.messages[r.messages.length - 1]?.role === 'user', {
    message: 'The last message must come from the user',
    path: ['messages'],
  });
export type ChatRequest = z.infer<typeof ChatRequest>;

export const Citation = z.object({ id: z.string(), title: z.string() });
export type Citation = z.infer<typeof Citation>;

export const FallbackReason = z.enum(['timeout', 'llm_error', 'no_context']);
export type FallbackReason = z.infer<typeof FallbackReason>;

/**
 * One SSE `data:` payload. Sequence:
 *   start → (delta)* → done
 *   start → fallback → (delta)* → done      (AI failed before producing text)
 *   start → (delta)+ → error                (AI failed mid-answer; partial text kept)
 */
export const ChatStreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), mode: ChatMode, citations: z.array(Citation) }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('fallback'), reason: FallbackReason }),
  z.object({ type: z.literal('done'), source: AnswerSource }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEvent>;

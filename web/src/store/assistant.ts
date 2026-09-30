/**
 * Conversation and panel state (Zustand). Components select only what they
 * need, so nothing is prop-drilled through the panel.
 */
import type { AnswerSource, ChatMode, Citation, GreetingResponse, SummaryResponse } from '@cb/contracts';
import { create } from 'zustand';
import { ApiError, MESSAGES, postGreeting, postSummary, streamChat } from '@/lib/api';

export type View = 'home' | 'summary' | ChatMode;

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: AnswerSource;
  citations?: Citation[];
  streaming?: boolean;
  interrupted?: boolean;
};

export type ChatStatus = 'idle' | 'waiting' | 'streaming' | 'error';
export type ChatState = { messages: UiMessage[]; status: ChatStatus; error?: string };

type Async<T> = { status: 'idle' | 'loading' | 'success' | 'error'; data?: T; error?: string };

type State = {
  open: boolean;
  expanded: boolean;
  view: View;
  locale: string;
  greeting: Async<GreetingResponse>;
  summary: Async<SummaryResponse>;
  chats: Record<ChatMode, ChatState>;
};

type Actions = {
  setOpen: (open: boolean) => void;
  toggleExpanded: () => void;
  setView: (view: View) => void;
  setLocale: (locale: string) => void;
  loadGreeting: () => Promise<void>;
  loadSummary: () => Promise<void>;
  sendMessage: (mode: ChatMode, text: string) => Promise<void>;
  retry: (mode: ChatMode) => Promise<void>;
};

const emptyChat = (): ChatState => ({ messages: [], status: 'idle' });

const initialState = (): State => ({
  open: true,
  expanded: false,
  view: 'home',
  locale: 'en',
  greeting: { status: 'idle' },
  summary: { status: 'idle' },
  chats: { talk: emptyChat(), help: emptyChat(), teach: emptyChat() },
});

const controllers: Partial<Record<ChatMode, AbortController>> = {};
let seq = 0;
const nextId = () => `m${++seq}`;

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : MESSAGES.network);

export const useAssistant = create<State & Actions>()((set, get) => {
  const patchChat = (mode: ChatMode, fn: (chat: ChatState) => ChatState) =>
    set((s) => ({ chats: { ...s.chats, [mode]: fn(s.chats[mode]) } }));

  /** Updates the in-flight assistant message, creating it on the first token. */
  const patchStreaming = (mode: ChatMode, fn: (m: UiMessage) => UiMessage) =>
    patchChat(mode, (chat) => {
      const last = chat.messages[chat.messages.length - 1];
      const current: UiMessage =
        last?.streaming ? last : { id: nextId(), role: 'assistant', content: '', streaming: true };
      const rest = last?.streaming ? chat.messages.slice(0, -1) : chat.messages;
      return { ...chat, messages: [...rest, fn(current)] };
    });

  const finishStreaming = (mode: ChatMode, patch: Partial<UiMessage>) =>
    patchChat(mode, (chat) => ({
      ...chat,
      messages: chat.messages.map((m) => (m.streaming ? { ...m, ...patch, streaming: false } : m)),
    }));

  async function run(mode: ChatMode) {
    controllers[mode]?.abort();
    const controller = new AbortController();
    controllers[mode] = controller;

    const history = get()
      .chats[mode].messages.filter((m) => !m.interrupted)
      .map(({ role, content }) => ({ role, content }));

    patchChat(mode, (chat) => ({ ...chat, status: 'waiting', error: undefined }));

    let citations: Citation[] = [];
    let source: AnswerSource = 'ai';
    let finished = false;
    try {
      for await (const event of streamChat({ mode, locale: get().locale, messages: history }, controller.signal)) {
        switch (event.type) {
          case 'start':
            citations = event.citations;
            break;
          case 'fallback':
            source = 'fallback';
            break;
          case 'delta':
            patchStreaming(mode, (m) => ({ ...m, content: m.content + event.text, citations, source }));
            patchChat(mode, (chat) => ({ ...chat, status: 'streaming' }));
            break;
          case 'done':
            finished = true;
            finishStreaming(mode, { source: event.source, citations });
            patchChat(mode, (chat) => ({ ...chat, status: 'idle' }));
            break;
          case 'error':
            throw new ApiError(event.message, 'server');
        }
      }
      if (!finished) throw new ApiError(MESSAGES.truncated, 'network');
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'aborted') return;
      finishStreaming(mode, { interrupted: true });
      patchChat(mode, (chat) => ({ ...chat, status: 'error', error: errorMessage(err) }));
    }
  }

  return {
    ...initialState(),

    setOpen: (open) => set({ open }),
    toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
    setView: (view) => set({ view }),
    setLocale: (locale) => set({ locale, summary: { status: 'idle' } }),

    loadGreeting: async () => {
      set({ greeting: { ...get().greeting, status: 'loading', error: undefined } });
      try {
        set({ greeting: { status: 'success', data: await postGreeting(get().locale) } });
      } catch (err) {
        set({ greeting: { status: 'error', error: errorMessage(err) } });
      }
    },

    loadSummary: async () => {
      set({ summary: { status: 'loading' } });
      try {
        set({ summary: { status: 'success', data: await postSummary(get().locale) } });
      } catch (err) {
        set({ summary: { status: 'error', error: errorMessage(err) } });
      }
    },

    sendMessage: async (mode, text) => {
      const content = text.trim();
      const { status } = get().chats[mode];
      if (!content || status === 'waiting' || status === 'streaming') return;
      patchChat(mode, (chat) => ({
        ...chat,
        // Drop an interrupted partial reply: the new question supersedes it.
        messages: [...chat.messages.filter((m) => !m.interrupted), { id: nextId(), role: 'user', content }],
      }));
      await run(mode);
    },

    retry: async (mode) => {
      patchChat(mode, (chat) => ({ ...chat, messages: chat.messages.filter((m) => !m.interrupted) }));
      const last = get().chats[mode].messages.at(-1);
      if (last?.role === 'user') await run(mode);
    },
  };
});

/** Test helper: restore initial state and cancel in-flight streams. */
export function resetAssistantStore() {
  for (const c of Object.values(controllers)) c?.abort();
  useAssistant.setState(initialState());
}

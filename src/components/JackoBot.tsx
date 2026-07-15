"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Send, X } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import {
  jackoContextHasData,
  type JackoAppContext,
} from "@/lib/jackoContext";
import type { Language } from "@/lib/translations";
import type { PlanTier } from "@/lib/appSettings";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  language: Language;
  planTier: PlanTier;
  email?: string | null;
  context?: JackoAppContext | null;
  labels: {
    title: string;
    subtitle: string;
    placeholder: string;
    send: string;
    thinking: string;
    intro: string;
    close: string;
    error: string;
    contextReady?: string;
    quickReview?: string;
    quickFertilize?: string;
    quickPriorities?: string;
    quickCreator?: string;
    quickMission?: string;
  };
};

export default function JackoBot({
  open,
  onClose,
  language,
  planTier,
  email,
  context = null,
  labels,
}: Props) {
  const presence = useAnimatedPresence(open, 220);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasLiveData = jackoContextHasData(context);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, busy, open]);

  async function sendMessage(event?: React.FormEvent, preset?: string) {
    event?.preventDefault();
    const content = (preset ?? draft).trim();
    if (!content || busy) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    if (!preset) setDraft("");
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/jacko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          language,
          planTier,
          email: email || null,
          context: context || null,
        }),
      });
      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || labels.error);
      }
      setMessages([
        ...nextMessages,
        { role: "assistant", content: payload.reply || labels.error },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setBusy(false);
    }
  }

  if (!presence.mounted || typeof document === "undefined") return null;

  const quickPrompts = [
    labels.quickCreator,
    labels.quickMission,
    ...(hasLiveData
      ? [labels.quickReview, labels.quickPriorities, labels.quickFertilize]
      : []),
  ].filter(Boolean) as string[];

  return createPortal(
    <div className="jacko-overlay">
      <button
        type="button"
        aria-label={labels.close}
        className={`absolute inset-0 bg-black/35 ${
          presence.leaving ? "animate-fade-out" : "animate-fade-in"
        }`}
        onClick={onClose}
      />
      <section
        className={`jacko-panel absolute bottom-0 right-0 flex h-[min(34rem,92dvh)] w-full max-w-md flex-col sm:bottom-4 sm:right-4 sm:rounded-2xl ${
          presence.leaving ? "animate-slide-up-out" : "animate-slide-up-in"
        }`}
        role="dialog"
        aria-label={labels.title}
      >
        <header className="flex items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="jacko-avatar grid h-9 w-9 place-items-center rounded-xl">
              <Bot size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold dark-text-primary">
                {labels.title}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {hasLiveData && labels.contextReady
                  ? labels.contextReady
                  : labels.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="app-header__icon-btn h-8 w-8 grid place-items-center rounded-xl"
          >
            <X size={16} />
          </button>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        >
          {messages.length === 0 ? (
            <>
              <div className="jacko-bubble jacko-bubble--assistant">
                {labels.intro}
              </div>
              {quickPrompts.length > 0 ? (
                <div className="jacko-quick-row">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="jacko-quick-chip"
                      disabled={busy}
                      onClick={() => void sendMessage(undefined, prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`jacko-bubble ${
                message.role === "user"
                  ? "jacko-bubble--user"
                  : "jacko-bubble--assistant"
              }`}
            >
              {message.content}
            </div>
          ))}
          {busy ? (
            <div className="jacko-bubble jacko-bubble--assistant opacity-80">
              {labels.thinking}
            </div>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}
        </div>

        <form
          className="flex items-end gap-2 border-t border-black/8 px-3 py-3"
          onSubmit={(event) => void sendMessage(event)}
        >
          <textarea
            ref={inputRef}
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={labels.placeholder}
            className="calc-field-input jacko-composer max-h-28 min-h-[2.75rem] flex-1 resize-none text-sm"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label={labels.send}
            className="plan-btn-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      </section>
    </div>,
    document.body
  );
}

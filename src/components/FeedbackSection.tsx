"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { MessageCircleHeart, Send, Star } from "lucide-react";
import type { Translation } from "@/lib/translations";

type PublicComment = {
  id: string;
  name: string | null;
  country: string | null;
  message: string;
  rating: number | null;
  created_at: string;
};

type Props = {
  t: Translation;
  language: string;
  session: Session | null;
  country?: string;
};

export default function FeedbackSection({ t, language, session, country }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [comments, setComments] = useState<PublicComment[]>([]);

  useEffect(() => {
    void fetch("/api/feedback")
      .then((response) => response.json())
      .then((payload: { comments?: PublicComment[] }) => {
        setComments(payload.comments || []);
      })
      .catch(() => setComments([]));
  }, [status]);

  useEffect(() => {
    if (!session?.user) return;
    const meta = session.user.user_metadata as Record<string, unknown>;
    const metaName =
      typeof meta.full_name === "string"
        ? meta.full_name
        : [meta.first_name, meta.last_name].filter(Boolean).join(" ");
    if (metaName && !name) setName(metaName);
    if (session.user.email && !email) setEmail(session.user.email);
  }, [session, name, email]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          country: country?.trim() || null,
          message: message.trim(),
          rating,
          language,
          userId: session?.user?.id || null,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setErrorMessage(payload.error || t.feedbackError);
        return;
      }

      setStatus("success");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMessage(t.feedbackError);
    }
  }

  return (
    <div className="feedback-flow">
      <header className="feedback-hero">
        <span className="feedback-hero__icon" aria-hidden>
          <MessageCircleHeart size={20} />
        </span>
        <div className="feedback-hero__copy">
          <h2 className="feedback-hero__title">{t.feedbackTab}</h2>
          <p className="feedback-hero__desc">{t.feedbackDesc}</p>
        </div>
      </header>

      <form className="feedback-card" onSubmit={handleSubmit}>
        <div className="feedback-card__grid">
          <label className="feedback-field">
            <span>{t.featureRequestName}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>

          <label className="feedback-field">
            <span>{t.featureRequestEmail}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
        </div>

        <div className="feedback-field feedback-field--rating">
          <div className="feedback-rating__head">
            <span>{t.feedbackRating}</span>
            <em aria-live="polite">{rating}/5</em>
          </div>
          <div className="feedback-rating" role="group" aria-label={t.feedbackRating}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`feedback-rating__star${rating >= value ? " is-active" : ""}`}
                aria-label={`${value}`}
                aria-pressed={rating >= value}
              >
                <Star size={18} fill={rating >= value ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>

        <label className="feedback-field">
          <span>{t.feedbackMessage}</span>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.feedbackPlaceholder}
          />
        </label>

        {status === "success" ? (
          <p className="feedback-status feedback-status--ok">{t.feedbackSuccess}</p>
        ) : null}
        {status === "error" ? (
          <p className="feedback-status feedback-status--err">{errorMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={status === "sending"}
          className="feedback-submit"
        >
          <Send size={15} aria-hidden />
          {status === "sending" ? t.feedbackSending : t.feedbackSubmit}
        </button>
      </form>

      {comments.length > 0 ? (
        <section className="feedback-recent" aria-label={t.feedbackRecent}>
          <h3 className="feedback-recent__title">{t.feedbackRecent}</h3>
          <ul className="feedback-comments">
            {comments.map((comment) => (
              <li key={comment.id} className="feedback-comment">
                <div className="feedback-comment__meta">
                  <strong>{comment.name || t.feedbackAnonymous}</strong>
                  {comment.country ? <span>{comment.country}</span> : null}
                  {typeof comment.rating === "number" && comment.rating > 0 ? (
                    <span className="feedback-comment__stars" aria-label={`${comment.rating}/5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={11}
                          fill={i < comment.rating! ? "currentColor" : "none"}
                          aria-hidden
                        />
                      ))}
                    </span>
                  ) : null}
                </div>
                <p className="feedback-comment__body">{comment.message}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

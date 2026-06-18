"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Send, Star } from "lucide-react";
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
    <div className="about-flat-section">
      <p className="about-flat-lead">{t.feedbackDesc}</p>

      <form className="about-flat-form about-flat-form-frame" onSubmit={handleSubmit}>
        <label className="about-flat-field">
          <span>{t.featureRequestName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="about-flat-field">
          <span>{t.featureRequestEmail}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <div className="about-flat-field about-flat-field--rating">
          <span>{t.feedbackRating}</span>
          <div className="about-flat-rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`about-flat-rating-star ${
                  rating >= value ? "is-active" : ""
                }`}
                aria-label={`${value}`}
              >
                <Star size={14} fill={rating >= value ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>

        <label className="about-flat-field">
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
          <p className="about-flat-banner about-flat-banner--success">{t.feedbackSuccess}</p>
        ) : null}
        {status === "error" ? (
          <p className="about-flat-banner about-flat-banner--error">{errorMessage}</p>
        ) : null}

        <button type="submit" disabled={status === "sending"} className="about-flat-btn">
          <Send size={16} />
          {status === "sending" ? t.feedbackSending : t.feedbackSubmit}
        </button>
      </form>

      {comments.length > 0 ? (
        <div className="about-flat-section-group">
          <h3 className="about-flat-subtitle">{t.feedbackRecent}</h3>
          <ul className="about-flat-list about-flat-comment-list about-flat-section-list">
            {comments.map((comment) => (
              <li key={comment.id} className="about-flat-comment-item">
                <p className="about-flat-comment-author">
                  {comment.name || t.feedbackAnonymous}
                  {comment.country ? ` · ${comment.country}` : ""}
                </p>
                <p className="about-flat-comment-body">{comment.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

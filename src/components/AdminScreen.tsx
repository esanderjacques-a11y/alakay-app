"use client";

import { useEffect, useState } from "react";
import { Shield, Star, Trash2 } from "lucide-react";

import BackButton from "@/components/ui/BackButton";
import type { Translation } from "@/lib/translations";

type FeedbackItem = {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  message: string;
  rating: number | null;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
};

type Props = {
  t: Translation;
  adminEmail: string;
  onBack: () => void;
};

export default function AdminScreen({ t, adminEmail, onBack }: Props) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadItems() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, action: "list" }),
      });
      const payload = (await response.json()) as {
        items?: FeedbackItem[];
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error || t.adminError);
        setItems([]);
        return;
      }
      setItems(payload.items || []);
    } catch {
      setMessage(t.adminError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [adminEmail]);

  async function runAction(
    action: "feature" | "approve" | "delete",
    id: string,
    extra?: Record<string, boolean>
  ) {
    const response = await fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, action, id, ...extra }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error || t.adminError);
      return;
    }
    void loadItems();
  }

  return (
    <section className="animate-slide-up">
      <div className="about-flat-panel">
        <div className="page-title-row">
          <BackButton variant="icon" onClick={onBack} label={t.home} />
          <div className="page-title-row__title flex min-w-0 items-center gap-2">
            <Shield size={20} className="shrink-0 text-emerald-700" aria-hidden="true" />
            <h1 className="about-flat-title !mt-0">
              {t.adminTitle}
            </h1>
          </div>
          <span className="page-title-row__spacer" aria-hidden="true" />
        </div>
        <p className="about-flat-lead mt-1">{t.adminDesc}</p>

        {message ? <p className="about-flat-banner about-flat-banner--error mt-3">{message}</p> : null}

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">{t.loadingApp}</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200/80">
            {items.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-green-950">
                      {item.name || t.feedbackAnonymous}
                      {item.country ? ` · ${item.country}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                      {item.rating ? ` · ${item.rating}/5` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        runAction("feature", item.id, { featured: !item.is_featured })
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                        item.is_featured
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Star size={12} />
                      {item.is_featured ? t.adminFeatured : t.adminFeature}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction("approve", item.id, { approved: !item.is_approved })
                      }
                      className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                    >
                      {item.is_approved ? t.adminHide : t.adminShow}
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction("delete", item.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700"
                    >
                      <Trash2 size={12} />
                      {t.adminDelete}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

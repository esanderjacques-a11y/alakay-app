"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, ImagePlus, ShieldCheck, UserRound } from "lucide-react";

import { accountSettingsText } from "@/lib/i18n/componentText";
import { normalizeAuthEmail } from "@/lib/email";
import { supabase } from "@/lib/supabase";
import type { Language } from "@/lib/translations";

type Props = {
  language: Language;
  session: Session | null;
};

export default function AccountSettingsSection({ language, session }: Props) {
  const text =
    accountSettingsText[language as keyof typeof accountSettingsText] ||
    accountSettingsText.en;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session?.user) return;

    const meta = session.user.user_metadata || {};
    const metaName =
      typeof meta.full_name === "string"
        ? meta.full_name
        : [meta.first_name, meta.last_name].filter(Boolean).join(" ");
    const metaAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url : "";
    const userId = session.user.id;
    const userEmail = session.user.email || "";

    async function loadProfile() {
      setEmail(userEmail);
      setAvatarUrl(metaAvatar);

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();

      setFullName(data?.full_name || metaName || "");
    }

    void loadProfile();
  }, [session]);

  async function saveAccount() {
    if (!session?.user) return;

    if (password && password !== confirmPassword) {
      setMessage(text.passwordMismatch);
      return;
    }

    if (password && password.length < 8) {
      setMessage(text.passwordTooShort);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const authUpdates: { email?: string; password?: string } = {};
      const trimmedEmail = normalizeAuthEmail(email);

      if (trimmedEmail && trimmedEmail !== session.user.email) {
        authUpdates.email = trimmedEmail;
      }

      if (password) {
        authUpdates.password = password;
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates);
        if (authError) throw authError;
      }

      const trimmedName = fullName.trim();
      const authData: Record<string, string> = {};

      if (trimmedName) {
        authData.full_name = trimmedName;
        const profilePayload = {
          user_id: session.user.id,
          full_name: trimmedName,
          avatar_url: avatarUrl || null,
        };

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(profilePayload);

        if (profileError && /avatar_url|column|schema/i.test(profileError.message)) {
          const { error: fallbackProfileError } = await supabase.from("profiles").upsert({
            user_id: session.user.id,
            full_name: trimmedName,
          });

          if (fallbackProfileError) throw fallbackProfileError;
        } else if (profileError) {
          throw profileError;
        }
      }

      if (avatarUrl) {
        authData.avatar_url = avatarUrl;
      }

      if (Object.keys(authData).length > 0) {
        await supabase.auth.updateUser({ data: authData });
      }

      setPassword("");
      setConfirmPassword("");
      setMessage(
        authUpdates.email ? text.savedEmailConfirmation : text.saved
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  if (!session?.user) {
    return (
      <section className="rounded-2xl border border-white/70 bg-white/55 p-4 text-sm text-slate-600">
        {text.loginRequired}
      </section>
    );
  }

  if (!editing) {
    return (
      <section className="rounded-2xl border border-white/70 bg-white/55 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-white/80 bg-white/80 shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={24} className="text-green-800" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-green-950">
                {text.accountInformation}
              </p>
              <p className="truncate text-sm text-slate-600">
                {fullName || session.user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-2xl border border-green-200 bg-white/72 px-3 py-2 text-sm font-extrabold text-green-900 shadow-sm hover:bg-green-50"
          >
            {text.manageAccount}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-white/70 bg-white/55 p-4">
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-sm font-bold text-green-900"
      >
        <ArrowLeft size={16} />
        {text.backToSettings}
      </button>
      <div className="flex items-center gap-2 text-sm font-extrabold text-green-950">
        <UserRound size={18} />
        {text.accountInformation}
      </div>
      <p className="text-xs text-slate-600">{text.desc}</p>

      <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-white/80 bg-white/88 shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound size={34} className="text-green-800" />
            )}
          </div>
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-2xl border border-green-200 bg-white/76 px-4 py-3 text-sm font-extrabold text-green-900 shadow-sm hover:bg-green-50">
            <ImagePlus size={17} />
            {text.profilePhoto}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => handlePhotoChange(event.target.files?.[0])}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">{text.photoHelp}</p>
      </div>

      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        {text.fullName}
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="min-h-11 rounded-2xl border border-green-100 bg-white/82 px-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        {text.email}
        <input
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 rounded-2xl border border-green-100 bg-white/82 px-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        {text.newPassword}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={text.passwordOptional}
          className="min-h-11 rounded-2xl border border-green-100 bg-white/82 px-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        {text.confirmPassword}
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="min-h-11 rounded-2xl border border-green-100 bg-white/82 px-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
        />
      </label>

      <p className="inline-flex items-center gap-2 rounded-2xl bg-white/58 px-3 py-2 text-xs font-semibold text-slate-600">
        <ShieldCheck size={15} className="text-green-800" />
        {text.security}
      </p>

      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={saveAccount}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-green-700 px-4 text-sm font-extrabold text-white transition hover:bg-green-800 disabled:opacity-60"
      >
        {loading ? text.saving : text.save}
      </button>
    </section>
  );
}

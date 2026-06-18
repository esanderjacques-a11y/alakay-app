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

const AVATAR_STORAGE_PREFIX = "alakay_profile_avatar_";

type CropSettings = {
  zoom: number;
  x: number;
  y: number;
};

function getAvatarStorageKey(userId: string) {
  return `${AVATAR_STORAGE_PREFIX}${userId}`;
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Image could not be read."));
    };
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

async function cropAndCompressAvatar(
  src: string,
  crop: CropSettings,
  outputSize = 128
) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image could not be processed.");

  canvas.width = outputSize;
  canvas.height = outputSize;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);

  const baseScale =
    Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight) *
    crop.zoom;
  const drawWidth = image.naturalWidth * baseScale;
  const drawHeight = image.naturalHeight * baseScale;
  const maxPanX = Math.max(0, (drawWidth - outputSize) / 2);
  const maxPanY = Math.max(0, (drawHeight - outputSize) / 2);
  const dx = (outputSize - drawWidth) / 2 + (crop.x / 100) * maxPanX;
  const dy = (outputSize - drawHeight) / 2 + (crop.y / 100) * maxPanY;

  context.drawImage(image, dx, dy, drawWidth, drawHeight);

  return canvas.toDataURL("image/webp", 0.55);
}

export default function AccountSettingsSection({ language, session }: Props) {
  const text =
    accountSettingsText[language as keyof typeof accountSettingsText] ||
    accountSettingsText.en;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState("");
  const [cropSettings, setCropSettings] = useState<CropSettings>({
    zoom: 1,
    x: 0,
    y: 0,
  });

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
      const cachedAvatar = localStorage.getItem(getAvatarStorageKey(userId)) || "";

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      const profileAvatar =
        !error &&
        data &&
        "avatar_url" in data &&
        typeof data.avatar_url === "string"
          ? data.avatar_url
          : "";

      setAvatarUrl(profileAvatar || cachedAvatar || metaAvatar);
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

    if (password && !currentPassword) {
      setMessage(text.currentPasswordRequired);
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
      let avatarSyncSkipped = false;
      const trimmedEmail = normalizeAuthEmail(email);

      if (trimmedEmail && trimmedEmail !== session.user.email) {
        authUpdates.email = trimmedEmail;
      }

      if (password) {
        const { error: passwordError } = await supabase.auth.signInWithPassword({
          email: session.user.email || trimmedEmail,
          password: currentPassword,
        });
        if (passwordError) throw passwordError;
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
      }

      const profilePayload = {
        user_id: session.user.id,
        full_name: trimmedName || null,
        avatar_url: avatarUrl || null,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload);

      if (profileError && /avatar_url|column|schema/i.test(profileError.message)) {
        const { error: fallbackProfileError } = await supabase
          .from("profiles")
          .upsert({
            user_id: session.user.id,
            full_name: trimmedName || null,
          });

        if (fallbackProfileError) throw fallbackProfileError;
        avatarSyncSkipped = Boolean(avatarUrl);
      } else if (profileError) {
        throw profileError;
      }

      localStorage.setItem(getAvatarStorageKey(session.user.id), avatarUrl);

      if (Object.keys(authData).length > 0) {
        await supabase.auth.updateUser({ data: authData });
      }

      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setMessage(
        avatarSyncSkipped
          ? text.avatarColumnMissing
          : authUpdates.email
            ? text.savedEmailConfirmation
            : text.saved
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoChange(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setCropSettings({ zoom: 1, x: 0, y: 0 });
      setPendingAvatar(await readImageFile(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.saveFailed);
    }
  }

  async function applyAvatarCrop() {
    if (!pendingAvatar) return;
    try {
      const nextAvatar = await cropAndCompressAvatar(pendingAvatar, cropSettings);
      setAvatarUrl(nextAvatar);
      if (session?.user) {
        localStorage.setItem(getAvatarStorageKey(session.user.id), nextAvatar);
      }
      setPendingAvatar("");
      setMessage(text.photoReady);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.saveFailed);
    }
  }

  if (!session?.user) {
    return (
      <section className="border-b border-[rgba(0,0,0,0.06)] py-4 text-sm text-slate-600">
        {text.loginRequired}
      </section>
    );
  }

  if (!editing) {
    return (
      <section className="settings-account-summary">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-white/80 bg-white/80 shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={24} className="text-green-800" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1c1c1e] dark:text-[#e8e8e8]">
                {text.accountInformation}
              </p>
              <p className="truncate text-xs text-slate-500">
                {fullName || session.user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-full border border-[rgba(0,0,0,0.08)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-800,#166534)] shadow-sm hover:bg-white"
          >
            {text.manageAccount}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 border-b border-[rgba(0,0,0,0.06)] py-4">
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

      {pendingAvatar ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-md">
          <section className="glass-modal-shell w-full max-w-sm rounded-3xl p-4">
            <p className="text-sm font-extrabold text-green-950">
              {text.cropPhoto}
            </p>
            <div className="mx-auto mt-4 grid h-48 w-48 place-items-center overflow-hidden rounded-full border border-green-200 bg-white shadow-inner">
              <img
                src={pendingAvatar}
                alt=""
                className="h-full w-full object-cover"
                style={{
                  transform: `translate(${cropSettings.x / 3}%, ${
                    cropSettings.y / 3
                  }%) scale(${cropSettings.zoom})`,
                }}
              />
            </div>
            <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-700">
              <label className="grid gap-1">
                {text.zoom}
                <input
                  type="range"
                  min="1"
                  max="2.4"
                  step="0.05"
                  value={cropSettings.zoom}
                  onChange={(event) =>
                    setCropSettings((current) => ({
                      ...current,
                      zoom: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="grid gap-1">
                {text.horizontalPosition}
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={cropSettings.x}
                  onChange={(event) =>
                    setCropSettings((current) => ({
                      ...current,
                      x: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="grid gap-1">
                {text.verticalPosition}
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={cropSettings.y}
                  onChange={(event) =>
                    setCropSettings((current) => ({
                      ...current,
                      y: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingAvatar("")}
                className="min-h-11 rounded-2xl border border-green-200 bg-white/80 text-sm font-extrabold text-green-900"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={applyAvatarCrop}
                className="min-h-11 rounded-2xl bg-green-700 text-sm font-extrabold text-white"
              >
                {text.usePhoto}
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
        {text.currentPassword}
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          className="min-h-11 rounded-2xl border border-green-100 bg-white/82 px-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        {text.newPassword}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
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
          autoComplete="new-password"
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

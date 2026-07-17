"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  BadgeCheck,
  Camera,
  ImagePlus,
  Lock,
  Mail,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";

import AppModal from "@/components/AppModal";
import MenuSelect from "@/components/ui/MenuSelect";
import { accountSettingsText } from "@/lib/i18n/componentText";
import { countries } from "@/lib/countries";
import { normalizeAuthEmail } from "@/lib/email";
import { PROFILE_PROFESSIONS } from "@/lib/profileProfessions";
import { supabase } from "@/lib/supabase";
import type { Language } from "@/lib/translations";

type Props = {
  language: Language;
  session: Session | null;
};

type AccountTab = "profile" | "security" | "activity";

type CropSettings = {
  zoom: number;
  x: number;
  y: number;
};

const AVATAR_STORAGE_PREFIX = "cultosol_profile_avatar_";

function buildPresetAvatar(background: string, symbol: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="${background}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="56">${symbol}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PRESET_AVATARS = [
  { id: "sprout", symbol: "🌱", bg: "#dcfce7" },
  { id: "wheat", symbol: "🌾", bg: "#fef3c7" },
  { id: "coffee", symbol: "☕", bg: "#ede9fe" },
  { id: "banana", symbol: "🍌", bg: "#fef9c3" },
  { id: "tomato", symbol: "🍅", bg: "#fee2e2" },
  { id: "corn", symbol: "🌽", bg: "#ffedd5" },
  { id: "leaf", symbol: "🍃", bg: "#d1fae5" },
  { id: "sun", symbol: "☀️", bg: "#fef08a" },
] as const;

const PROFILE_SELECT =
  "full_name, avatar_url, first_name, last_name, middle_name, profession, country, province_state, birthday, phone, organization";

function readMetaString(meta: Record<string, unknown>, key: string) {
  return typeof meta[key] === "string" ? meta[key] : "";
}

function buildFullName(firstName: string, middleName: string, lastName: string) {
  const first = firstName.trim();
  const middle = middleName.trim();
  const last = lastName.trim();
  if (!first && !last) return "";
  return `${first}${middle ? ` ${middle}` : ""}${last ? ` ${last}` : ""}`.trim();
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function resolveCountryFields(value: string) {
  if (!value) return { country: "", customCountry: "" };
  if (countries.includes(value)) return { country: value, customCountry: "" };
  return { country: "Other", customCountry: value };
}

function normalizeBirthday(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

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

function passwordStrengthScore(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function maskUserId(userId: string) {
  if (userId.length <= 10) return userId;
  return `${userId.slice(0, 6)}…${userId.slice(-4)}`;
}

export default function AccountSettingsSection({ language, session }: Props) {
  const text = {
    ...accountSettingsText.en,
    ...(accountSettingsText[language as keyof typeof accountSettingsText] ||
      accountSettingsText.en),
  };

  const [tab, setTab] = useState<AccountTab>("profile");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [profession, setProfession] = useState("");
  const [country, setCountry] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [provinceState, setProvinceState] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState("");
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [cropSettings, setCropSettings] = useState<CropSettings>({
    zoom: 1,
    x: 0,
    y: 0,
  });
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const locale = language === "es" ? "es" : language === "fr" ? "fr" : "en";
  const strength = passwordStrengthScore(password);
  const strengthLabel =
    strength <= 1
      ? text.strengthWeak
      : strength === 2
        ? text.strengthFair
        : strength === 3
          ? text.strengthGood
          : text.strengthStrong;

  const emailVerified = Boolean(session?.user?.email_confirmed_at);
  const provider =
    session?.user?.app_metadata?.provider ||
    session?.user?.identities?.[0]?.provider ||
    "email";

  const displayName =
    buildFullName(firstName, middleName, lastName) ||
    session?.user?.email ||
    "";

  useEffect(() => {
    if (!session?.user) return;

    const meta = session.user.user_metadata || {};
    const metaName =
      typeof meta.full_name === "string"
        ? meta.full_name
        : buildFullName(
            readMetaString(meta, "first_name"),
            readMetaString(meta, "middle_name"),
            readMetaString(meta, "last_name")
          );
    const metaAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url : "";
    const userId = session.user.id;
    const userEmail = session.user.email || "";

    async function loadProfile() {
      setEmail(userEmail);
      const cachedAvatar = localStorage.getItem(getAvatarStorageKey(userId)) || "";

      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", userId)
        .maybeSingle();

      let profile: Record<string, unknown> | null = data;

      if (error && /column|schema/i.test(error.message)) {
        const { data: basicProfile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("user_id", userId)
          .maybeSingle();
        profile = basicProfile as Record<string, unknown> | null;
      }

      const profileAvatar =
        profile &&
        "avatar_url" in profile &&
        typeof profile.avatar_url === "string"
          ? profile.avatar_url
          : "";

      setAvatarUrl(profileAvatar || cachedAvatar || metaAvatar);

      const loadedFirst =
        (profile &&
          "first_name" in profile &&
          typeof profile.first_name === "string" &&
          profile.first_name) ||
        readMetaString(meta, "first_name");
      const loadedMiddle =
        (profile &&
          "middle_name" in profile &&
          typeof profile.middle_name === "string" &&
          profile.middle_name) ||
        readMetaString(meta, "middle_name");
      const loadedLast =
        (profile &&
          "last_name" in profile &&
          typeof profile.last_name === "string" &&
          profile.last_name) ||
        readMetaString(meta, "last_name");

      if (loadedFirst || loadedLast) {
        setFirstName(loadedFirst || "");
        setMiddleName(loadedMiddle || "");
        setLastName(loadedLast || "");
      } else {
        const split = splitFullName(
          (typeof profile?.full_name === "string" ? profile.full_name : "") || metaName || ""
        );
        setFirstName(split.firstName);
        setMiddleName(split.middleName);
        setLastName(split.lastName);
      }

      const loadedCountry =
        (profile &&
          "country" in profile &&
          typeof profile.country === "string" &&
          profile.country) ||
        readMetaString(meta, "country");
      const countryFields = resolveCountryFields(loadedCountry || "");
      setCountry(countryFields.country);
      setCustomCountry(countryFields.customCountry);

      setProfession(
        (profile &&
          "profession" in profile &&
          typeof profile.profession === "string" &&
          profile.profession) ||
          readMetaString(meta, "profession") ||
          ""
      );
      setProvinceState(
        (profile &&
          "province_state" in profile &&
          typeof profile.province_state === "string" &&
          profile.province_state) ||
          readMetaString(meta, "province_state") ||
          ""
      );
      setBirthday(
        normalizeBirthday(
          (profile &&
            "birthday" in profile &&
            typeof profile.birthday === "string" &&
            profile.birthday) ||
            readMetaString(meta, "birthday")
        )
      );
      setPhone(
        (profile &&
          "phone" in profile &&
          typeof profile.phone === "string" &&
          profile.phone) ||
          readMetaString(meta, "phone") ||
          ""
      );
      setOrganization(
        (profile &&
          "organization" in profile &&
          typeof profile.organization === "string" &&
          profile.organization) ||
          readMetaString(meta, "organization") ||
          ""
      );
    }

    void loadProfile();
  }, [session]);

  async function saveAccount() {
    if (!session?.user) return;

    const trimmedFirst = firstName.trim();
    const trimmedMiddle = middleName.trim();
    const trimmedLast = lastName.trim();
    const builtFullName = buildFullName(trimmedFirst, trimmedMiddle, trimmedLast);
    const finalCountry =
      country === "Other" ? customCountry.trim() : country.trim();

    if (!trimmedFirst || !trimmedLast) {
      setMessage(text.nameRequired);
      return;
    }

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

      const trimmedName = builtFullName;
      const authData: Record<string, string | null> = {
        full_name: trimmedName || null,
        first_name: trimmedFirst || null,
        middle_name: trimmedMiddle || null,
        last_name: trimmedLast || null,
        profession: profession.trim() || null,
        country: finalCountry || null,
        province_state: provinceState.trim() || null,
        birthday: birthday || null,
        phone: phone.trim() || null,
        organization: organization.trim() || null,
      };

      const profilePayload = {
        user_id: session.user.id,
        full_name: trimmedName || null,
        first_name: trimmedFirst || null,
        middle_name: trimmedMiddle || null,
        last_name: trimmedLast || null,
        profession: profession.trim() || null,
        country: finalCountry || null,
        province_state: provinceState.trim() || null,
        birthday: birthday || null,
        phone: phone.trim() || null,
        organization: organization.trim() || null,
        avatar_url: avatarUrl || null,
        preferred_language: language,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload);

      if (profileError && /avatar_url|column|schema/i.test(profileError.message)) {
        const { error: fallbackProfileError } = await supabase.from("profiles").upsert({
          user_id: session.user.id,
          full_name: trimmedName || null,
          first_name: trimmedFirst || null,
          last_name: trimmedLast || null,
          middle_name: trimmedMiddle || null,
          profession: profession.trim() || null,
          country: finalCountry || null,
          province_state: provinceState.trim() || null,
        });

        if (fallbackProfileError) throw fallbackProfileError;
        avatarSyncSkipped = Boolean(avatarUrl);
      } else if (profileError) {
        throw profileError;
      }

      localStorage.setItem(getAvatarStorageKey(session.user.id), avatarUrl);

      await supabase.auth.updateUser({
        data: Object.fromEntries(
          Object.entries(authData).filter(([, value]) => value !== null && value !== "")
        ),
      });

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

  async function resendVerification() {
    if (!session?.user?.email) return;
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: session.user.email,
      });
      if (error) throw error;
      setMessage(text.verificationSent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoChange(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setAvatarMenuOpen(false);
      setCropSettings({ zoom: 1, x: 0, y: 0 });
      setPendingAvatar(await readImageFile(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.saveFailed);
    }
  }

  function persistAvatarLocally(nextAvatar: string) {
    setAvatarUrl(nextAvatar);
    if (session?.user) {
      localStorage.setItem(getAvatarStorageKey(session.user.id), nextAvatar);
    }
  }

  function applyPresetAvatar(preset: (typeof PRESET_AVATARS)[number]) {
    const nextAvatar = buildPresetAvatar(preset.bg, preset.symbol);
    persistAvatarLocally(nextAvatar);
    setAvatarMenuOpen(false);
    setMessage(text.photoReady);
  }

  function handleRemovePhoto() {
    removePhoto();
    setAvatarMenuOpen(false);
    setMessage(text.photoReady);
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

  function removePhoto() {
    setAvatarUrl("");
    if (session?.user) {
      localStorage.removeItem(getAvatarStorageKey(session.user.id));
    }
  }

  const tabs = useMemo(
    () =>
      [
        { id: "profile" as const, label: text.profileTab, icon: UserRound },
        { id: "security" as const, label: text.securityTab, icon: Shield },
        { id: "activity" as const, label: text.activityTab, icon: Activity },
      ] satisfies { id: AccountTab; label: string; icon: typeof UserRound }[],
    [text.activityTab, text.profileTab, text.securityTab]
  );

  if (!session?.user) {
    return (
      <section className="settings-account-empty">
        <UserRound size={28} aria-hidden />
        <p>{text.loginRequired}</p>
      </section>
    );
  }

  return (
    <section className="settings-account-hub">
      <header className="settings-account-hero">
        <div className="settings-account-hero__profile">
          <button
            type="button"
            className="settings-account-hero__avatar settings-account-hero__avatar--editable"
            onClick={() => setAvatarMenuOpen(true)}
            aria-label={text.editPhoto}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound size={32} aria-hidden />
            )}
            <span className="settings-account-hero__avatar-edit" aria-hidden>
              <ImagePlus size={14} />
            </span>
          </button>
          <div className="settings-account-hero__copy">
            <h2 className="settings-account-hero__name">
              {displayName}
            </h2>
            <p className="settings-account-hero__email">{session.user.email}</p>
            <div className="settings-account-badges">
              <span
                className={`settings-account-badge ${emailVerified ? "is-verified" : "is-pending"}`}
              >
                {emailVerified ? (
                  <BadgeCheck size={13} aria-hidden />
                ) : (
                  <Mail size={13} aria-hidden />
                )}
                {emailVerified ? text.emailVerified : text.emailNotVerified}
              </span>
              <span className="settings-account-badge is-neutral">
                <Lock size={13} aria-hidden />
                {text.passwordProtected}
              </span>
            </div>
          </div>
        </div>
      </header>

      <nav className="settings-account-tabs" aria-label={text.accountInformation}>
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`settings-account-tabs__btn ${tab === item.id ? "is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={15} aria-hidden className="shrink-0" />
              <span className="settings-account-tabs__label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {tab === "profile" ? (
        <div className="settings-account-panel">
          <h3 className="settings-account-panel__title">{text.personalInfoTitle}</h3>
          <p className="settings-account-hint">{text.profileDesc}</p>

          <div className="settings-account-form-grid">
            <label className="settings-account-field">
              <span>{text.firstName}</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </label>
            <label className="settings-account-field">
              <span>{text.lastName}</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </label>
            <label className="settings-account-field settings-account-field--full">
              <span>
                {text.middleName}{" "}
                <span className="settings-account-field__optional">({text.optional})</span>
              </span>
              <input
                value={middleName}
                onChange={(event) => setMiddleName(event.target.value)}
                autoComplete="additional-name"
              />
            </label>
            <label className="settings-account-field settings-account-field--full">
              <span>{text.email}</span>
              <input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="settings-account-field">
              <span>
                {text.birthday}{" "}
                <span className="settings-account-field__optional">({text.optional})</span>
              </span>
              <input
                type="date"
                value={birthday}
                onChange={(event) => setBirthday(event.target.value)}
              />
            </label>
            <label className="settings-account-field">
              <span>
                {text.phone}{" "}
                <span className="settings-account-field__optional">({text.optional})</span>
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label className="settings-account-field">
              <span>{text.profession}</span>
              <MenuSelect
                value={profession}
                onChange={setProfession}
                variant="field"
                fullWidth
                heading={text.profession}
                placeholder={text.profession}
                triggerClassName="settings-menu-select-trigger"
                options={[
                  { value: "", label: text.profession },
                  ...PROFILE_PROFESSIONS.map((item) => ({
                    value: item,
                    label: item,
                  })),
                ]}
              />
            </label>
            <label className="settings-account-field">
              <span>
                {text.organization}{" "}
                <span className="settings-account-field__optional">({text.optional})</span>
              </span>
              <input
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                autoComplete="organization"
              />
            </label>
            <label className="settings-account-field">
              <span>{text.country}</span>
              <input
                list="cultosol-settings-countries"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                autoComplete="country-name"
              />
              <datalist id="cultosol-settings-countries">
                {countries.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="settings-account-field">
              <span>
                {text.provinceState}{" "}
                <span className="settings-account-field__optional">({text.optional})</span>
              </span>
              <input
                value={provinceState}
                onChange={(event) => setProvinceState(event.target.value)}
                autoComplete="address-level1"
              />
            </label>
            {country === "Other" ? (
              <label className="settings-account-field settings-account-field--full">
                <span>{text.customCountry}</span>
                <input
                  value={customCountry}
                  onChange={(event) => setCustomCountry(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "security" ? (
        <div className="settings-account-panel">
          <h3 className="settings-account-panel__title">{text.changePassword}</h3>
          <p className="settings-account-hint">{text.desc}</p>

          <div className="settings-account-form-grid">
            <label className="settings-account-field settings-account-field--full">
              <span>{text.currentPassword}</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="settings-account-field">
              <span>{text.newPassword}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={text.passwordOptional}
              />
            </label>
            <label className="settings-account-field">
              <span>{text.confirmPassword}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>

          {password ? (
            <div className="settings-password-strength">
              <div className="settings-password-strength__head">
                <span>{text.passwordStrength}</span>
                <strong>{strengthLabel}</strong>
              </div>
              <div className="settings-password-strength__bar" aria-hidden>
                <span style={{ width: `${(strength / 4) * 100}%` }} />
              </div>
            </div>
          ) : null}

          {!emailVerified ? (
            <button
              type="button"
              className="settings-account-action-btn"
              disabled={loading}
              onClick={() => void resendVerification()}
            >
              <Mail size={16} aria-hidden />
              {text.resendVerification}
            </button>
          ) : null}

          <div className="settings-security-tips">
            <h4>{text.securityTipsTitle}</h4>
            <ul>
              <li>{text.securityTip1}</li>
              <li>{text.securityTip2}</li>
              <li>{text.securityTip3}</li>
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="settings-account-panel">
          <dl className="settings-account-meta">
            <div>
              <dt>{text.memberSince}</dt>
              <dd>{formatDate(session.user.created_at, locale)}</dd>
            </div>
            <div>
              <dt>{text.lastSignIn}</dt>
              <dd>{formatDate(session.user.last_sign_in_at, locale)}</dd>
            </div>
            <div>
              <dt>{text.authProvider}</dt>
              <dd className="capitalize">{provider}</dd>
            </div>
            <div>
              <dt>{text.accountId}</dt>
              <dd className="font-mono text-xs">{maskUserId(session.user.id)}</dd>
            </div>
          </dl>

          <div className="settings-account-privacy">
            <h4>{text.dataPrivacyTitle}</h4>
            <p>{text.dataPrivacyDesc}</p>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="settings-account-message" role="status">
          {message}
        </p>
      ) : null}

      {tab !== "activity" ? (
        <button
          type="button"
          onClick={() => void saveAccount()}
          disabled={loading}
          className="settings-account-save-btn"
        >
          {loading ? text.saving : text.save}
        </button>
      ) : null}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          void handlePhotoChange(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={(event) => {
          void handlePhotoChange(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <AppModal
        open={avatarMenuOpen}
        onClose={() => setAvatarMenuOpen(false)}
        title={text.editPhotoTitle}
        closeLabel={text.cancel}
      >
        <div className="settings-avatar-menu">
          <button
            type="button"
            className="settings-avatar-menu__action"
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus size={18} aria-hidden />
            {text.chooseFromGallery}
          </button>
          <button
            type="button"
            className="settings-avatar-menu__action"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera size={18} aria-hidden />
            {text.takePhoto}
          </button>
          {avatarUrl ? (
            <button
              type="button"
              className="settings-avatar-menu__action settings-avatar-menu__action--danger"
              onClick={handleRemovePhoto}
            >
              <Trash2 size={18} aria-hidden />
              {text.removePhoto}
            </button>
          ) : null}

          <div className="settings-avatar-menu__presets">
            <p className="settings-avatar-menu__presets-label">{text.chooseAvatar}</p>
            <div className="settings-avatar-menu__grid" role="list">
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="listitem"
                  className="settings-avatar-menu__preset"
                  onClick={() => applyPresetAvatar(preset)}
                  aria-label={text.chooseAvatar}
                >
                  <img
                    src={buildPresetAvatar(preset.bg, preset.symbol)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </AppModal>

      {pendingAvatar ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-md">
          <section className="glass-modal-shell w-full max-w-sm rounded-3xl p-4">
            <p className="text-sm font-extrabold text-green-950 dark:text-green-100">
              {text.cropPhoto}
            </p>
            <div className="mx-auto mt-4 grid h-48 w-48 place-items-center overflow-hidden rounded-full border border-green-200 bg-white shadow-inner">
              <img
                src={pendingAvatar}
                alt=""
                className="h-full w-full object-cover"
                style={{
                  transform: `translate(${cropSettings.x / 3}%, ${cropSettings.y / 3}%) scale(${cropSettings.zoom})`,
                }}
              />
            </div>
            <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
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
                className="min-h-11 rounded-2xl border border-green-200 bg-white/80 text-sm font-extrabold text-green-900 dark:bg-white/10 dark:text-green-100"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => void applyAvatarCrop()}
                className="min-h-11 rounded-2xl bg-green-700 text-sm font-extrabold text-white"
              >
                {text.usePhoto}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

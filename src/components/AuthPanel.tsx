"use client";

import { useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Eye, EyeOff, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { countries } from "@/lib/countries";
import { normalizeAuthEmail } from "@/lib/email";
import { Language, Translation } from "@/lib/translations";
import { authPanelText } from "@/lib/i18n/componentText";

type AuthPanelText = (typeof authPanelText)[keyof typeof authPanelText];

type Props = {
  t: Translation;
  language: Language;
  activeSession: Session | null;
  activeDisplayName: string;
  onAuthSuccess: () => void;
  onContinueAsGuest: () => void;
  onResumeSession: () => void;
};


const professions = [
  "Farmer",
  "Student",
  "Researcher",
  "Agronomist",
  "Extension agent",
  "Technician",
  "Consultant",
  "Other",
];

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function getPasswordStrength(password: string, text: AuthPanelText) {
  const checks = getPasswordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;

  if (!password) {
    return {
      label: text.empty,
      bar: "w-0 bg-slate-200",
      text: "text-slate-500",
    };
  }

  if (score <= 2) {
    return {
      label: text.weak,
      bar: "w-1/3 bg-red-500",
      text: "text-red-700",
    };
  }

  if (score === 3 || score === 4) {
    return {
      label: text.medium,
      bar: "w-2/3 bg-yellow-500",
      text: "text-yellow-700",
    };
  }

  return {
    label: text.strong,
    bar: "w-full bg-green-600",
    text: "text-green-700",
  };
}

function isStrongPassword(password: string) {
  const checks = getPasswordChecks(password);

  return (
    checks.minLength &&
    checks.uppercase &&
    checks.lowercase &&
    checks.number
  );
}

function Requirement({
  passed,
  label,
}: {
  passed: boolean;
  label: string;
}) {
  return (
    <li
      className={`flex items-center gap-2 ${
        passed ? "text-green-700" : "text-slate-500"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          passed ? "bg-green-600 text-white" : "bg-slate-200 text-slate-500"
        }`}
      >
        {passed ? "✓" : "•"}
      </span>
      {label}
    </li>
  );
}

void Requirement;

export default function AuthPanel({
  t,
  language,
  activeSession,
  activeDisplayName,
  onAuthSuccess,
  onContinueAsGuest,
  onResumeSession,
}: Props) {
  const text = authPanelText[language as keyof typeof authPanelText] || authPanelText.en;

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [profession, setProfession] = useState("");

  const [country, setCountry] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [provinceState, setProvinceState] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [acceptEmails, setAcceptEmails] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loginFailures, setLoginFailures] = useState(0);

  const finalCountry = country === "Other" ? customCountry.trim() : country;

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordStrength = useMemo(
    () => getPasswordStrength(password, text),
    [password, text]
  );

  function validateSignup() {
    const authEmail = normalizeAuthEmail(email);
    if (!firstName.trim()) return text.firstNameRequired;
    if (!lastName.trim()) return text.lastNameRequired;
    if (!profession.trim()) return text.professionRequired;
    if (!finalCountry.trim()) return text.countryRequired;
    if (!authEmail) return text.emailRequired;
    if (!password) return text.passwordRequired;
    if (!repeatPassword) return text.repeatPasswordRequired;

    if (password !== repeatPassword) {
      return text.passwordsDontMatch;
    }

    if (!isStrongPassword(password)) {
      return text.passwordWeak;
    }

    if (!acceptPolicies) {
      return text.acceptPolicies;
    }

    return "";
  }

  async function handleAuth() {
    setMessage("");

    if (mode === "login") {
      const authEmail = normalizeAuthEmail(email);

      if (!authEmail || !password) {
        setMessage(text.enterEmailPassword);
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      setLoading(false);

      if (error) {
        setLoginFailures((previous) => previous + 1);
        setMessage(text.incorrectLogin);
        return;
      }

      setLoginFailures(0);
      onAuthSuccess();
      return;
    }

    const validationError = validateSignup();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);
    const authEmail = normalizeAuthEmail(email);

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          middle_name: middleName.trim() || null,
          profession,
          country: finalCountry,
          province_state: provinceState.trim() || null,
          location_source: "manual",
          accepts_policies: acceptPolicies,
          accepts_emails: acceptEmails,
        },
      },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      const fullName = `${firstName.trim()} ${
        middleName.trim() ? `${middleName.trim()} ` : ""
      }${lastName.trim()}`;

      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: userId,
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim() || null,
        profession,
        country: finalCountry,
        province_state: provinceState.trim() || null,
        location_source: "manual",
        accepts_policies: acceptPolicies,
        accepts_emails: acceptEmails,
        preferred_language: language,
      });

      if (profileError) {
        setLoading(false);
        setMessage(profileError.message);
        return;
      }

      const { error: settingsError } = await supabase
        .from("user_settings")
        .insert({
          user_id: userId,
          language,
          theme: "light",
        });

      if (settingsError) {
        setLoading(false);
        setMessage(settingsError.message);
        return;
      }
    }

    setLoading(false);
    setMessage(text.accountCreated);
    onAuthSuccess();
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setMessage(text.emailRequired);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(text.resetSent);
  }

  function renderRequirement({
    passed,
    label,
  }: {
    passed: boolean;
    label: string;
  }) {
    return (
      <li
        className={`flex items-center gap-2 ${
          passed ? "text-green-700" : "text-slate-500"
        }`}
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
            passed ? "bg-green-600 text-white" : "bg-slate-200 text-slate-500"
          }`}
        >
          {passed ? "✓" : "•"}
        </span>
        {label}
      </li>
    );
  }

  const canResetPassword = mode === "login" && loginFailures >= 2;
  const resumeLabel = text.continueAs.replace(
    "{name}",
    activeDisplayName || activeSession?.user?.email || t.account
  );

  return (
    <>
    <section className="auth-card glass-panel-strong overflow-hidden px-5 py-7 sm:px-7">
      <div className="flex flex-col items-center text-center">
        <img
          src="/app-icon.png"
          alt={t.appName}
          className="app-logo-frame h-32 w-32 object-contain drop-shadow-[0_14px_24px_rgba(21,128,61,0.14)]"
        />
        <p className="mt-2 max-w-xs text-sm font-semibold leading-snug text-green-950/80">
          {t.authWelcomeDesc}
        </p>

        {activeSession?.user ? (
          <button
            type="button"
            onClick={onResumeSession}
            className="touch-target mt-5 w-full rounded-2xl bg-green-700 px-5 py-3 font-semibold text-white shadow-sm active:scale-[0.98] hover:bg-green-800"
          >
            {resumeLabel}
          </button>
        ) : null}
      </div>

      {mode === "signup" ? (
        <div className="mt-7 grid w-full grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
            className="touch-target rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-white"
          >
            {text.login}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
            className="touch-target rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow transition"
          >
            {text.createAccount}
          </button>
        </div>
      ) : null}

      <form
        className="mt-7 grid gap-4"
        suppressHydrationWarning
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) void handleAuth();
        }}
      >
        {mode === "signup" && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
                suppressHydrationWarning
                type="text"
                placeholder={text.firstName}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />

              <input
                className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
                suppressHydrationWarning
                type="text"
                placeholder={text.lastName}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <input
              className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
              suppressHydrationWarning
              type="text"
              placeholder={text.middleName}
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />

            <select
              className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
              suppressHydrationWarning
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
            >
              <option value="">{text.profession}</option>
              {professions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 pl-10 outline-none focus:border-green-600"
                  suppressHydrationWarning
                  list="alakay-auth-countries"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={text.country}
                />
                <datalist id="alakay-auth-countries">
                  {countries.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <input
                className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
                suppressHydrationWarning
                type="text"
                placeholder={text.province}
                value={provinceState}
                onChange={(e) => setProvinceState(e.target.value)}
              />
            </div>

            {country === "Other" && (
              <input
                className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
                suppressHydrationWarning
                type="text"
                placeholder={text.customCountry}
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
              />
            )}
          </>
        )}

        <input
          className="rounded-2xl border border-green-700/35 bg-white/72 p-3 text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus:border-green-700 focus:bg-white focus:ring-4 focus:ring-green-700/10"
          suppressHydrationWarning
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          placeholder={text.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <input
            className="w-full rounded-2xl border border-green-700/35 bg-white/72 p-3 pr-14 text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus:border-green-700 focus:bg-white focus:ring-4 focus:ring-green-700/10"
            suppressHydrationWarning
            type={showPassword ? "text" : "password"}
            placeholder={text.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="button"
            aria-label={showPassword ? text.hide : text.show}
            onClick={() => setShowPassword((previous) => !previous)}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-green-800 hover:bg-green-50"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {canResetPassword ? (
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={loading}
            className="touch-target justify-self-end text-sm font-semibold text-green-800 underline-offset-4 hover:underline disabled:opacity-60"
          >
            {text.resetPassword}
          </button>
        ) : null}

        {mode === "signup" && (
          <>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {text.passwordStrength}
                </p>

                <p className={`text-sm font-bold ${passwordStrength.text}`}>
                  {passwordStrength.label}
                </p>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${passwordStrength.bar}`}
                />
              </div>

              <ul className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                {renderRequirement({ passed: passwordChecks.minLength, label: text.minLength })}
                {renderRequirement({ passed: passwordChecks.uppercase, label: text.uppercase })}
                {renderRequirement({ passed: passwordChecks.lowercase, label: text.lowercase })}
                {renderRequirement({ passed: passwordChecks.number, label: text.number })}
                {renderRequirement({ passed: passwordChecks.special, label: text.special })}
              </ul>
            </div>

            <div className="relative">
              <input
                className="w-full rounded-2xl border border-slate-200 p-3 pr-14 outline-none focus:border-green-600"
                suppressHydrationWarning
                type={showRepeatPassword ? "text" : "password"}
                placeholder={text.repeatPassword}
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
              />

              <button
                type="button"
                aria-label={showRepeatPassword ? text.hide : text.show}
                onClick={() => setShowRepeatPassword((previous) => !previous)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-green-800 hover:bg-green-50"
              >
                {showRepeatPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {repeatPassword && (
              <div
                className={`rounded-2xl p-3 text-sm ${
                  password === repeatPassword
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                {password === repeatPassword
                  ? text.passwordsMatch
                  : text.passwordsDontMatch}
              </div>
            )}

            <label className="flex gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <input
                suppressHydrationWarning
                type="checkbox"
                checked={acceptPolicies}
                onChange={(e) => setAcceptPolicies(e.target.checked)}
              />
              <span>{text.policies}</span>
            </label>

            <label className="flex gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <input
                suppressHydrationWarning
                type="checkbox"
                checked={acceptEmails}
                onChange={(e) => setAcceptEmails(e.target.checked)}
              />
              <span>{text.emails}</span>
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {loading
            ? text.wait
            : mode === "login"
              ? text.login
              : text.createAccount}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
            setPassword("");
            setRepeatPassword("");
          }}
          className="text-sm font-semibold text-green-800"
        >
          {mode === "login" ? text.needAccount : text.alreadyAccount}
        </button>

        {message && (
          <div className="rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-900">
            {message}
          </div>
        )}
      </form>

      {mode === "login" ? (
        <button
          type="button"
          onClick={onContinueAsGuest}
          className="touch-target mt-5 flex w-full items-center justify-center rounded-2xl border border-green-100 bg-white/70 px-5 py-3 text-sm font-bold text-green-800 shadow-sm shadow-green-900/5 transition hover:-translate-y-0.5 hover:bg-green-50 active:scale-[0.98]"
        >
          {text.continueGuest}
        </button>
      ) : null}
    </section>

      <div className="auth-cycle mt-5 h-5 text-center text-[11px] font-semibold text-green-950/35">
        <span>{text.welcomeCycle}</span>
        <span>{text.lastUpdate}</span>
      </div>
    </>
  );
}



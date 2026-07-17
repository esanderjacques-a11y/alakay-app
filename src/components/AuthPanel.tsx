"use client";

import { useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Eye, EyeOff, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { countries } from "@/lib/countries";
import { normalizeAuthEmail } from "@/lib/email";
import { Language, Translation } from "@/lib/translations";
import { authPanelText } from "@/lib/i18n/componentText";
import { LAST_CHANGE_DATE_ISO } from "@/lib/appBuildInfo";
import { formatLastUpdate } from "@/lib/dateLocales";
import MenuSelect from "@/components/ui/MenuSelect";
import { PROFILE_PROFESSIONS } from "@/lib/profileProfessions";

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

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

function getPasswordStrength(password: string, text: AuthPanelText) {
  const checks = getPasswordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;

  if (!password) {
    return {
      label: text.empty,
      tone: "empty" as const,
    };
  }

  if (score <= 2) {
    return {
      label: text.weak,
      tone: "weak" as const,
    };
  }

  if (score === 3 || score === 4) {
    return {
      label: text.medium,
      tone: "medium" as const,
    };
  }

  return {
    label: text.strong,
    tone: "strong" as const,
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
  const lastUpdateLabel = useMemo(
    () => formatLastUpdate(text.lastUpdate, LAST_CHANGE_DATE_ISO, language),
    [text.lastUpdate, language]
  );

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
      <li className={`auth-req ${passed ? "auth-req--passed" : ""}`}>
        <span className="auth-req__mark" aria-hidden="true">
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
  const passwordsMatch = Boolean(repeatPassword) && password === repeatPassword;

  return (
    <>
      <section
        className={`auth-card glass-panel-strong overflow-hidden px-5 py-7 sm:px-7 ${
          mode === "signup" ? "auth-card-signup" : ""
        }`}
      >
        <div className="auth-card__intro flex flex-col items-center text-center">
          <img
            src="/app-icon.png"
            alt={t.appName}
            className="app-logo-frame auth-card__logo h-20 w-20 object-contain sm:h-24 sm:w-24"
          />
          <p className="auth-welcome mt-2 max-w-xs text-sm font-semibold leading-snug">
            {t.authWelcomeDesc}
          </p>

          {activeSession?.user ? (
            <button
              type="button"
              onClick={onResumeSession}
              className="auth-primary-btn touch-target mt-5 w-full rounded-2xl px-5 py-3 font-semibold active:scale-[0.98]"
            >
              {resumeLabel}
            </button>
          ) : null}
        </div>

        <div className="auth-mode-tabs mt-7 grid w-full grid-cols-2 gap-1 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
            className={`auth-mode-tabs__btn touch-target rounded-xl px-4 py-3 text-sm font-semibold ${
              mode === "login" ? "auth-mode-tabs__btn--active" : ""
            }`}
          >
            {text.login}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
            className={`auth-mode-tabs__btn touch-target rounded-xl px-4 py-3 text-sm font-semibold ${
              mode === "signup" ? "auth-mode-tabs__btn--active" : ""
            }`}
          >
            {text.createAccount}
          </button>
        </div>

        <form
          className="auth-form mt-7 grid gap-4"
          suppressHydrationWarning
          onSubmit={(event) => {
            event.preventDefault();
            if (!loading) void handleAuth();
          }}
        >
          {mode === "signup" && (
            <>
              <div className="auth-form__row grid gap-4 sm:grid-cols-2">
                <input
                  className="auth-field"
                  suppressHydrationWarning
                  type="text"
                  placeholder={text.firstName}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />

                <input
                  className="auth-field"
                  suppressHydrationWarning
                  type="text"
                  placeholder={text.lastName}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <input
                className="auth-field"
                suppressHydrationWarning
                type="text"
                placeholder={text.middleName}
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />

              <MenuSelect
                value={profession}
                placeholder={text.profession}
                onChange={setProfession}
                variant="field"
                fullWidth
                heading={text.profession}
                triggerClassName="auth-field"
                options={[
                  { value: "", label: text.profession },
                  ...PROFILE_PROFESSIONS.map((item) => ({
                    value: item,
                    label: item,
                  })),
                ]}
              />

              <div className="auth-form__row grid gap-4 sm:grid-cols-2">
                <div className="relative">
                  <Search
                    size={17}
                    className="auth-field__icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  />
                  <input
                    className="auth-field pl-10"
                    suppressHydrationWarning
                    list="cultosol-auth-countries"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder={text.country}
                  />
                  <datalist id="cultosol-auth-countries">
                    {countries.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <input
                  className="auth-field"
                  suppressHydrationWarning
                  type="text"
                  placeholder={text.province}
                  value={provinceState}
                  onChange={(e) => setProvinceState(e.target.value)}
                />
              </div>

              {country === "Other" && (
                <input
                  className="auth-field"
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
            className="auth-field auth-field--accent"
            suppressHydrationWarning
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder={text.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="auth-password-field relative">
            <input
              className="auth-field auth-field--accent pr-14"
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
              className="auth-icon-btn absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {canResetPassword ? (
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={loading}
              className="auth-link touch-target justify-self-end text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-60"
            >
              {text.resetPassword}
            </button>
          ) : null}

          {mode === "signup" && (
            <>
              <div className="auth-panel-muted auth-strength rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="auth-strength__title text-sm font-semibold">
                    {text.passwordStrength}
                  </p>

                  <p
                    className={`auth-strength__label text-sm font-bold auth-strength__label--${passwordStrength.tone}`}
                  >
                    {passwordStrength.label}
                  </p>
                </div>

                <div className="auth-strength__track mt-3 h-2 overflow-hidden rounded-full">
                  <div
                    className={`auth-strength__bar auth-strength__bar--${passwordStrength.tone}`}
                  />
                </div>

                <ul className="auth-req-list mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  {renderRequirement({
                    passed: passwordChecks.minLength,
                    label: text.minLength,
                  })}
                  {renderRequirement({
                    passed: passwordChecks.uppercase,
                    label: text.uppercase,
                  })}
                  {renderRequirement({
                    passed: passwordChecks.lowercase,
                    label: text.lowercase,
                  })}
                  {renderRequirement({
                    passed: passwordChecks.number,
                    label: text.number,
                  })}
                  {renderRequirement({
                    passed: passwordChecks.special,
                    label: text.special,
                  })}
                </ul>
              </div>

              <div className="relative">
                <input
                  className="auth-field pr-14"
                  suppressHydrationWarning
                  type={showRepeatPassword ? "text" : "password"}
                  placeholder={text.repeatPassword}
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />

                <button
                  type="button"
                  aria-label={showRepeatPassword ? text.hide : text.show}
                  onClick={() =>
                    setShowRepeatPassword((previous) => !previous)
                  }
                  className="auth-icon-btn absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
                >
                  {showRepeatPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {repeatPassword ? (
                <div
                  className={`auth-match-banner rounded-2xl p-3 text-sm ${
                    passwordsMatch
                      ? "auth-match-banner--ok"
                      : "auth-match-banner--bad"
                  }`}
                >
                  {passwordsMatch
                    ? text.passwordsMatch
                    : text.passwordsDontMatch}
                </div>
              ) : null}

              <label className="auth-policy auth-panel-muted flex gap-3 rounded-2xl p-3 text-sm">
                <input
                  suppressHydrationWarning
                  type="checkbox"
                  checked={acceptPolicies}
                  onChange={(e) => setAcceptPolicies(e.target.checked)}
                />
                <span>{text.policies}</span>
              </label>

              <label className="auth-policy auth-panel-muted flex gap-3 rounded-2xl p-3 text-sm">
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
            className="auth-primary-btn auth-submit touch-target rounded-2xl px-5 py-3 font-semibold disabled:opacity-60"
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
            className="auth-toggle auth-link text-sm font-semibold"
          >
            {mode === "login" ? text.needAccount : text.alreadyAccount}
          </button>

          {message ? (
            <div className="auth-message rounded-2xl p-3 text-sm">{message}</div>
          ) : null}
        </form>

        {mode === "login" ? (
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="auth-guest-btn touch-target mt-5 flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 active:scale-[0.98]"
          >
            {text.continueGuest}
          </button>
        ) : null}
      </section>

      <div className="auth-cycle mt-5 h-5 text-center text-[11px] font-semibold">
        <span>{text.welcomeCycle}</span>
        <span>{lastUpdateLabel}</span>
      </div>
    </>
  );
}

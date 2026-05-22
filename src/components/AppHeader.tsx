"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import {
  Check,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  Moon,
  RotateCcw,
  Settings,
  Sun,
  User,
  UserPlus,
  UserRoundCheck,
  UserRoundCog,
  X,
} from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import LanguageFlag from "@/components/LanguageFlag";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { Language, Translation } from "@/lib/translations";

type Props = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translation;
  session: Session | null;
  guestMode: boolean;
  displayName: string;
  onHome: () => void;
  onUseAccount: () => void;
  onSwitchAccount: () => void;
  onContinueAsGuest: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenRecycleBin: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

const languageOptions: {
  code: Language;
  fullLabel: string;
}[] = [
  { code: "en", fullLabel: "English" },
  { code: "es", fullLabel: "Español" },
  { code: "fr", fullLabel: "Français" },
  { code: "ht", fullLabel: "Kreyòl" },
  { code: "pt", fullLabel: "Português" },
  { code: "sw", fullLabel: "Kiswahili" },
];

export default function AppHeader({
  language,
  setLanguage,
  t,
  session,
  guestMode,
  displayName,
  onHome,
  onUseAccount,
  onSwitchAccount,
  onContinueAsGuest,
  onLogout,
  onOpenSettings,
  onOpenRecycleBin,
  theme,
  onToggleTheme,
}: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuPresence = useAnimatedPresence(mobileMenuOpen, 220);
  const [mobileLanguageOpen, setMobileLanguageOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const mobileLanguagePresence = useAnimatedPresence(mobileLanguageOpen, 180);
  const mobileAccountPresence = useAnimatedPresence(mobileAccountOpen, 180);
  const headerRef = useRef<HTMLElement | null>(null);

  const accountLabel = guestMode ? t.guestMode : displayName || t.account;

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    setMobileLanguageOpen(false);
    setMobileAccountOpen(false);
  }

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;
    const headerNode: HTMLElement = headerElement;

    let previousScrollY = Math.max(window.scrollY, 0);
    let hiddenOffset = 0;
    let animationFrame = 0;

    function updateHeader() {
      animationFrame = 0;

      const currentScrollY = Math.max(window.scrollY, 0);
      const delta = currentScrollY - previousScrollY;
      const headerHeight = headerNode.offsetHeight + 8;
      const focusedInsideHeader =
        document.activeElement instanceof Node &&
        headerNode.contains(document.activeElement);

      if (currentScrollY <= 8 || focusedInsideHeader) {
        hiddenOffset = 0;
      } else if (delta > 0) {
        hiddenOffset = Math.min(headerHeight, hiddenOffset + delta);
      } else if (delta < 0) {
        hiddenOffset = Math.max(0, hiddenOffset + delta);
      }

      previousScrollY = currentScrollY;
      headerNode.style.transform = `translate3d(0, -${hiddenOffset}px, 0)`;
      headerNode.style.opacity = hiddenOffset >= headerHeight ? "0.96" : "1";
    }

    function requestHeaderUpdate() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateHeader);
    }

    updateHeader();
    window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
    document.addEventListener("scroll", requestHeaderUpdate, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", requestHeaderUpdate);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", requestHeaderUpdate);
      document.removeEventListener("scroll", requestHeaderUpdate, {
        capture: true,
      });
      window.removeEventListener("resize", requestHeaderUpdate);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="app-header fixed inset-x-0 top-0 z-[12000] border-b border-white/55"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onHome}
          className="touch-target flex min-w-0 items-center gap-3 rounded-2xl pr-2 active:scale-[0.98]"
        >
          <img
            src="/app-icon.png"
            alt={t.appName}
            className="app-logo-frame h-10 w-10 shrink-0 object-contain drop-shadow-[0_8px_14px_rgba(21,128,61,0.14)] sm:h-11 sm:w-11"
          />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-lg font-extrabold leading-tight text-green-900">
              {t.appName.toUpperCase()}
            </span>
            <span className="block truncate text-xs font-medium text-slate-500">
              {t.shortTagline}
            </span>
          </span>
        </button>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t.appSettings}
            title={t.appSettings}
            className="touch-target grid h-10 w-10 place-items-center rounded-2xl border border-green-200/80 bg-white/76 text-green-900 shadow-sm shadow-green-900/5 backdrop-blur-md active:scale-[0.98]"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={t.themeToggleDesc}
            title={theme === "dark" ? t.lightTheme : t.darkTheme}
            className="touch-target grid h-10 w-10 place-items-center rounded-2xl border border-green-200/80 bg-white/76 text-green-900 shadow-sm shadow-green-900/5 backdrop-blur-md active:scale-[0.98]"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <LanguageSwitcher language={language} onChange={setLanguage} />
          <AccountMenu
            language={language}
            email={session?.user?.email}
            guestMode={guestMode}
            hasSession={Boolean(session?.user)}
            displayName={displayName}
            onUseAccount={onUseAccount}
            onSwitchAccount={onSwitchAccount}
            onContinueAsGuest={onContinueAsGuest}
            onLogout={onLogout}
          />
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label={t.appSettings}
          className="touch-target grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-green-200/80 bg-white/78 text-green-900 shadow-sm shadow-green-900/5 backdrop-blur-md active:scale-[0.98] sm:hidden"
        >
          <Menu size={21} />
        </button>
        </div>

      {mobileMenuPresence.mounted
        ? createPortal(
        <div className="fixed inset-0 z-[24000] sm:hidden">
          <button
            type="button"
            aria-label={t.close}
            className={`absolute inset-0 bg-slate-950/30 backdrop-blur-md ${
              mobileMenuPresence.leaving ? "animate-fade-out" : "animate-fade-in"
            }`}
            onClick={closeMobileMenu}
          />

            <section
              className={`mobile-menu-panel absolute right-0 top-0 flex h-full w-[min(20rem,84vw)] flex-col border-l border-white/70 p-3 shadow-2xl ${
              mobileMenuPresence.leaving
                ? "animate-slide-right-out"
                : "animate-slide-right-in"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src="/app-icon.png"
                  alt={t.appName}
                  className="app-logo-frame h-9 w-9 shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold text-green-950">
                    {t.appName.toUpperCase()}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-slate-500">
                    {accountLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label={t.close}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white/72 text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-2 overflow-y-auto pb-4">
              <div className="border-b border-emerald-900/10 pb-1">
                <MobileMenuRow
                  icon={<User size={18} />}
                  title={accountLabel}
                  rightIcon={
                    <ChevronDown
                      size={16}
                      className={`transition ${mobileAccountOpen ? "rotate-180" : ""}`}
                    />
                  }
                  onClick={() => setMobileAccountOpen((open) => !open)}
                />

                {mobileAccountPresence.mounted ? (
                  <div
                    className={`pl-8 ${
                      mobileAccountPresence.leaving
                        ? "animate-slide-up-out"
                        : "animate-slide-up-in"
                    }`}
                  >
                    {session?.user && guestMode ? (
                      <MobileMenuRow
                        icon={<UserRoundCog size={16} />}
                        title={t.account}
                        compact
                        onClick={() => {
                          closeMobileMenu();
                          onUseAccount();
                        }}
                      />
                    ) : null}

                    {!guestMode ? (
                      <MobileMenuRow
                        icon={<UserRoundCheck size={16} />}
                        title={t.continueWithoutAccount}
                        compact
                        onClick={() => {
                          closeMobileMenu();
                          onContinueAsGuest();
                        }}
                      />
                    ) : null}

                    <MobileMenuRow
                      icon={session?.user ? <UserPlus size={16} /> : <LogIn size={16} />}
                      title={t.loginOrCreate}
                      compact
                      onClick={() => {
                        closeMobileMenu();
                        onSwitchAccount();
                      }}
                    />

                    {session?.user ? (
                      <MobileMenuRow
                        icon={<LogOut size={16} />}
                        title={t.logOut}
                        danger
                        compact
                        onClick={() => {
                          closeMobileMenu();
                          onLogout();
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="pt-2">
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
                  {t.appSettings}
                </p>

                <MobileMenuRow
                  icon={<Settings size={18} />}
                  title={t.appSettings}
                  onClick={() => {
                    closeMobileMenu();
                    onOpenSettings();
                  }}
                />

                <MobileMenuRow
                  icon={<LanguageFlag language={language} size="md" />}
                  title={t.selectLanguage}
                  rightIcon={
                    <ChevronDown
                      size={16}
                      className={`transition ${mobileLanguageOpen ? "rotate-180" : ""}`}
                    />
                  }
                  onClick={() => setMobileLanguageOpen((open) => !open)}
                />

                {mobileLanguagePresence.mounted ? (
                  <div
                    className={`border-b border-emerald-900/10 py-1 pl-10 ${
                      mobileLanguagePresence.leaving
                        ? "animate-slide-up-out"
                        : "animate-slide-up-in"
                    }`}
                  >
                  {languageOptions.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setLanguage(item.code);
                        closeMobileMenu();
                      }}
                      className={`touch-target flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-bold transition active:scale-[0.98] ${
                        language === item.code
                          ? "text-green-900"
                          : "text-slate-700 hover:text-green-900"
                      }`}
                    >
                      <LanguageFlag
                        language={item.code}
                        size="md"
                        title={item.fullLabel}
                      />
                      <span>{item.fullLabel}</span>
                      {language === item.code ? (
                        <Check size={16} className="ml-auto text-emerald-700" />
                      ) : null}
                    </button>
                  ))}
                  </div>
                ) : null}

                <MobileMenuRow
                  icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                  title={t.selectTheme}
                  onClick={onToggleTheme}
                />

                <MobileMenuRow
                  icon={<RotateCcw size={18} />}
                  title={t.recycleBin}
                  onClick={() => {
                    closeMobileMenu();
                    onOpenRecycleBin();
                  }}
                />
              </div>
            </div>
          </section>
        </div>,
          document.body
        )
        : null}
    </header>
  );
}

function MobileMenuRow({
  icon,
  title,
  desc,
  rightIcon,
  danger = false,
  compact = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  rightIcon?: ReactNode;
  danger?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
          danger ? "text-red-700" : "text-emerald-800"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold ${
            danger ? "text-red-700" : "text-green-950"
          }`}
        >
          {title}
        </span>
        {desc ? (
          <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
            {desc}
          </span>
        ) : null}
      </span>
      {rightIcon ? (
        <span className="shrink-0 text-emerald-800">{rightIcon}</span>
      ) : null}
    </>
  );

  if (!onClick) {
    return (
      <div className={`flex items-center gap-2.5 ${compact ? "py-1.5" : "py-2"}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target flex w-full items-center gap-2.5 border-t border-emerald-900/10 text-left transition active:scale-[0.98] ${
        compact ? "py-1.5" : "py-2"
      }`}
    >
      {content}
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  Info,
  LogIn,
  LogOut,
  Moon,
  MoreVertical,
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
  onOpenAbout: () => void;
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
  onOpenAbout,
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

    const syncHeaderHeight = () => {
      const heightPx = `${headerNode.offsetHeight}px`;
      document.documentElement.style.setProperty(
        "--app-header-visible-height",
        heightPx
      );
      document.documentElement.style.setProperty("--app-header-full-height", heightPx);
    };

    syncHeaderHeight();
    const resizeObserver = new ResizeObserver(syncHeaderHeight);
    resizeObserver.observe(headerNode);
    window.addEventListener("resize", syncHeaderHeight);

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
    }

    updateHeader();
    window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
    document.addEventListener("scroll", requestHeaderUpdate, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", requestHeaderUpdate);

    function requestHeaderUpdate() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateHeader);
    }

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncHeaderHeight);
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
      className="app-header fixed inset-x-0 top-0 z-[12000]"
    >
      <div className="app-header__toolbar flex items-center justify-between gap-2">
        {/* Logo + App name */}
        <button
          type="button"
          onClick={onHome}
          className="touch-target flex min-w-0 items-center justify-start gap-2.5 text-left active:scale-[0.97] transition-transform"
        >
          <img
            src="/app-icon.png"
            alt={t.appName}
            className="app-logo-frame h-7 w-7 shrink-0 object-contain"
          />
          <div className="app-header__brand hidden sm:block">
            <span className="app-header__brand-name text-base font-extrabold uppercase tracking-wide leading-tight text-green-900">
              {t.appName}
            </span>
            <span className="app-header__brand-tagline text-[10px] font-medium text-slate-400 leading-tight">
              {t.shortTagline}
            </span>
          </div>
          <span className="sm:hidden text-left text-base font-extrabold uppercase tracking-wide text-green-900">
            {t.appName}
          </span>
        </button>

        {/* Desktop action buttons */}
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={t.themeToggleDesc}
            className="touch-target h-9 w-9 grid place-items-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
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
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t.appSettings}
            title={t.appSettings}
            className="touch-target h-9 w-9 grid place-items-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            onClick={onOpenRecycleBin}
            aria-label={t.recycleBin}
            title={t.recycleBin}
            className="touch-target h-9 w-9 grid place-items-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={onOpenAbout}
            aria-label={t.about}
            title={t.about}
            className="touch-target h-9 w-9 grid place-items-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <Info size={18} />
          </button>
        </div>

        {/* Mobile overflow menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Menu"
          className="touch-target h-9 w-9 grid shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all sm:hidden"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Mobile side drawer */}
      {mobileMenuPresence.mounted
        ? createPortal(
          <div className="mobile-menu-overlay sm:hidden">
            <button
              type="button"
              aria-label={t.close}
              className={`absolute inset-0 bg-black/30 ${
                mobileMenuPresence.leaving ? "animate-fade-out" : "animate-fade-in"
              }`}
              onClick={closeMobileMenu}
            />

            <section
              className={`mobile-menu-panel absolute right-0 top-0 flex h-full w-[min(18rem,82vw)] flex-col p-0 ${
                mobileMenuPresence.leaving
                  ? "animate-slide-right-out"
                  : "animate-slide-right-in"
              }`}
            >
              {/* Drawer header */}
              <div className="mobile-menu-panel__header flex items-center justify-between border-b border-black/6 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src="/app-icon.png"
                    alt={t.appName}
                    className="app-logo-frame h-7 w-7 shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold uppercase tracking-wide text-green-900">
                      {t.appName}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {accountLabel}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  aria-label={t.close}
                  className="h-8 w-8 grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Drawer content */}
              <div className="flex flex-1 flex-col overflow-y-auto">
                {/* Account section */}
                <div className="px-2 pt-2 pb-1">
                  <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {t.account}
                  </p>
                  <MenuRow
                    icon={<User size={17} />}
                    title={accountLabel}
                    rightIcon={
                      <ChevronDown
                        size={15}
                        className={`transition-transform ${mobileAccountOpen ? "rotate-180" : ""}`}
                      />
                    }
                    onClick={() => setMobileAccountOpen((o) => !o)}
                  />
                  {mobileAccountPresence.mounted ? (
                    <div
                      className={`ml-10 ${
                        mobileAccountPresence.leaving
                          ? "animate-slide-up-out"
                          : "animate-slide-up-in"
                      }`}
                    >
                      {session?.user && guestMode ? (
                        <SubMenuRow
                          icon={<UserRoundCog size={15} />}
                          title={t.account}
                          onClick={() => { closeMobileMenu(); onUseAccount(); }}
                        />
                      ) : null}
                      {!guestMode ? (
                        <SubMenuRow
                          icon={<UserRoundCheck size={15} />}
                          title={t.continueWithoutAccount}
                          onClick={() => { closeMobileMenu(); onContinueAsGuest(); }}
                        />
                      ) : null}
                      <SubMenuRow
                        icon={session?.user ? <UserPlus size={15} /> : <LogIn size={15} />}
                        title={t.loginOrCreate}
                        onClick={() => { closeMobileMenu(); onSwitchAccount(); }}
                      />
                      {session?.user ? (
                        <SubMenuRow
                          icon={<LogOut size={15} />}
                          title={t.logOut}
                          danger
                          onClick={() => { closeMobileMenu(); onLogout(); }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Divider */}
                <div className="mx-4 my-1 h-px bg-black/6" />

                {/* App settings section */}
                <div className="px-2 py-1">
                  <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {t.appSettings}
                  </p>

                  <MenuRow
                    icon={<Globe size={17} />}
                    title={t.selectLanguage}
                    rightContent={
                      <div className="flex items-center gap-1.5">
                        <LanguageFlag language={language} size="sm" />
                        <ChevronDown
                          size={15}
                          className={`transition-transform ${mobileLanguageOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    }
                    onClick={() => setMobileLanguageOpen((o) => !o)}
                  />
                  {mobileLanguagePresence.mounted ? (
                    <div
                      className={`ml-10 ${
                        mobileLanguagePresence.leaving
                          ? "animate-slide-up-out"
                          : "animate-slide-up-in"
                      }`}
                    >
                      {languageOptions.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => { setLanguage(item.code); closeMobileMenu(); }}
                          className={`touch-target flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition active:scale-[0.98] ${
                            language === item.code
                              ? "font-bold text-green-800 bg-green-50"
                              : "font-medium text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <LanguageFlag language={item.code} size="md" title={item.fullLabel} />
                          <span>{item.fullLabel}</span>
                          {language === item.code ? (
                            <Check size={14} className="ml-auto text-green-700" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <MenuRow
                    icon={theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                    title={theme === "dark" ? t.lightTheme : t.darkTheme}
                    onClick={onToggleTheme}
                  />

                  <MenuRow
                    icon={<Settings size={17} />}
                    title={t.appSettings}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => { closeMobileMenu(); onOpenSettings(); }}
                  />

                  <MenuRow
                    icon={<RotateCcw size={17} />}
                    title={t.recycleBin}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => { closeMobileMenu(); onOpenRecycleBin(); }}
                  />
                </div>

                {/* Divider */}
                <div className="mx-4 my-1 h-px bg-black/6" />

                {/* About section */}
                <div className="px-2 py-1">
                  <MenuRow
                    icon={<Info size={17} />}
                    title={t.about}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => { closeMobileMenu(); onOpenAbout(); }}
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

function MenuRow({
  icon,
  title,
  rightIcon,
  rightContent,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  rightIcon?: ReactNode;
  rightContent?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 active:scale-[0.98] transition-all"
    >
      <span className="text-slate-500 shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 text-sm font-semibold text-slate-800 truncate">
        {title}
      </span>
      {rightContent ? (
        <span className="shrink-0 text-slate-400">{rightContent}</span>
      ) : rightIcon ? (
        <span className="shrink-0 text-slate-400">{rightIcon}</span>
      ) : null}
    </button>
  );
}

function SubMenuRow({
  icon,
  title,
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-slate-50 active:scale-[0.98] transition-all ${
        danger ? "text-red-600" : "text-slate-600"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-sm font-medium">{title}</span>
    </button>
  );
}

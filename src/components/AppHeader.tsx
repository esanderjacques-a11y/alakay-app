"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import {
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Globe,
  Info,
  Landmark,
  LogIn,
  LogOut,
  Moon,
  NotebookPen,
  RotateCcw,
  Settings,
  Database,
  Sun,
  User,
  UserPlus,
  UserRoundCheck,
  UserRoundCog,
  X,
} from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import JackoBot from "@/components/JackoBot";
import LanguageFlag from "@/components/LanguageFlag";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { getLocalBillingBundle } from "@/lib/billing";
import { getBillingText } from "@/lib/i18n/billingText";
import type { JackoAppContext } from "@/lib/jackoContext";
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
  onOpenAccountSettings?: () => void;
  settingsActive?: boolean;
  onOpenBilling: () => void;
  onOpenRecycleBin: () => void;
  onOpenCustomData: () => void;
  onOpenAbout: () => void;
  onOpenFarms: () => void;
  onOpenCalendar: () => void;
  onOpenNotes: () => void;
  onOpenNotifications: () => void;
  notificationCount?: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  isAdmin?: boolean;
  planTier?: import("@/lib/appSettings").PlanTier;
  jackoContext?: JackoAppContext | null;
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
  onOpenAccountSettings,
  settingsActive = false,
  onOpenBilling,
  onOpenRecycleBin,
  onOpenCustomData,
  onOpenAbout,
  onOpenFarms,
  onOpenCalendar,
  onOpenNotes,
  onOpenNotifications,
  notificationCount = 0,
  theme,
  onToggleTheme,
  isAdmin = false,
  planTier,
  jackoContext = null,
}: Props) {
  const billingLabels = getBillingText(language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuPresence = useAnimatedPresence(mobileMenuOpen, 220);
  const [mobileLanguageOpen, setMobileLanguageOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [jackoOpen, setJackoOpen] = useState(false);
  const mobileLanguagePresence = useAnimatedPresence(mobileLanguageOpen, 180);
  const mobileAccountPresence = useAnimatedPresence(mobileAccountOpen, 180);
  const headerRef = useRef<HTMLElement | null>(null);

  const userId = session?.user?.id ?? "guest";
  const jackoAllowed =
    isAdmin || getLocalBillingBundle(userId).hasAiAccess;

  const accountLabel = guestMode ? t.guestMode : displayName || t.account;

  const jackoLabels = {
    title: t.jackoTitle,
    subtitle: t.jackoSubtitle,
    placeholder: t.jackoPlaceholder,
    send: t.jackoSend,
    thinking: t.jackoThinking,
    intro: t.jackoIntro,
    close: t.close,
    error: t.jackoError,
    contextReady: t.jackoContextReady,
    quickReview: t.jackoQuickReview,
    quickFertilize: t.jackoQuickFertilize,
    quickPriorities: t.jackoQuickPriorities,
    quickCreator: t.jackoQuickCreator,
    quickMission: t.jackoQuickMission,
  };

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
          <div className="app-header__brand min-w-0">
            <span className="app-header__brand-name text-base font-extrabold uppercase tracking-wide leading-tight">
              {t.appName}
            </span>
            <span className="app-header__brand-tagline text-[10px] font-medium leading-tight">
              {t.shortTagline}
            </span>
          </div>
        </button>

        {/* Compact tools + overflow menu (all breakpoints) */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={t.themeToggleDesc}
              className="app-header__icon-btn touch-target h-9 w-9 grid place-items-center rounded-xl active:scale-95 transition-all"
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
              onViewAccountInfo={onOpenAccountSettings}
            />
          </div>

          {jackoAllowed ? (
            <button
              type="button"
              onClick={() => setJackoOpen(true)}
              aria-label={t.jackoTitle}
              title={t.jackoTitle}
              className="app-header__icon-btn touch-target h-9 w-9 grid place-items-center rounded-xl active:scale-95 transition-all"
            >
              <Bot size={18} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t.appSettings}
            aria-pressed={settingsActive}
            title={t.appSettings}
            className={`app-header__icon-btn touch-target h-9 w-9 grid place-items-center rounded-xl active:scale-95 transition-all${settingsActive ? " is-active" : ""}`}
          >
            <Settings size={18} />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? t.close : t.menu || "Menu"}
            aria-expanded={mobileMenuOpen}
            title={mobileMenuOpen ? t.close : t.menu || "Menu"}
            className="app-header__icon-btn app-header__menu-toggle touch-target h-9 w-9 grid place-items-center rounded-xl active:scale-95 transition-all"
          >
            <MenuToggleIcon open={mobileMenuOpen} />
          </button>
        </div>
      </div>

      {/* Side drawer — planning & secondary actions for all screen sizes */}
      {mobileMenuPresence.mounted
        ? createPortal(
          <div className="mobile-menu-overlay">
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
              <div className="mobile-menu-panel__header flex items-center justify-between gap-2 px-3 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <img
                    src="/app-icon.png"
                    alt={t.appName}
                    className="app-logo-frame h-7 w-7 shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <p className="mobile-menu-panel__brand-name truncate">
                      {t.appName}
                    </p>
                    <p className="mobile-menu-panel__brand-sub truncate">
                      {accountLabel}
                    </p>
                  </div>
                </div>
                <div className="mobile-menu-panel__header-actions flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu();
                      onOpenSettings();
                    }}
                    aria-label={t.appSettings}
                    title={t.appSettings}
                    className="mobile-menu-panel__icon-btn h-9 w-9 grid place-items-center rounded-xl"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={closeMobileMenu}
                    aria-label={t.close}
                    className="mobile-menu-panel__icon-btn h-9 w-9 grid place-items-center rounded-xl"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Drawer content */}
              <div className="mobile-menu-panel__body flex flex-1 flex-col overflow-y-auto">
                {/* Account section */}
                <div className="px-2 pt-2 pb-1">
                  <p className="mobile-menu-panel__section-label">
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
                <div className="mobile-menu-panel__divider" />

                {/* Planning section */}
                <div className="px-2 py-1">
                  <p className="mobile-menu-panel__section-label">
                    {t.planningMenu}
                  </p>
                  <MenuRow
                    icon={<Landmark size={17} />}
                    title={t.planningFarms}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => {
                      closeMobileMenu();
                      onOpenFarms();
                    }}
                  />
                  <MenuRow
                    icon={<CalendarDays size={17} />}
                    title={t.planningCalendar}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => {
                      closeMobileMenu();
                      onOpenCalendar();
                    }}
                  />
                  <MenuRow
                    icon={<NotebookPen size={17} />}
                    title={t.planningNotes}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => {
                      closeMobileMenu();
                      onOpenNotes();
                    }}
                  />
                  <MenuRow
                    icon={<Bell size={17} />}
                    title={t.planningNotifications}
                    rightIcon={
                      notificationCount > 0 ? (
                        <span className="rounded-full bg-emerald-700 px-1.5 text-[10px] font-bold text-white">
                          {notificationCount > 9 ? "9+" : notificationCount}
                        </span>
                      ) : (
                        <ChevronRight size={15} />
                      )
                    }
                    onClick={() => {
                      closeMobileMenu();
                      onOpenNotifications();
                    }}
                  />
                </div>

                <div className="mobile-menu-panel__divider" />

                <div className="px-2 py-1">
                  <p className="mobile-menu-panel__section-label">
                    {billingLabels.menu}
                  </p>
                  <MenuRow
                    icon={<CreditCard size={17} />}
                    title={billingLabels.menu}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => {
                      closeMobileMenu();
                      onOpenBilling();
                    }}
                  />
                </div>

                <div className="mobile-menu-panel__divider" />

                {/* Quick settings */}
                <div className="px-2 py-1">
                  <p className="mobile-menu-panel__section-label">
                    {t.quickSettings}
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
                          onClick={() => {
                            setLanguage(item.code);
                            closeMobileMenu();
                          }}
                          className={`mobile-menu-lang-option touch-target active:scale-[0.98] ${
                            language === item.code ? "is-active" : ""
                          }`}
                        >
                          <LanguageFlag language={item.code} size="md" title={item.fullLabel} />
                          <span>{item.fullLabel}</span>
                          {language === item.code ? (
                            <Check size={14} className="ml-auto" />
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
                    onClick={() => {
                      closeMobileMenu();
                      onOpenSettings();
                    }}
                  />
                </div>

                <div className="mobile-menu-panel__divider" />

                {/* Data tools */}
                <div className="px-2 py-1">
                  <p className="mobile-menu-panel__section-label">
                    {t.dataTools}
                  </p>
                  <MenuRow
                    icon={<Database size={17} />}
                    title={t.customData}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => {
                      closeMobileMenu();
                      onOpenCustomData();
                    }}
                  />
                  <MenuRow
                    icon={<RotateCcw size={17} />}
                    title={t.recycleBin}
                    rightIcon={<ChevronRight size={15} />}
                    onClick={() => {
                      closeMobileMenu();
                      onOpenRecycleBin();
                    }}
                  />
                </div>
              </div>

              <footer className="mobile-menu-panel__footer">
                <MenuRow
                  icon={<Info size={17} />}
                  title={t.about}
                  rightIcon={<ChevronRight size={15} />}
                  onClick={() => {
                    closeMobileMenu();
                    onOpenAbout();
                  }}
                />
              </footer>
            </section>
          </div>,
          document.body
        )
        : null}

      <JackoBot
        open={jackoOpen}
        onClose={() => setJackoOpen(false)}
        language={language}
        userId={userId}
        email={session?.user?.email}
        context={jackoContext}
        labels={jackoLabels}
      />
    </header>
  );
}

function MenuToggleIcon({ open }: { open: boolean }) {
  return (
    <span className={`menu-toggle-icon ${open ? "is-open" : ""}`} aria-hidden>
      <span className="menu-toggle-icon__bar" />
      <span className="menu-toggle-icon__bar" />
      <span className="menu-toggle-icon__bar" />
    </span>
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
      className="mobile-menu-row touch-target"
    >
      <span className="mobile-menu-row__icon">{icon}</span>
      <span className="mobile-menu-row__label">{title}</span>
      {rightContent ? (
        <span className="mobile-menu-row__meta">{rightContent}</span>
      ) : rightIcon ? (
        <span className="mobile-menu-row__meta">{rightIcon}</span>
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
      className={`mobile-menu-row touch-target py-2 ${danger ? "mobile-menu-row--danger" : ""}`}
    >
      <span className="mobile-menu-row__icon">{icon}</span>
      <span className="mobile-menu-row__label text-sm font-medium">{title}</span>
    </button>
  );
}

"use client";

import { useRef, useState } from "react";
import {
  LogIn,
  LogOut,
  User,
  UserPlus,
  UserRoundCheck,
  UserRoundCog,
} from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { useDismissible } from "@/hooks/useDismissible";
import { Language, translations } from "@/lib/translations";

type Props = {
  language: Language;
  email?: string | null;
  guestMode: boolean;
  hasSession: boolean;
  displayName: string;
  onUseAccount: () => void;
  onSwitchAccount: () => void;
  onContinueAsGuest: () => void;
  onLogout: () => void;
};


export default function AccountMenu({
  language,
  email,
  guestMode,
  hasSession,
  displayName,
  onUseAccount,
  onSwitchAccount,
  onContinueAsGuest,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const appText = translations[language];
  const t = appText.accountMenu;

  useDismissible(open, () => setOpen(false), menuRef);

  const buttonLabel = guestMode ? t.guest : displayName || appText.account;

  return (
    <>
      {presence.mounted ? (
        <button
          type="button"
          aria-label={appText.close}
          className={`dismiss-backdrop ${presence.leaving ? "animate-fade-out" : "animate-fade-in"}`}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div ref={menuRef} className="relative z-[13000]">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          className="touch-target flex max-w-[9rem] items-center gap-2 rounded-2xl border border-green-200/80 bg-white/90 px-3 py-2 text-sm font-semibold text-green-900 shadow-sm active:scale-[0.98] sm:max-w-[11rem]"
        >
          <User size={16} className="shrink-0" />
          <span className="truncate">{buttonLabel}</span>
        </button>

        {presence.mounted ? (
          <section
            className={`absolute right-0 top-full z-[13001] mt-2 w-72 rounded-3xl glass-panel-strong p-3 shadow-2xl ${
              presence.leaving ? "animate-scale-out" : "animate-scale-in"
            }`}
          >
            <div className="account-menu-status mb-2 rounded-2xl px-3 py-3 text-xs">
              <p className="account-menu-status__title font-semibold">
                {guestMode ? appText.guestMode : t.usingAccount}
              </p>
              {email ? (
                <p className="account-menu-status__meta mt-1 truncate">{email}</p>
              ) : !guestMode && displayName ? (
                <p className="account-menu-status__meta mt-1 truncate">{displayName}</p>
              ) : null}
            </div>

            <div className="grid gap-1">
              {hasSession && guestMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onUseAccount();
                  }}
                  className="account-menu-item account-menu-item--accent touch-target flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold active:scale-[0.99]"
                >
                  <UserRoundCog size={16} />
                  {t.useAccount}
                </button>
              ) : null}

              {!guestMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onContinueAsGuest();
                  }}
                  className="account-menu-item touch-target flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold active:scale-[0.99]"
                >
                  <UserRoundCheck size={16} />
                  {t.continueGuest}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSwitchAccount();
                }}
                className="account-menu-item touch-target flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold active:scale-[0.99]"
              >
                {hasSession ? <UserPlus size={16} /> : <LogIn size={16} />}
                {hasSession ? t.switchAccount : t.login}
              </button>

              {hasSession ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="account-menu-item account-menu-item--danger touch-target flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold active:scale-[0.99]"
                >
                  <LogOut size={16} />
                  {appText.logOut}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}


"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { readStoredLanguage } from "@/lib/uiPreferences";
import { translations } from "@/lib/translations";

const INSTALL_DISMISS_KEY = "alakay_install_prompt_dismissed";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const mqStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const mqFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mqStandalone || mqFullscreen || iosStandalone;
}

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
}

function readInstallDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function syncDisplayMode() {
  const root = document.documentElement;
  const standalone = isStandaloneDisplay();

  if (standalone) {
    root.dataset.standalone = "true";
    if (window.matchMedia("(display-mode: fullscreen)").matches) {
      root.dataset.displayMode = "fullscreen";
      return;
    }
    root.dataset.displayMode = "standalone";
    return;
  }

  delete root.dataset.standalone;

  if (window.matchMedia("(display-mode: minimal-ui)").matches) {
    root.dataset.displayMode = "minimal-ui";
    return;
  }
  root.dataset.displayMode = "browser";
}

function syncThemeColorMeta() {
  const isDark = document.documentElement.dataset.theme === "dark";
  const isBlack =
    document.documentElement.dataset.darkVariant === "black";
  const color = isDark ? (isBlack ? "#000000" : "#0f172a") : "#059669";

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

function minimizeMobileBrowserChrome() {
  if (isStandaloneDisplay() || !isMobileDevice()) return;
  requestAnimationFrame(() => {
    window.scrollTo(0, 1);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  });
}

export default function MobilePwaBootstrap() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    syncDisplayMode();
    syncThemeColorMeta();
    minimizeMobileBrowserChrome();

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* offline install is optional */
      });
    }

    const standalone = isStandaloneDisplay();
    const mobile = isMobileDevice();
    const ios =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !("MSStream" in window);
    setIsIos(ios);

    if (!standalone && mobile && !readInstallDismissed()) {
      setShowInstallPrompt(true);
    }

    const displayMq = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => {
      syncDisplayMode();
      if (isStandaloneDisplay()) setShowInstallPrompt(false);
    };
    displayMq.addEventListener("change", onDisplayChange);
    window.addEventListener("orientationchange", onDisplayChange);
    window.addEventListener("resize", onDisplayChange);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!readInstallDismissed() && isMobileDevice()) {
        setShowInstallPrompt(true);
      }
    };

    const onAppInstalled = () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const themeObserver = new MutationObserver(() => {
      syncThemeColorMeta();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-dark-variant"],
    });

    return () => {
      displayMq.removeEventListener("change", onDisplayChange);
      window.removeEventListener("orientationchange", onDisplayChange);
      window.removeEventListener("resize", onDisplayChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      themeObserver.disconnect();
    };
  }, []);

  if (!showInstallPrompt || isStandaloneDisplay()) return null;

  const language = readStoredLanguage();
  const t = translations[language];

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }

  function handleDismiss() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowInstallPrompt(false);
  }

  return (
    <div className="mobile-install-banner" role="region" aria-label={t.installAppTitle}>
      <div className="mobile-install-banner__content">
        <p className="mobile-install-banner__title">{t.installAppTitle}</p>
        <p className="mobile-install-banner__desc">{t.installAppDesc}</p>
        <div className="mobile-install-banner__actions">
          {deferredPrompt ? (
            <button type="button" className="mobile-install-banner__primary" onClick={handleInstall}>
              <Download size={16} aria-hidden />
              {t.installAppAction}
            </button>
          ) : isIos ? (
            <span className="mobile-install-banner__ios">
              <Share size={16} aria-hidden />
              {t.installAppIosHint}
            </span>
          ) : null}
          <button
            type="button"
            className="mobile-install-banner__dismiss"
            onClick={handleDismiss}
            aria-label={t.installAppDismiss}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

"use client";

import { useSyncExternalStore } from "react";

const CONSENT_COOKIE = "comptoir_cookie_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

type ConsentChoice = "accepted" | "declined";

function getConsentCookie(): ConsentChoice | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${CONSENT_COOKIE}=`));

  const value = cookie?.split("=")[1];
  if (value === "accepted" || value === "declined") return value;

  return null;
}

function setConsentCookie(choice: ConsentChoice) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;

  window.dispatchEvent(
    new CustomEvent("comptoir-cookie-consent", {
      detail: { choice },
    }),
  );
}

function subscribeToConsentChanges(onStoreChange: () => void) {
  window.addEventListener("comptoir-cookie-consent", onStoreChange);
  window.addEventListener("focus", onStoreChange);

  return () => {
    window.removeEventListener("comptoir-cookie-consent", onStoreChange);
    window.removeEventListener("focus", onStoreChange);
  };
}

function getServerConsentSnapshot(): ConsentChoice {
  return "accepted";
}

export default function CookieConsent() {
  const choice = useSyncExternalStore(
    subscribeToConsentChanges,
    getConsentCookie,
    getServerConsentSnapshot,
  );

  const saveChoice = (nextChoice: ConsentChoice) => {
    setConsentCookie(nextChoice);
  };

  if (choice !== null) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-semibold">Cookies et statistiques</p>
          <p className="text-sm text-slate-600">
            Nous utilisons des cookies pour mesurer l&apos;utilisation du site
            et améliorer nos communications. Aucune adresse recherchée n&apos;est
            enregistrée dans ces cookies.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => saveChoice("declined")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => saveChoice("accepted")}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}

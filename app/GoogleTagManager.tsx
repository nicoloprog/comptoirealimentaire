"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

const CONSENT_COOKIE = "comptoir_cookie_consent";

type ConsentChoice = "accepted" | "declined";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function getConsentCookie(): ConsentChoice | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${CONSENT_COOKIE}=`));

  const value = cookie?.split("=")[1];
  if (value === "accepted" || value === "declined") return value;

  return null;
}

function subscribeToConsentChanges(onStoreChange: () => void) {
  window.addEventListener("comptoir-cookie-consent", onStoreChange);
  window.addEventListener("focus", onStoreChange);

  return () => {
    window.removeEventListener("comptoir-cookie-consent", onStoreChange);
    window.removeEventListener("focus", onStoreChange);
  };
}

function getServerConsentSnapshot(): ConsentChoice | null {
  return null;
}

export default function GoogleTagManager() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const consent = useSyncExternalStore(
    subscribeToConsentChanges,
    getConsentCookie,
    getServerConsentSnapshot,
  );

  if (!gtmId || consent !== "accepted") return null;

  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            'gtm.start': new Date().getTime(),
            event: 'gtm.js'
          });
        `}
      </Script>
      <Script
        id="gtm-script"
        src={`https://www.googletagmanager.com/gtm.js?id=${gtmId}`}
        strategy="afterInteractive"
      />
    </>
  );
}

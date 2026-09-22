import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GoogleTagManager from "./GoogleTagManager";
import CookieConsent from "./CookieConsent";
import "./globals.css";
import { getSiteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Aide alimentaire MRC Rivière-du-Nord",
  description:
    "Aide alimentaire pour Saint-Jérôme, Prévost, Saint-Colomban, Sainte-Sophie et Sainte-Hippolyte. Localisez votre comptoir alimentaire dès maintenant.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Aide alimentaire MRC Rivière-du-Nord",
    description:
      "Aide alimentaire pour Saint-Jérôme, Prévost, Saint-Colomban, Sainte-Sophie et Sainte-Hippolyte. Localisez votre comptoir alimentaire dès maintenant.",
    url: "/",
    siteName: "Aide alimentaire MRC Rivière-du-Nord",
    locale: "fr_CA",
    type: "website",
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? {
        google: process.env.GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr-CA"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <a
          href="/politique-confidentialite"
          className="fixed bottom-3 right-3 z-40 rounded-full border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-600 transition hover:border-[#1D522C] hover:text-[#1D522C] focus:outline-none focus:ring-2 focus:ring-[#1D522C] focus:ring-offset-2"
          aria-label="Consulter la politique de confidentialité"
        >
          Conditions d'utilisation
        </a>
        <GoogleTagManager />
        <CookieConsent />
      </body>
    </html>
  );
}

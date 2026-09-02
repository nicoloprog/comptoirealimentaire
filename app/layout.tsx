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
  title: "Comptoir alimentaire | Trouver votre comptoir",
  description:
    "Trouvez rapidement le comptoir alimentaire assigné à votre ville, votre rue ou votre adresse.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Comptoir alimentaire",
    description:
      "Trouvez rapidement le comptoir alimentaire assigné à votre ville, votre rue ou votre adresse.",
    url: "/",
    siteName: "Comptoir alimentaire",
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
        <GoogleTagManager />
        <CookieConsent />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Space_Mono } from "next/font/google";

import { getMessages } from "@/i18n";
import { I18nProvider } from "@/i18n/react";
import { getRequestLocale } from "@/i18n/server";
import "../globals.css";

// Display — warm serif-grotesque for headlines
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

// Body & UI — legible at small sizes
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

// Data — dates, amounts, codes get a ticket-stub texture
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chata — group trips, in your hand",
  description:
    "Run the whole life of a group trip — ideation, planning, and shared finances — as one collaborative app.",
};

export const viewport = {
  themeColor: "#f3f2ee",
  width: "device-width",
  initialScale: 1,
};

// Root layout for the participant + organizer app. The (payload) admin route
// group provides its own root layout, so there is intentionally no top-level
// app/layout.tsx (see Next route-groups: multiple root layouts).
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);

  return (
    <html
      lang={locale}
      className={`${bricolage.variable} ${hanken.variable} ${spaceMono.variable} h-full`}
    >
      <body className="min-h-full">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter, Space_Grotesk } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ag = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-ag",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aegis | AI-Powered Fraud Detection",
  description: "Real-time fraud detection, prevention, and case management for fintech teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${bodyFont.variable} ${mono.variable} ${ag.variable}`}>
        {children}
        <Providers />
      </body>
    </html>
  );
}

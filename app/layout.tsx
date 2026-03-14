import type { Metadata } from "next";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis | AI-Powered Fraud Detection",
  description: "Real-time fraud detection, prevention, and case management for fintech teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Providers />
      </body>
    </html>
  );
}

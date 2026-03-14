"use client";

import { Toaster } from "sonner";

export function Providers() {
  return (
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        },
      }}
    />
  );
}

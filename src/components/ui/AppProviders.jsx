"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmHost } from "@/components/ui/ConfirmHost";

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      {children}
      <ConfirmHost />
    </ToastProvider>
  );
}

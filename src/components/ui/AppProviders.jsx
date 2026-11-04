"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmHost } from "@/components/ui/ConfirmHost";
import { OfflineBanner } from "@/components/ui/States";

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <OfflineBanner />
      {children}
      <ConfirmHost />
    </ToastProvider>
  );
}

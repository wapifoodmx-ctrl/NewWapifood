"use client";

import { useEffect, useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import { registerConfirmHost, resolveConfirm } from "@/components/ui/confirm";

export function ConfirmHost() {
  const [state, setState] = useState({
    open: false,
    title: "Confirmar",
    message: "",
    confirmLabel: "Sí",
    cancelLabel: "No",
  });

  useEffect(() => registerConfirmHost(setState), []);

  return (
    <AppModal
      open={state.open}
      title={state.title}
      message={state.message}
      variant="confirm"
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      onClose={() => resolveConfirm(false)}
      onConfirm={() => resolveConfirm(true)}
    />
  );
}

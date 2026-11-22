/** Abre un documento para verlo o imprimirlo. Sin noopener: con esa bandera el navegador abre la ventana y devuelve null, y el HTML nunca se escribe. */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openPrintWindow(html) {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  try {
    popup.opener = null;
  } catch {
    /* el navegador ya aisló la ventana */
  }
  popup.focus();
  return popup;
}

export function downloadBytes({ filename, bytes, type }) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

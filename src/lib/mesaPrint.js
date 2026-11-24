import { escapeHtml } from "./printDocument.js";

const PNG = /^data:image\/png;base64,[a-z0-9+/=]+$/i;

export function printableTables(tables) {
  return (tables || []).filter((table) => {
    const channel = table?.channel_type || "piso";
    const floor = channel === "piso" || channel === "tablet";
    return table?.active !== false && floor;
  });
}

export function mesaPrintDocument({ restaurantName, cards }) {
  const name = escapeHtml(restaurantName || "El restaurante");
  const list = cards || [];
  const sections = list.map((card, index) => {
    const image = PNG.test(card?.image || "") ? card.image : "";
    const img = image ? `<img alt="" src="${image}" width="220" height="220" />` : "";
    const breakAfter = index < list.length - 1 ? "page" : "auto";
    return `<section style="break-after:${breakAfter};padding:24px;text-align:center;font-family:'Plus Jakarta Sans',system-ui,sans-serif"><p style="font-size:22px;font-weight:800">${name}</p><h1 style="font-size:48px;margin:12px 0">Mesa ${escapeHtml(card?.number)}</h1>${img}<p style="font-size:20px">Escanea para pedir</p></section>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR de mesas</title></head><body onload="window.print()">${sections}</body></html>`;
}

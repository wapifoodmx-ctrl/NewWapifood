/** Elige el data-tour que sí se puede ver. En el teléfono hay copias
 *  (menú lateral y barra de abajo, el texto de ayuda y el botón real).
 *  La copia de abajo de la pantalla no gana si hay otra a la vista. */

function isHidden(node) {
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function" && node.nodeType === 1) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return true;
  }
  return Boolean(node.hidden);
}

function boxOf(node) {
  const box = node.getBoundingClientRect();
  const left = box.left;
  const top = box.top;
  const width = box.width;
  const height = box.height;
  return {
    left,
    top,
    width,
    height,
    right: box.right ?? left + width,
    bottom: box.bottom ?? top + height,
  };
}

function isControl(node) {
  const tag = node.tagName;
  return tag === "BUTTON" || tag === "A" || node.getAttribute?.("role") === "button";
}

export function rankTourNodes(nodes, viewport, hitAt = () => null) {
  const width = viewport.width || 0;
  const height = viewport.height || 0;
  const ranked = [];

  for (const node of nodes) {
    if (!node || isHidden(node)) continue;
    const box = boxOf(node);
    if (box.width < 8 || box.height < 8) continue;
    const visibleW = Math.max(0, Math.min(box.right, width) - Math.max(box.left, 0));
    const visibleH = Math.max(0, Math.min(box.bottom, height) - Math.max(box.top, 0));
    const area = visibleW * visibleH;
    let hittable = false;
    if (area > 0) {
      const hit = hitAt(box.left + box.width / 2, box.top + box.height / 2);
      hittable = Boolean(hit && (hit === node || node.contains?.(hit)));
    }
    const offTop = Math.max(0, -box.bottom);
    const offBottom = Math.max(0, box.top - height);
    ranked.push({
      node,
      area,
      hittable,
      control: isControl(node),
      distance: area > 0 ? 0 : offTop + offBottom,
    });
  }

  const onScreen = ranked.filter((item) => item.area >= 16);
  const pool = onScreen.length ? onScreen : ranked;
  pool.sort((a, b) => {
    if (a.hittable !== b.hittable) return a.hittable ? -1 : 1;
    if (a.control !== b.control) return a.control ? -1 : 1;
    if (b.area !== a.area) return b.area - a.area;
    return a.distance - b.distance;
  });
  return pool[0]?.node || null;
}

export function pickTourElement(selector, doc = document, view = window) {
  const viewport = view.visualViewport;
  return rankTourNodes(
    [...doc.querySelectorAll(`[data-tour="${selector}"]`)],
    {
      width: viewport?.width || view.innerWidth,
      height: viewport?.height || view.innerHeight,
    },
    (x, y) => doc.elementFromPoint?.(x, y) || null,
  );
}

export function popoverSide(box, viewport) {
  const height = viewport.height || 1;
  const middle = box.top + box.height / 2;
  const limit = (viewport.width || 0) < 768 ? height * 0.58 : height * 0.72;
  return middle > limit ? "top" : "bottom";
}

/** Mete la tarjeta en la zona visible. bottomReserve es la barra de abajo.
 *  driver.js escribe style.top con el mismo espacio que getBoundingClientRect. */
export function fitTourPopover(wrapper, viewport) {
  const box = wrapper.getBoundingClientRect();
  const width = viewport.width || 0;
  const height = viewport.height || 0;
  const maxRight = width - 8;
  const maxBottom = height - 8 - (viewport.bottomReserve || 0);
  let left = box.left;
  let top = box.top;
  if (box.right > maxRight) left -= box.right - maxRight;
  if (left < 8) left = 8;
  if (box.bottom > maxBottom) top -= box.bottom - maxBottom;
  if (top < 8) top = 8;
  return { left, top };
}

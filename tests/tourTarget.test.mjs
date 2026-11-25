import assert from "node:assert/strict";
import test from "node:test";
import { fitTourPopover, popoverSide, rankTourNodes } from "../src/lib/tourTarget.js";

function node({ top, left, width, height, tag = "DIV", hidden = false, containsHit = false }) {
  const self = {
    tagName: tag,
    hidden,
    nodeType: undefined,
    getAttribute: () => null,
    getBoundingClientRect: () => ({
      top,
      left,
      width,
      height,
      right: left + width,
      bottom: top + height,
    }),
    contains: (hit) => containsHit && hit === self,
  };
  return self;
}

const phone = { width: 390, height: 844 };

test("en el teléfono gana el botón visible, no la copia de abajo ni el párrafo", () => {
  const off = node({ top: 900, left: 16, width: 200, height: 56, tag: "BUTTON" });
  const hint = node({ top: 200, left: 16, width: 300, height: 40 });
  const dock = node({ top: 720, left: 16, width: 220, height: 56, tag: "BUTTON", containsHit: true });
  const picked = rankTourNodes([off, hint, dock], phone, () => dock);
  assert.equal(picked, dock);
});

test("ignora el menú escondido y usa la barra de abajo", () => {
  const side = node({ top: 0, left: 0, width: 248, height: 800, hidden: true });
  const tabs = node({ top: 780, left: 0, width: 390, height: 64, containsHit: true });
  assert.equal(rankTourNodes([side, tabs], phone, () => tabs), tabs);
});

test("si el único blanco está abajo, igual lo devuelve para poder hacer scroll", () => {
  const below = node({ top: 1100, left: 20, width: 120, height: 48, tag: "BUTTON" });
  assert.equal(rankTourNodes([below], phone, () => null), below);
});

test("el aviso de un botón pegado abajo se abre hacia arriba", () => {
  assert.equal(popoverSide({ top: 740, height: 56 }, phone), "top");
  assert.equal(popoverSide({ top: 80, height: 48 }, phone), "bottom");
});

test("la tarjeta no se sale por la derecha ni se mete bajo la barra", () => {
  const wrapper = {
    getBoundingClientRect: () => ({ left: 280, top: 760, right: 560, bottom: 900, width: 280, height: 140 }),
  };
  const placed = fitTourPopover(wrapper, { ...phone, bottomReserve: 88 });
  assert.equal(placed.left, 102);
  assert.equal(placed.top, 608);
});

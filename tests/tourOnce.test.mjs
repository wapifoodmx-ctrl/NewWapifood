import assert from "node:assert/strict";
import test from "node:test";
import { screenFlag, shouldAutoShowTour, tourForPath } from "../src/lib/tours.js";

test("la bandera es de esa pantalla", () => {
  assert.equal(screenFlag("/pos"), "pantalla:/pos");
  assert.equal(screenFlag(""), "");
});

test("la guía sola sale solo si esa pantalla y ese recorrido están nuevos", () => {
  assert.equal(shouldAutoShowTour(false, false), true);
  assert.equal(shouldAutoShowTour(true, false), false);
  assert.equal(shouldAutoShowTour(false, true), false);
});

test("cada pantalla tiene un solo recorrido automático", () => {
  assert.equal(tourForPath("/pos", "piso"), "venta");
  assert.equal(tourForPath("/cocina", "cocina"), "cocina");
  assert.equal(tourForPath("/dashboard", "owner"), "bienvenida");
  assert.equal(tourForPath("/mesas", "owner"), "mesa-qr");
});

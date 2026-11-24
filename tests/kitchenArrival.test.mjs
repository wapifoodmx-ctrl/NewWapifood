import assert from "node:assert/strict";
import test from "node:test";
import { kitchenArrival } from "../src/lib/brand.js";

test("cocina dice Llegó de caja y nunca la palabra pos", () => {
  for (const source of ["pos", "POS", "", null, undefined, "otro"]) {
    const text = kitchenArrival(source);
    assert.equal(text, "Llegó de caja");
    assert.equal(text.toLowerCase().includes("pos"), false);
  }
  assert.equal(kitchenArrival("mesero"), "Llegó de Mesero");
  assert.equal(kitchenArrival("mesa"), "Llegó de Mesa");
  assert.equal(kitchenArrival("web_menu"), "Llegó de Menú web");
});

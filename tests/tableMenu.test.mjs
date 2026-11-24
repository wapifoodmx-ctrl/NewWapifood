import assert from "node:assert/strict";
import test from "node:test";
import {
  addCartLine,
  billLineTotal,
  cartCount,
  cartTotal,
  changeQty,
  changeRequestQty,
  itemWord,
  menuCategories,
  modifierIssue,
  productsInCategory,
  requestItemNames,
  requestPayload,
  requestWord,
  sendNote,
  toggleTableModifier,
} from "../src/lib/tableMenu.js";

const taco = { id: "p1", name: "Taco", price: 25, category: "Tacos" };
const agua = { id: "p2", name: "Agua", price: 20, category: "" };

test("agrupa categorías en el orden de la carta y manda lo vacío a Otros", () => {
  assert.deepEqual(menuCategories([taco, agua, { ...taco, id: "p3" }]), ["Tacos", "Otros"]);
  assert.deepEqual(productsInCategory([taco, agua], "Otros"), [agua]);
  assert.deepEqual(productsInCategory([taco, agua], ""), [taco, agua]);
});

test("exige el mínimo de un grupo obligatorio y respeta el máximo", () => {
  const groups = [{ product_id: "p1", group_id: "g1", group: "Salsa", min: 0, max: 1, required: true }];
  assert.equal(modifierIssue(groups, []), "En Salsa elige al menos 1.");
  assert.equal(modifierIssue(groups, [{ option_id: "o1", group_id: "g1" }]), "");
  const extras = [{ product_id: "p1", group_id: "g2", group: "Extras", min: 0, max: 1, required: false }];
  assert.match(modifierIssue(extras, [
    { option_id: "a", group_id: "g2" },
    { option_id: "b", group_id: "g2" },
  ]), /máximo es 1/);
});

test("un grupo de una opción reemplaza la anterior y uno de varias se detiene en el máximo", () => {
  const radio = { group_id: "g1", group: "Salsa", max: 1 };
  const once = toggleTableModifier([], { id: "roja", name: "Roja", price: 0 }, radio);
  const swapped = toggleTableModifier(once, { id: "verde", name: "Verde", price: 5 }, radio);
  assert.deepEqual(swapped.map((item) => item.option_id), ["verde"]);
  const off = toggleTableModifier(swapped, { id: "verde", name: "Verde", price: 5 }, radio);
  assert.equal(off.length, 0);
  const checks = { group_id: "g2", group: "Extras", max: 2 };
  const start = [
    { option_id: "a", group_id: "g2", name: "Queso", extra_price: 8 },
    { option_id: "c", group_id: "g2", name: "Crema", extra_price: 4 },
  ];
  const kept = toggleTableModifier(start, { id: "b", name: "Tocino", price: 10 }, checks);
  assert.deepEqual(kept.map((item) => item.option_id), ["a", "c"]);
  const open = toggleTableModifier(start, { id: "b", name: "Tocino", price: 10 }, { group_id: "g2", max: null });
  assert.equal(open.length, 3);
});

test("suma cantidades iguales y quita la línea al llegar a cero", () => {
  const line = { product_id: "p1", name: "Taco", price: 25, qty: 1, notes: "Sin cebolla", modKey: "verde", modifiers: [{ extra_price: 5 }] };
  const merged = addCartLine([line], { ...line, qty: 2 });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].qty, 3);
  const other = addCartLine(merged, { ...line, notes: "", modKey: "", modifiers: [] });
  assert.equal(other.length, 2);
  assert.deepEqual(changeQty(other, 0, -3), [other[1]]);
  assert.equal(cartCount(merged), 3);
  assert.equal(cartTotal(merged), 90);
});

test("la cuenta y los avisos dicen el estado con palabras", () => {
  assert.equal(itemWord("preparado").word, "Listo");
  assert.equal(itemWord("pendiente").word, "En cocina");
  assert.equal(requestWord("cuenta").word, "Cuenta pedida");
  assert.equal(sendNote(true), "Pedido enviado a cocina.");
  assert.match(sendNote(false), /Caja lo revisa/);
  assert.deepEqual(requestItemNames([{ qty: 2, name: "Taco" }]), ["2 × Taco"]);
  assert.equal(billLineTotal({ qty: 2, price: 25, extras: [{ extra_price: 5 }] }), 60);
});

test("caja cambia cantidades sin mandar el precio del cliente", () => {
  const items = [
    { product_id: "p1", name: "Taco", qty: 2, price: 1, notes: "sin cebolla", modifiers: [{ option_id: "o1", extra_price: 99 }] },
    { product_id: "p2", name: "Agua", qty: 1, price: 20 },
  ];
  const less = changeRequestQty(items, 0, -1);
  assert.equal(less[0].qty, 1);
  assert.equal(less[0].price, 1);
  assert.equal(changeRequestQty(less, 0, -1).length, 1);
  const capped = changeRequestQty([{ product_id: "p1", qty: 20 }], 0, 5);
  assert.equal(capped[0].qty, 20);
  assert.deepEqual(requestPayload(items), [
    { product_id: "p1", qty: 2, notes: "sin cebolla", modifiers: [{ option_id: "o1" }] },
    { product_id: "p2", qty: 1, notes: "", modifiers: [] },
  ]);
});

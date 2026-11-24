import assert from "node:assert/strict";
import test from "node:test";
import { mesaPrintDocument, printableTables } from "../src/lib/mesaPrint.js";

test("el impreso lleva el local, el número y la frase, y el QR no lleva token", () => {
  const html = mesaPrintDocument({
    restaurantName: "Brasa <script>",
    cards: [{ number: 4, image: "data:image/png;base64,aaaa" }],
  });
  assert.match(html, /Brasa &lt;script&gt;/);
  assert.match(html, /Mesa 4/);
  assert.match(html, /Escanea para pedir/);
  assert.doesNotMatch(html, /token|uuid|script>/i);
  assert.match(html, /data:image\/png;base64,aaaa/);
});

test("solo se imprimen las mesas de piso o tablet que siguen activas", () => {
  const tables = [
    { number: 1, channel_type: "piso", active: true },
    { number: 2, channel_type: "caja", active: true },
    { number: 3, channel_type: "kiosko", active: true },
    { number: 4, channel_type: "tablet", active: false },
    { number: 5, channel_type: "tablet", active: true },
  ];
  assert.deepEqual(printableTables(tables).map((table) => table.number), [1, 5]);
});

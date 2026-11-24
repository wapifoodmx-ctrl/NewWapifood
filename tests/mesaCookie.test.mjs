import assert from "node:assert/strict";
import test from "node:test";
import { mesaCookieName, mesaGateTarget, mesaSessionDecision } from "../src/lib/mesaCookie.js";

const token = "a".repeat(64);

test("la cookie es de esa mesa y no acepta un slug raro", () => {
  assert.equal(mesaCookieName("Brasa-Centro", "4"), "mesa_brasa-centro_4");
  assert.equal(mesaCookieName("brasa", "04"), "mesa_brasa_4");
  assert.equal(mesaCookieName("../admin", "1"), "");
  assert.equal(mesaCookieName("brasa", "mesa"), "");
});

test("con sesión abierta siempre pasa por /sesion para guardar la cookie", () => {
  assert.equal(mesaGateTarget({ open: true, hasCookie: false, lista: undefined }), "sesion");
  assert.equal(mesaGateTarget({ open: false, hasCookie: true, lista: undefined }), "sesion");
  assert.equal(mesaGateTarget({ open: false, hasCookie: true, lista: "1" }), "closed");
  assert.equal(mesaGateTarget({ open: false, hasCookie: false, lista: undefined }), "closed");
});

test("la cookie es httpOnly, vive solo en esa mesa y el token viejo no se reutiliza", () => {
  const open = mesaSessionDecision({ slug: "brasa", number: "4", open: true, token });
  assert.equal(open.location, "/brasa/mesa/4/" + token);
  assert.equal(open.cookie.name, "mesa_brasa_4");
  assert.equal(open.cookie.value, token);
  assert.equal(open.cookie.options.httpOnly, true);
  assert.equal(open.cookie.options.sameSite, "lax");
  assert.equal(open.cookie.options.path, "/brasa/mesa/4");
  assert.equal(open.cookie.options.maxAge, 60 * 60 * 12);
  assert.equal(open.cookie.options.secure, process.env.NODE_ENV === "production");

  const closed = mesaSessionDecision({ slug: "brasa", number: "4", open: false, token: "" });
  assert.equal(closed.location, "/brasa/mesa/4?lista=1");
  assert.equal(closed.cookie.value, "");
  assert.equal(closed.cookie.options.maxAge, 0);

  const injected = mesaSessionDecision({ slug: "brasa", number: "4", open: true, token: "https://evil.example/" + token });
  assert.equal(injected.ok, true);
  assert.match(injected.location, /\?lista=1$/);
});
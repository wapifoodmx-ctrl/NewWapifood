import { NextResponse } from "next/server";

/**
 * Webhook MP: confirma pagos.
 * En producción conviene validar el pago con la API de MP y activar el plan
 * con service role. Por ahora responde 200 para que MP no reintente en loop.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    // Log útil en Vercel
    console.log("MP webhook", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

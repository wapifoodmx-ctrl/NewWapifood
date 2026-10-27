import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/auth/confirmado";

  const supabase = await createClient();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(
          `${origin}/auth/confirmado?status=error&message=${encodeURIComponent(error.message)}`,
        );
      }
      return NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}status=ok`);
    }

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (error) {
        return NextResponse.redirect(
          `${origin}/auth/confirmado?status=error&message=${encodeURIComponent(error.message)}`,
        );
      }
      return NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}status=ok`);
    }
  } catch (e) {
    return NextResponse.redirect(
      `${origin}/auth/confirmado?status=error&message=${encodeURIComponent(e.message || "Error")}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/auth/confirmado?status=error&message=${encodeURIComponent("Enlace inválido o expirado")}`,
  );
}

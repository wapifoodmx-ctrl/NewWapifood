import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mesaSessionDecision } from "@/lib/mesaCookie";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { slug, number } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_table_gate", {
    p_slug: slug,
    p_number: Number(number),
  });
  const decision = mesaSessionDecision({
    slug,
    number,
    open: Boolean(data?.open),
    token: data?.token || "",
  });
  if (!decision.ok) return new NextResponse("Mesa no válida", { status: 400 });

  const response = NextResponse.redirect(new URL(decision.location, request.url));
  if (decision.cookie) {
    response.cookies.set(decision.cookie.name, decision.cookie.value, decision.cookie.options);
  }
  return response;
}

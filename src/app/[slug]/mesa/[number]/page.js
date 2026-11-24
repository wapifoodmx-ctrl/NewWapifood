import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClosedTable } from "@/components/TableOrder";
import { mesaCookieName, mesaGateTarget } from "@/lib/mesaCookie";

export const dynamic = "force-dynamic";

export default async function MesaQrPage({ params, searchParams }) {
  const { slug, number } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_table_gate", {
    p_slug: slug,
    p_number: Number(number),
  });
  const name = mesaCookieName(slug, number);
  const jar = await cookies();
  const hasCookie = Boolean(name && jar.get(name)?.value);
  const open = Boolean(data?.open && data?.token);
  if (name && mesaGateTarget({ open, hasCookie, lista: query?.lista }) === "sesion") {
    redirect(`/${slug}/mesa/${number}/sesion`);
  }
  return <ClosedTable slug={slug} number={number} name={data?.name || "El restaurante"} />;
}

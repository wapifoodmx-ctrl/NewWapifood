import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClosedTable } from "@/components/TableOrder";

export const dynamic = "force-dynamic";

export default async function MesaQrPage({ params }) {
  const { slug, number } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_table_gate", {
    p_slug: slug,
    p_number: Number(number),
  });
  if (data?.open && data?.token) {
    redirect(`/${slug}/mesa/${number}/${data.token}`);
  }
  return <ClosedTable slug={slug} number={number} name={data?.name || "El restaurante"} />;
}

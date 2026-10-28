export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { statusMeta } from "@/lib/orderStatus";
import { BeeperClient } from "@/components/BeeperClient";

export default async function PublicTicketPage({ params }) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id,status,public_code,source,opened_at,closed_at,cancel_reason,order_items(product_id,qty,unit_price),dining_tables(number),restaurant_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-parchment)] px-4">
        <div className="max-w-md border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-8 text-center">
          <h1 className="text-3xl">Ticket no encontrado</h1>
        </div>
      </div>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select("id,name")
    .eq("restaurant_id", order.restaurant_id);
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  const names = Object.fromEntries((products || []).map((p) => [p.id, p.name]));
  const total = (order.order_items || []).reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.qty),
    0,
  );
  const meta = statusMeta(order.status);

  return (
    <BeeperClient
      orderId={order.id}
      initialStatus={order.status}
      restaurantName={restaurant?.name || "Wapifood"}
      tableNumber={order.dining_tables?.number}
      publicCode={order.public_code}
      cancelReason={order.cancel_reason}
      items={(order.order_items || []).map((i) => ({
        name: names[i.product_id] || "Producto",
        qty: i.qty,
        line: Number(i.unit_price) * Number(i.qty),
      }))}
      total={total}
      metaLabel={meta.label}
      metaDetail={meta.detail}
    />
  );
}

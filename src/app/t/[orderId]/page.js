export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { BeeperClient } from "@/components/BeeperClient";

export default async function PublicTicketPage({ params }) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id,status,public_code,source,opened_at,closed_at,cancel_reason,restaurant_id,order_items(product_id,qty,unit_price,status,notes),dining_tables(number)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4efe6] px-4">
        <p className="text-center text-lg">Pedido no encontrado.</p>
      </div>
    );
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  const productIds = (order.order_items || []).map((i) => i.product_id);
  let nameMap = {};
  if (productIds.length) {
    const { data: products } = await supabase.from("products").select("id,name").in("id", productIds);
    nameMap = Object.fromEntries((products || []).map((p) => [p.id, p.name]));
  }

  const items = (order.order_items || []).map((i) => ({
    product_id: i.product_id,
    name: nameMap[i.product_id] || "Producto",
    qty: i.qty,
    unit_price: i.unit_price,
    status: i.status || "pendiente",
    notes: i.notes,
  }));

  const total = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.qty), 0);

  return (
    <BeeperClient
      orderId={order.id}
      initialStatus={order.status}
      restaurantName={restaurant?.name}
      tableNumber={order.dining_tables?.number}
      publicCode={order.public_code}
      cancelReason={order.cancel_reason}
      items={items}
      total={total}
    />
  );
}

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { BeeperClient } from "@/components/BeeperClient";

export default async function PublicTicketPage({ params }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_ticket", { p_order: orderId });

  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4efe6] px-4">
        <p className="text-center text-lg">Pedido no encontrado.</p>
      </div>
    );
  }

  const items = data.items || [];
  const total = items.reduce((sum, item) => {
    if ((item.status || "pendiente") === "cancelado") return sum;
    const extras = (item.extras || []).reduce((s, extra) => s + Number(extra.extra_price || 0), 0);
    return sum + (Number(item.unit_price) + extras) * Number(item.qty);
  }, 0);

  return (
    <BeeperClient
      orderId={data.id}
      initialStatus={data.status}
      restaurantName={data.restaurant_name}
      tableNumber={data.table_number}
      publicCode={data.public_code}
      cancelReason={data.cancel_reason}
      items={items}
      total={total}
    />
  );
}

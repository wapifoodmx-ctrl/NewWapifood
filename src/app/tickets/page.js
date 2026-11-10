export const dynamic = "force-dynamic";

import { AppShell } from "@/components/AppShell";
import { TicketsBoard } from "@/components/TicketsBoard";
import { requireTenantOperational } from "@/lib/auth";

export default async function TicketsPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantOperational();

  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Tickets" operational={operational} setupOnly={setupOnly}>
        <p>Sin restaurante.</p>
      </AppShell>
    );
  }

  const rid = membership.restaurant_id;

  const [{ data: orders, error: ordersError }, { data: products }, { data: profile }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,status,method,source,restaurant_id,tip_amount,tip_method,refunded_amount,refunded_at,opened_at,closed_at,table_id,public_code,folio,mp_payment_id,cancel_reason,needs_confirmation,order_type,customer_phone,delivery_address,discount_amount,order_items(id,product_id,qty,unit_price,status,notes,discount_type,discount_value,stock_resolution,refunded_amount,refunded_at),order_payments(method,amount,folio,mp_payment_id),dining_tables(number)",
      )
      .eq("restaurant_id", rid)
      .order("opened_at", { ascending: false })
      .limit(80),
    supabase.from("products").select("id,name").eq("restaurant_id", rid),
    supabase.from("restaurant_profiles").select("iva_enabled").eq("restaurant_id", rid).maybeSingle(),
  ]);

  const productNames = Object.fromEntries((products || []).map((p) => [p.id, p.name]));

  return (
    <AppShell
      title="Tickets"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-sm text-[var(--color-espresso)]">
        Historial y seguimiento tipo beeper. Cada orden tiene enlace público{" "}
        <code className="bg-[var(--color-paper)] px-1">/t/…</code> para el cliente.
      </p>
      {ordersError ? (
        <div className="mb-4 border border-[var(--color-wine)] bg-[var(--color-paper)] p-4 text-sm text-[var(--color-wine)]">
          Error: {ordersError.message}
        </div>
      ) : null}
      <TicketsBoard orders={orders || []} productNames={productNames} ivaEnabled={!!profile?.iva_enabled} />
    </AppShell>
  );
}

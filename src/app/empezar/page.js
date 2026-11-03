export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireTenantSetup } from "@/lib/auth";

export default async function EmpezarPage() {
  const { supabase, membership, operational, setupOnly, plan } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Primeros pasos" operational={operational} setupOnly={setupOnly}>
        <p>Todavía no hay un restaurante en tu cuenta.</p>
      </AppShell>
    );
  }
  const rid = membership.restaurant_id;
  const [profile, categories, products, tables] = await Promise.all([
    supabase.from("restaurant_profiles").select("phone,address").eq("restaurant_id", rid).maybeSingle(),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
    supabase.from("dining_tables").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("active", true),
  ]);

  const steps = [
    {
      ok: Boolean(profile.data?.phone || profile.data?.address || membership.restaurants?.name),
      title: "Ponle nombre y teléfono a tu local",
      href: "/config",
      action: "Completar datos",
    },
    {
      ok: (categories.count || 0) > 0,
      title: "Crea una categoría, por ejemplo Tacos",
      href: "/carta",
      action: "Ir a platillos",
    },
    {
      ok: (products.count || 0) > 0,
      title: "Agrega el primer platillo con precio",
      href: "/carta",
      action: "Agregar platillo",
    },
    {
      ok: (tables.count || 0) > 0,
      title: "Abre al menos una mesa o la caja",
      href: "/mesas",
      action: "Crear mesa",
    },
    {
      ok: plan?.status === "active",
      title: "Activa un plan para poder cobrar",
      href: "/pagos",
      action: "Ver planes",
    },
  ];
  const pending = steps.find((step) => !step.ok);

  return (
    <AppShell
      title="Primeros pasos"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <p className="mb-4 text-base text-[var(--color-muted)]">
        Sigue esta lista para llegar a tu primera venta. No tienes que hacerlo todo hoy.
      </p>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-3 border border-[var(--color-warm-stone)] bg-[var(--color-paper)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--color-muted)]">Paso {index + 1}</p>
              <p className="text-xl font-normal">{step.ok ? "Listo. " : ""}{step.title}</p>
            </div>
            {step.ok ? (
              <p className="text-sm font-semibold text-[var(--color-sage)]">Hecho</p>
            ) : (
              <Link href={step.href} className="inline-flex min-h-12 items-center justify-center bg-[var(--color-onyx-warm)] px-4 text-sm font-semibold text-[var(--color-parchment)]">
                {step.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {pending ? null : (
        <Link href="/pos" className="mt-4 inline-flex min-h-12 items-center bg-[var(--color-onyx-warm)] px-5 text-sm font-semibold text-[var(--color-parchment)]">
          Ir a la caja
        </Link>
      )}
    </AppShell>
  );
}

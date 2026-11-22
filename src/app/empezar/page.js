export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { requireTenantSetup } from "@/lib/auth";

export default async function EmpezarPage() {
  const { supabase, membership, operational, setupOnly } = await requireTenantSetup();
  if (!membership?.restaurant_id) {
    return (
      <AppShell title="Primeros pasos" operational={operational} setupOnly={setupOnly}>
        <p className="text-lg">Todavía no hay un restaurante en tu cuenta. Cierra sesión y crea una cuenta nueva.</p>
      </AppShell>
    );
  }
  const rid = membership.restaurant_id;
  const [profile, categories, products, tables, paid] = await Promise.all([
    supabase.from("restaurant_profiles").select("phone,address").eq("restaurant_id", rid).maybeSingle(),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
    supabase.from("dining_tables").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("active", true),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("status", "pagada"),
  ]);

  const steps = [
    {
      id: "datos",
      ok: Boolean(profile.data?.phone || profile.data?.address),
      title: "Datos de tu local",
      detail: "Nombre, teléfono y dirección. Salen en el menú y ayudan a que te encuentren.",
      href: "/config",
      action: "Completar datos",
    },
    {
      id: "platillos",
      ok: (categories.count || 0) > 0 && (products.count || 0) > 0,
      title: "Primeros productos",
      detail: "Crea una categoría, por ejemplo Tacos, y un producto con precio. La foto puede esperar.",
      href: "/carta",
      action: "Agregar productos",
    },
    {
      id: "mesas",
      ok: (tables.count || 0) > 0,
      title: "Punto de venta y mesas",
      detail: "El mostrador es el punto de venta. Si atiendes mesas, crea al menos una. El precio del producto es lo que cobras.",
      href: "/mesas",
      action: "Revisar mesas",
    },
    {
      id: "venta",
      ok: (paid.count || 0) > 0,
      title: "Una venta de prueba",
      detail: operational
        ? "En el punto de venta toca un producto y cobra en efectivo. Si fue de prueba, cancela la cuenta."
        : "Para cobrar necesitas un plan. Puedes saltar este paso y activarlo cuando quieras vender de verdad.",
      href: operational ? "/pos" : "/pagos",
      action: operational ? "Hacer la venta" : "Ver planes",
    },
  ];

  return (
    <AppShell
      title="Primeros pasos"
      restaurantName={membership.restaurants?.name}
      role={membership.role}
      operational={operational}
      setupOnly={setupOnly}
    >
      <nav className="mb-4 grid gap-2 sm:grid-cols-2" aria-label="Para dejar el local listo">
        <Link data-tour="nav-carta" className="btn-ghost inline-flex h-12 items-center px-4" href="/carta">Productos</Link>
                <Link data-tour="nav-mesas" className="btn-ghost inline-flex h-12 items-center px-4" href="/mesas">Mesas</Link>
                <Link data-tour="nav-equipo" className="btn-ghost inline-flex h-12 items-center px-4" href="/equipo">Equipo</Link>
                <Link data-tour="nav-insumos" className="btn-ghost inline-flex h-12 items-center px-4" href="/insumos">Inventario</Link>
      </nav>
      <OnboardingWizard steps={steps} canSell={operational} />
    </AppShell>
  );
}

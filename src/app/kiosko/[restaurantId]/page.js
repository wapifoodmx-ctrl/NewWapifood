export const dynamic = "force-dynamic";

import { DigitalMenu } from "@/components/DigitalMenu";
import { loadPublicMenu } from "@/lib/publicMenu";
import { createClient } from "@/lib/supabase/server";

export default async function KioskPage({ params }) {
  const { restaurantId } = await params;
  const data = await loadPublicMenu(restaurantId);
  if (!data) {
    return <div className="grid min-h-screen place-items-center">Kiosko no disponible</div>;
  }
  if (!data.canOperate) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4efe6] px-4">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Kiosko inactivo</h1>
          <p className="mt-2 text-black/60">Se requiere un plan activo.</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  let kioskTable = data.tables.find((t) => t.channel_type === "kiosko") || null;
  if (!kioskTable) {
    const { data: kid } = await supabase.rpc("ensure_kiosk_table", {
      p_restaurant: restaurantId,
    });
    if (kid) {
      kioskTable = { id: kid, number: 99, channel_type: "kiosko" };
    }
  }

  return (
    <DigitalMenu
      restaurant={data.restaurant}
      theme={data.theme}
      products={data.products}
      categories={data.categories}
      tables={data.tables}
      mode="kiosk"
      requireConfirmCode={false}
      deliveryEnabled={!!data.profile?.delivery_enabled}
      orderSource="kiosko"
      fixedTableId={kioskTable?.id || null}
      productExtras={data.extras || []}
    />
  );
}

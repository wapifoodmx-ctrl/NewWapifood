export const dynamic = "force-dynamic";

import { DigitalMenu } from "@/components/DigitalMenu";
import { loadPublicMenu } from "@/lib/publicMenu";

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
          <p className="mt-2 text-black/60">Se requiere un plan activo de Wapifood para operar el kiosko.</p>
        </div>
      </div>
    );
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
    />
  );
}

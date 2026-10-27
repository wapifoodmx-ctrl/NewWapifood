export const dynamic = "force-dynamic";

import { DigitalMenu } from "@/components/DigitalMenu";
import { loadPublicMenu } from "@/lib/publicMenu";

export default async function PublicMenuPage({ params }) {
  const { restaurantId } = await params;
  const data = await loadPublicMenu(restaurantId);
  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4efe6] px-4">
        <div className="max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold">Menú no encontrado</h1>
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
      mode="client"
      requireConfirmCode={data.profile?.require_confirm_code !== false}
      deliveryEnabled={!!data.profile?.delivery_enabled}
    />
  );
}

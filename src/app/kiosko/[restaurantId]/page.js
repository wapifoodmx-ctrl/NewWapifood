export const dynamic = "force-dynamic";

import { DigitalMenu } from "@/components/DigitalMenu";
import { loadPublicMenu } from "@/lib/publicMenu";

export default async function KioskPage({ params }) {
  const { restaurantId } = await params;
  const data = await loadPublicMenu(restaurantId);

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4efe6] px-4">
        <p className="text-lg">Kiosko no disponible</p>
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
    />
  );
}

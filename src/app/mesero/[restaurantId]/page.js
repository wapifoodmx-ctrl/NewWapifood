export const dynamic = "force-dynamic";

import { WaiterMenu } from "@/components/WaiterMenu";
import { loadPublicMenu } from "@/lib/publicMenu";

export default async function MeseroPage({ params }) {
  const { restaurantId } = await params;
  const data = await loadPublicMenu(restaurantId);
  if (!data) {
    return <div className="grid min-h-screen place-items-center">Restaurante no encontrado</div>;
  }
  return (
    <WaiterMenu
      restaurantId={data.restaurant.id}
      restaurantName={data.restaurant.name}
      products={data.products}
      categories={data.categories}
      tables={data.tables}
    />
  );
}

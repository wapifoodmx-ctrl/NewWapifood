export const dynamic = "force-dynamic";

import { WaiterApp } from "@/components/WaiterApp";
import { loadPublicMenu } from "@/lib/publicMenu";

export default async function MeseroRestaurantPage({ params }) {
  const { restaurantId } = await params;
  const data = await loadPublicMenu(restaurantId);
  if (!data) {
    return <div className="grid min-h-screen place-items-center">Restaurante no encontrado</div>;
  }
  return (
    <WaiterApp
      restaurantId={data.restaurant.id}
      restaurantName={data.restaurant.name}
      products={data.products}
      categories={data.categories}
      tables={data.tables}
      canOperate={data.canOperate}
    />
  );
}

export const dynamic = "force-dynamic";

import { ProductScreen } from "@/components/ProductScreen";
import { createClient } from "@/lib/supabase/server";

export default async function ListaPublicaPage({ params }) {
  const { listId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_screen_list", { p_list: listId });

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <p className="max-w-md text-2xl">La pantalla de listas todavía no está en la base. Aplica la migración y vuelve a abrir este enlace.</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <p className="text-2xl">No encontramos esa lista.</p>
      </main>
    );
  }

  return (
    <ProductScreen
      restaurant={data.restaurant}
      listName={data.list}
      products={data.products || []}
    />
  );
}

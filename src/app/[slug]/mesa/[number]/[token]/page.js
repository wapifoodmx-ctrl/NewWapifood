import { TableOrder } from "@/components/TableOrder";

export const dynamic = "force-dynamic";

export default async function MesaTokenPage({ params }) {
  const { slug, number, token } = await params;
  return <TableOrder slug={slug} number={number} token={token} />;
}

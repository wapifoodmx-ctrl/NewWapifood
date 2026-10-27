export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

/** Entrada genérica: el mesero necesita el id del restaurante (QR/link del dueño). */
export default function MeseroIndex() {
  redirect("/");
}

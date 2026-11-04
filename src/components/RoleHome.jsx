import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { roleLabel, tilesForRole } from "@/lib/modules";

const COPY = {
  owner: "Esto es lo que más se usa en el día. Lo demás está en el menú.",
  admin: "Opera el piso o entra a la carta y al equipo.",
  piso: "Tu lugar es la caja y las mesas.",
  cocina: "Tu lugar es la cocina. Las comandas nuevas llegan solas.",
};

export function RoleHome({ role, restaurantName }) {
  const tiles = tilesForRole(role);
  return (
    <section className="mb-6" aria-label="Accesos de tu rol">
      <p className="text-lg text-[var(--ink-soft)]">
        Hola{restaurantName ? `, ${restaurantName}` : ""}. {roleLabel(role) ? `Entraste como ${roleLabel(role)}.` : ""} {COPY[role] || COPY.owner}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.id} href={tile.href} className="role-tile">
            <span className="role-ico">
              <Icon name={tile.icon} size={28} />
            </span>
            <span>
              <strong className="block text-[var(--ink)]">{tile.title}</strong>
              <span>{tile.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

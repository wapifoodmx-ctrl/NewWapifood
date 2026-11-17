/** Guías cortas. Cada paso apunta a data-tour, no a una clase que pueda cambiar. */

export const TOURS = {
  bienvenida: {
    title: "Bienvenida",
    roles: ["owner", "admin", "piso", "cocina"],
    paths: ["/dashboard", "/pos", "/cocina"],
    steps: [
      { tour: "menu", title: "Este es el menú", text: "Aquí están las pantallas de tu trabajo." },
      { tour: "local", title: "Tu local", text: "Arriba ves el nombre del restaurante y tu puesto." },
      { tour: "buscar", title: "Buscar", text: "Toca la lupa. En la computadora también sirve Control + K." },
      { tour: "ayuda", title: "Ayuda", text: "Si te atoras, toca Ayuda. Alguien te explica con palabras simples." },
    ],
  },
  venta: {
    title: "Primera venta",
    roles: ["owner", "admin", "piso"],
    paths: ["/pos"],
    steps: [
      { tour: "pos-mesas", title: "Elige una mesa", text: "Toca una mesa libre. Así empieza la cuenta.", interactive: true },
      { tour: "pos-platillos", title: "Agrega un platillo", text: "Un toque en el platillo lo pone en la cuenta.", interactive: true },
      { tour: "pos-cocina", title: "A cocina", text: "Cuando esté listo el pedido, tócalo para enviarlo.", interactive: true },
      { tour: "pos-cobrar", title: "Cobrar", text: "Toca Cobrar. Elige efectivo, tarjeta u otro tipo de pago.", interactive: true },
    ],
  },
  cocina: {
    title: "Cocina",
    roles: ["owner", "admin", "piso", "cocina"],
    paths: ["/cocina"],
    steps: [
      { tour: "cocina-listas", title: "Las listas", text: "Por preparar, domicilio o ya listos. Toca una para ver solo eso." },
      { tour: "cocina-comandas", title: "La comanda", text: "Aquí ves la mesa y los platillos, en grande." },
      { tour: "cocina-listo", title: "Marcar listo", text: "Cuando el platillo salga, toca Listo." },
    ],
  },
  turno: {
    title: "Turno y corte",
    roles: ["owner", "admin", "piso"],
    paths: ["/turno"],
    steps: [
      { tour: "turno-abrir", title: "Abrir la caja", text: "Escribe el dinero con el que empiezas. Luego toca Abrir caja." },
      { tour: "turno-parcial", title: "Corte parcial", text: "Cuenta el cajón sin cerrar. Sirve a media tarde." },
      { tour: "turno-dia", title: "Corte del día", text: "Este sí cierra la caja. Revisa la diferencia antes de confirmar." },
    ],
  },
  "que-paso": {
    title: "¿Qué pasó?",
    roles: ["owner", "admin", "piso"],
    paths: ["/pos", "/tickets"],
    steps: [
      { tour: "que-paso", title: "Si algo salió mal", text: "Toca ¿Qué pasó? No hace falta adivinar botones.", interactive: true },
      { tour: "que-paso-opciones", title: "Elige qué pasó", text: "Puedes cancelar la cuenta, quitar platillos o devolver dinero." },
      { tour: "que-paso-dinero", title: "El dinero", text: "Nada, una parte o todo. En efectivo sale del cajón. Con tarjeta queda pendiente." },
    ],
  },
  "mesa-qr": {
    title: "Abrir mesa y QR",
    roles: ["owner", "admin", "piso"],
    paths: ["/mesas"],
    steps: [
      { tour: "qr-abrir", title: "Abre la mesa", text: "Sin esto, el celular no puede pedir." },
      { tour: "qr-imprimir", title: "Imprime el QR", text: "Se imprime una vez. No cambia. Escanea para pedir." },
    ],
  },
  negocio: {
    title: "Configura el local",
    roles: ["owner", "admin"],
    paths: ["/empezar", "/config"],
    steps: [
      { tour: "nav-carta", title: "La carta", text: "Aquí pones platillos y precios." },
      { tour: "nav-mesas", title: "Las mesas", text: "Arma el salón antes de vender." },
      { tour: "nav-equipo", title: "El equipo", text: "Invita a quien cobra, cocina o administra." },
      { tour: "nav-insumos", title: "El inventario", text: "Anota lo que hay en bodega. Así no se acaba sin aviso." },
    ],
  },
};

export function homeTour(pathname, role) {
  const key = role || "owner";
  const home = key === "cocina" ? "/cocina" : key === "piso" ? "/pos" : "/dashboard";
  return pathname === home && TOURS.bienvenida.roles.includes(key) ? "bienvenida" : null;
}

export function tourForPath(pathname, role) {
  const key = role || "owner";
  return Object.entries(TOURS).find(([id, tour]) => {
    if (id === "bienvenida" || !tour.roles.includes(key)) return false;
    return tour.paths.some((path) => pathname === path);
  })?.[0] || homeTour(pathname, key);
}

export function toursForRole(role) {
  const key = role || "owner";
  return Object.entries(TOURS)
    .filter(([, tour]) => tour.roles.includes(key))
    .map(([id, tour]) => ({ id, title: tour.title }));
}

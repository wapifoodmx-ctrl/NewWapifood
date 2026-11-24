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
      { tour: "pos-mesas", title: "El mostrador ya está abierto", text: "Punto de venta es el mostrador. Toca una mesa solo si el pedido es de salón.", interactive: true },
      { tour: "pos-platillos", title: "Agrega un producto", text: "Un toque en el producto lo pone en la cuenta.", interactive: true },
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
      { tour: "qr-abrir", title: "Abre la mesa", text: "El QR impreso no pide solo. Caja abre la sesión. El pedido del celular llega como «Por aceptar». Al cobrar, el token se apaga." },
      { tour: "qr-imprimir", title: "Imprime el QR", text: "Una hoja por mesa: nombre, número y «Escanea para pedir». El impreso no cambia y no lleva el token." },
    ],
  },
  negocio: {
    title: "Configura el local",
    roles: ["owner", "admin"],
    paths: ["/empezar", "/config"],
    steps: [
      { tour: "nav-carta", title: "Los productos", text: "Aquí pones lo que vendes y su precio." },
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

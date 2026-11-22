/**
 * Respuestas del asistente, en el local, sin llamar a otro servicio.
 * Cada tema suma puntos si la pregunta trae sus frases. Gana el tema con más puntos,
 * para no contestar "cómo vender" cuando preguntan por un descuento o por el plan.
 */

function fold(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const TOPICS = [
  {
    id: "hola",
    strong: ["hola", "buenas", "buenos dias", "hey", "que tal"],
    answer:
      "Hola. Puedo explicarte cómo vender, cobrar, pasar a cocina, armar productos, el inventario, los meseros, el menú y el plan.",
  },
  {
    id: "gracias",
    strong: ["gracias", "te agradezco"],
    answer: "Cuando quieras. Si algo no cuadra en la caja o en cocina, pregúntame con el nombre de la pantalla.",
  },
  {
    id: "empezar",
    strong: ["como empiezo", "como empezar", "primera venta", "por donde", "como se vende", "como vender", "empiezo a vender"],
    words: ["recorrido", "primeros pasos"],
    answer:
      "El recorrido es el de siempre.\n1. En Productos crea una categoría y un producto con precio.\n2. Abre Punto de venta. El mostrador ya está elegido.\n3. Toca el producto y cobra en efectivo, tarjeta u otro.\nSi no hay productos, entra a Primeros pasos. Si te manda a Opciones de pago, el plan todavía no está activo y por eso no deja cobrar. Sí puedes armar la carta y las mesas antes de pagar.",
  },
  {
    id: "pos",
    strong: ["punto de venta", "mostrador"],
    words: ["caja"],
    block: ["turno", "corte", "cajon", "fondo", "cobr", "descuento", "propina"],
    answer:
      "Punto de venta es el mostrador, lo que antes era la mesa 1.\nAl abrirlo ya está elegido. Un toque en el producto lo agrega y abre la cuenta. Enviar a cocina avisa a cocina. Cobrar cierra la cuenta.\nLas mesas del salón están a la izquierda. Elígela solo si el pedido no es de mostrador.",
  },
  {
    id: "cobro",
    strong: ["como cobro", "realizar un cobro", "metodos de pago", "forma de pago"],
    words: ["cobrar", "cobro", "efectivo", "tarjeta", "transferencia"],
    block: ["plan", "suscripcion", "mercado pago", "mensual"],
    answer:
      "En Punto de venta toca el producto y luego Cobrar.\nEfectivo, tarjeta u otro tipo de pago. En efectivo escribe lo que te dieron: el cambio es eso menos el total, a centavos.\nLa propina se anota aparte y no cambia el precio de la comida. Puedes cobrar aunque el turno de caja no esté abierto. Si el turno está abierto, el efectivo y la propina en efectivo entran al cajón. Tarjeta y transferencia no entran.",
  },
  {
    id: "descuento",
    strong: ["descuento", "descontar"],
    answer:
      "El descuento puede ser un porcentaje o una cantidad en pesos.\nPrimero se descuenta el producto. Si además descuentas la cuenta, ese segundo descuento se calcula sobre lo que ya quedó.\nAl aplicar un descuento mayor a cero el sistema pide el PIN de gerente. Si tu local no usa PIN, déjalo vacío. La propina no entra en ese cálculo.",
  },
  {
    id: "dividir",
    strong: ["dividir", "separar cuenta", "solo lo marcado", "partir la cuenta"],
    words: ["separar"],
    answer:
      "En la cuenta marca los productos y usa Cobrar solo lo marcado.\nEso cobra esa parte y deja el resto abierto.\nEl descuento de toda la cuenta no se reparte entre las partes.",
  },
  {
    id: "propina",
    strong: ["propina"],
    answer:
      "La propina empieza en cero. No se suma sola.\nEn el cobro puedes sugerir 10, 15 o 20 por ciento, o escribir otra cantidad. Se guarda por método y, si hubo mesero, queda ligada a esa persona.\nA cobrar = comida ya descontada + propina. La de efectivo entra al cajón si hay turno abierto. La de tarjeta solo se registra.\nEn Propinas ves el reparto del periodo. Por horas usa el checador: si nadie marcó entrada, no se reparte por horas.",
  },
  {
    id: "turno",
    strong: ["turno", "corte de caja", "corte del dia", "corte parcial", "fondo de caja", "cajon"],
    words: ["corte"],
    answer:
      "Turno de caja es el cajón, no el punto de venta.\nAbrir: escribes el dinero con el que empiezas.\nCorte parcial: cuentas sin cerrar. Sirve a media tarde.\nCorte del día: sí cierra. La diferencia de tarjeta solo aparece si escribes lo que dice la terminal.\nEl cajón suma fondo + alimentos en efectivo + propina en efectivo + entradas − salidas. Se puede cobrar con el turno cerrado: la venta se guarda y no hay movimiento de cajón.",
  },
  {
    id: "cancelar",
    strong: ["cancelar", "que paso", "reembolso", "devolver dinero", "anular"],
    words: ["reembolsar"],
    answer:
      "En la cuenta, ¿Qué pasó? sirve para cancelar la cuenta, quitar productos o devolver dinero.\nCancelar la orden la deja en Cancelada y libera la mesa.\nSi el platillo ya estaba cobrado, devolver inventario regresa los insumos y merma los deja descontados. Eso no mueve el dinero.\nEl reembolso en efectivo sale del cajón si hay turno abierto. Tarjeta y Mercado Pago quedan anotados, pero el sistema no los devuelve solo en el banco. El PIN de gerente se pide; si no usas PIN, déjalo vacío.",
  },
  {
    id: "cocina",
    strong: ["cocina", "preparado", "comanda", "marcar listo"],
    words: ["listo", "pendiente"],
    block: ["plan"],
    answer:
      "Cocina trabaja producto por producto, no la orden entera de un golpe.\nListo lo pasa a Preparado. Regresar lo vuelve a dejar Pendiente. Cancelar platillo anula solo esa línea.\nCuando todos los productos activos están preparados, la orden queda en Preparado (lista). Marcar listo no cobra y no baja el inventario.\nUn pedido de domicilio en Por confirmar se acepta o se rechaza ahí. En la tarjeta se ven teléfono y dirección.",
  },
  {
    id: "estados",
    strong: ["estatus", "estado de la orden", "estado de la mesa", "que significa"],
    words: ["estatus"],
    answer:
      "Hay tres cosas distintas.\nLa orden: Por confirmar, En mesa, En cocina, Preparado, Entregada, Pagada o Cancelada.\nEl producto dentro de la orden: Pendiente, Preparado o Cancelado.\nLa mesa: Libre, Ocupada o No disponible. A una mesa no disponible no se le asigna pedido.",
  },
  {
    id: "stock",
    strong: ["inventario", "stock", "insumo", "bodega", "kardex", "merma", "se acaba", "se agota"],
    words: ["receta"],
    answer:
      "El inventario baja al cobrar, una sola vez. No baja cuando cocina marca listo ni cuando aceptas un domicilio.\nSi el producto tiene receta, se descuentan esos insumos. Si es unitario, como un refresco, se descuenta una pieza. Si no tiene receta ni pieza, se vende y no mueve stock.\nEn Inventario das de alta los insumos. El PIN protege los movimientos. Compras deja el costo como promedio de lo que había y lo que llegó. Si se acaba, el inicio avisa stock bajo. Aun así la venta no se bloquea sola por falta de insumo.",
  },
  {
    id: "receta",
    strong: ["receta", "costo de la receta", "que lleva"],
    answer:
      "En Recetas armas lo que lleva el platillo: insumos y cantidades. Esa receta es la que se descuenta al cobrar.\nEl margen del reporte es lo cobrado, ya con descuentos, menos el costo de la receta. Si no hay receta, usa el costo que escribiste en el producto.\nLa receta oculta de un producto por pieza no se edita en esta pantalla: es una pieza por venta.",
  },
  {
    id: "extras",
    strong: ["extra", "adicional", "modificador", "sin cebolla", "obligatorio"],
    answer:
      "Un adicional con precio se ofrece en el producto, por ejemplo queso extra.\nUn grupo de modificadores tiene mínimo, máximo y puede ser obligatorio. Se elige en punto de venta y en el menú. Cocina ve el nombre. El precio extra se suma por pieza.\nLa nota, como sin cebolla, viaja con esa línea y cocina la lee.",
  },
  {
    id: "producto",
    strong: ["nuevo producto", "agregar producto", "crear producto", "platillo", "carta"],
    words: ["producto"],
    block: ["eliminar", "elimino", "borrar", "borro", "desactivar", "precio", "foto", "imagen"],
    answer:
      "En Productos crea primero la categoría, por ejemplo Tacos, y después el producto con precio.\nEse precio es lo que cobras. La foto puede esperar. Puedes dejarlo sin control de stock, como pieza, o ligado a una receta de insumos.\nEl menú, el punto de venta y el kiosko usan esa misma carta.",
  },
  {
    id: "precio",
    strong: ["precio", "cambiar el precio", "cuanto cuesta"],
    block: ["plan", "suscripcion", "mensual", "anual"],
    answer:
      "El precio se edita en Productos. El nuevo aplica a las cuentas que abras después. Las cuentas ya abiertas conservan el precio con el que entraron.\nEl IVA, si lo prendes en Mi perfil, solo se muestra como incluido. No se suma al precio.",
  },
  {
    id: "foto",
    strong: ["foto", "imagen", "logo"],
    answer:
      "La foto del producto se sube en Productos. Si no pones una nueva al editar, se conserva la que ya tenía.\nEl logo del restaurante, el horario y los colores del menú están en Mi perfil.",
  },
  {
    id: "categoria",
    strong: ["categoria", "categorias"],
    answer:
      "Las categorías se crean y se ordenan en Productos. El punto de venta y el menú respetan ese orden. El cliente filtra con esas mismas categorías.",
  },
  {
    id: "borrar",
    strong: ["eliminar", "elimino", "borrar", "borro", "desactivar", "desactivo"],
    block: ["mesa", "mesero"],
    answer:
      "Para que deje de venderse, desactívalo en Productos. Así no se ofrece en caja ni en el menú, y el historial de tickets se conserva.\nBorrar de verdad un producto no borra sola su receta ni su pieza de inventario. Por eso la vía segura es desactivarlo.",
  },
  {
    id: "mesas",
    strong: ["mesa", "mesas", "no disponible", "qr de la mesa", "liberar"],
    words: ["salon"],
    block: ["mesero"],
    answer:
      "En Mesas creas el punto de venta y las mesas del salón. Los estados son Libre, Ocupada y No disponible. No se manda un pedido a una mesa no disponible.\nEl QR impreso no cambia: es la dirección del local y el número de mesa. Hay que abrir la mesa para que el celular pueda pedir. Al cobrar, esa sesión del QR deja de servir.\nLiberar mesas vacías suelta las que no tienen cuenta. Si la mesa ya tuvo cuentas, no se borra: se desactiva para conservar el historial.",
  },
  {
    id: "mesero",
    strong: ["mesero", "meseros"],
    answer:
      "En Meseros das de alta a la persona con un código de 4 a 8 dígitos y le asignas mesas. No es la cuenta del dueño.\nEntra en la pantalla de mesero del restaurante con ese código. Ahí toma el pedido de sus mesas, no de todo el salón.\nEl historial del mesero usa lo cobrado, ya con descuentos, y puede mostrar el margen de la receta.",
  },
  {
    id: "kiosko",
    strong: ["kiosko", "autoservicio"],
    answer:
      "El kiosko es el pedido del cliente en el local, sin mesero y sin mesa.\nUsa la misma carta. No lleva descuentos de caja. El inventario de ese pedido también baja al cobrar, no antes.\nEl horario del local no apaga el kiosko ni la tablet. Sí puede apagar el menú de domicilio.",
  },
  {
    id: "domicilio",
    strong: ["domicilio", "para llevar", "delivery", "pedido web", "menu web"],
    answer:
      "El domicilio se prende o se apaga en Mi perfil.\nEl cliente arma el pedido en el menú público. En cocina llega como Por confirmar: Confirmar lo pasa a cocina y Rechazar lo cancela.\nAceptarlo no descuenta inventario. El stock baja cuando se cobra.\nTeléfono y dirección se ven en la comanda y se quedan guardados en la orden.",
  },
  {
    id: "menu",
    strong: ["menu digital", "menu para clientes", "codigo de confirmacion", "horario"],
    words: ["qr"],
    block: ["ticket", "beeper"],
    answer:
      "Menú para clientes es la carta pública, con foto y precio.\nSi exiges código de confirmación, se genera en Mi perfil, de 4 a 6 dígitos, y el comensal lo pide en la mesa.\nEl horario de Mi perfil puede cerrar ese menú fuera de hora. El kiosko y la tablet siguen disponibles.",
  },
  {
    id: "ticket",
    strong: ["ticket", "beeper", "imprimir", "pdf", "reimprimir"],
    answer:
      "Cada cuenta tiene un ticket en Tickets. Ahí reimprimes, descargas el PDF o abres el beeper.\nEl beeper es la página pública /t y el código de la orden. El cliente ve el estado de su pedido.\nImprimir abre una ventana. Si sale en blanco, permite ventanas emergentes. El PDF se descarga: los acentos del nombre sí entran en el archivo.",
  },
  {
    id: "iva",
    strong: ["iva", "impuesto"],
    answer:
      "El IVA es opcional y está apagado hasta que lo prendas en Mi perfil.\nEs 16 por ciento incluido en el precio. Solo se muestra en el ticket. No se suma encima.",
  },
  {
    id: "plan",
    strong: ["plan", "suscripcion", "mercado pago", "brasa", "comal", "fogon", "mensual", "anual", "vencio", "vence"],
    words: ["pagar el plan", "opciones de pago"],
    answer:
      "Sin un plan activo no se cobra. Sí puedes cargar productos, mesas y tu perfil.\nBrasa: 300 al mes o 3,000 al año, hasta 5 mesas y 3 meseros.\nComal: 500 o 5,000, hasta 15 mesas y 7 meseros. Aquí ya ves más vendidos y ventas por canal.\nFogón: 800 o 8,000, hasta 25 mesas y 15 meseros.\nEl anual son 10 meses de precio por 12 de uso. Se paga en Opciones de pago con Mercado Pago. Al confirmarse, el punto de venta abre.\nBajar de plan no borra mesas ni meseros. Si ya tienes más de los que permite el plan nuevo, no puedes dar de alta más hasta quitar los que sobran.\nBrasas, Comales y Fogones son el mismo nivel para varios locales, con un solo pago.",
  },
  {
    id: "sucursal",
    strong: ["sucursal", "otro local", "varios locales", "otra sucursal"],
    answer:
      "Varios locales viven en un grupo. Una suscripción cubre esos locales. Cada uno conserva sus mesas, sus meseros y su carta.\nPuedes copiar el menú de un local a otro. El reporte se puede ver por local.\nQuien ya tiene restaurante propio no entra a otro grupo con la misma cuenta.",
  },
  {
    id: "equipo",
    strong: ["equipo", "invitar", "otro usuario", "rol"],
    answer:
      "En Equipo invitas por correo con rol de administración, punto de venta y piso, o cocina.\nNo sale un correo automático. La persona entra con ese mismo correo y la invitación se acepta.\nEl dueño ve todo. Cocina cae en la pantalla de cocina. Piso cae en el punto de venta.",
  },
  {
    id: "dashboard",
    strong: ["grafica", "dashboard", "inicio", "venta del dia", "mas vendido", "estadistica"],
    words: ["reporte"],
    block: ["descargar csv", "export"],
    answer:
      "Inicio suma solo las órdenes pagadas: ventas, tickets, órdenes abiertas y mesas ocupadas.\nLos más vendidos y las ventas por canal se ven en Comal o Fogón. En Brasa esa parte pide subir de plan. El detalle del periodo, con margen, está en Reportes.\nEl margen es lo cobrado menos el costo de la receta.",
  },
  {
    id: "reporte",
    strong: ["reporte", "csv", "exportar", "utilidad"],
    answer:
      "En Reportes eliges las fechas y descargas un CSV: por método de pago, por mesero y por platillo.\nLa utilidad es lo cobrado, ya con descuentos, menos el costo de la receta. Si el platillo no tiene receta, se usa el costo del producto.",
  },
  {
    id: "clientes",
    strong: ["cliente", "telefono del cliente"],
    answer:
      "En Clientes queda quien dejó teléfono, sobre todo en domicilio o si lo anotas en la caja.\nEl teléfono y la dirección del domicilio también se ven en la comanda de cocina.",
  },
  {
    id: "importar",
    strong: ["importar", "csv de productos", "subir archivo"],
    answer:
      "En Importar subes un archivo para cargar productos de golpe, en lugar de capturarlos uno por uno. Revisa la carta después, porque el precio que quede es el que se cobra.",
  },
  {
    id: "pantallas",
    strong: ["pantalla", "monitor de cocina", "carrusel"],
    answer:
      "Pantallas manda la cocina a un monitor. El carrusel arma listas de productos para mostrar.\nEs una vista de lectura. El trabajo de marcar listo se hace en Cocina.",
  },
  {
    id: "pin",
    strong: ["pin", "gerente"],
    answer:
      "El PIN de gerente se pide al cancelar, al descontar y al reembolsar. Si tu local no lo usa, deja el campo vacío y sigue.\nEl PIN de inventario es otro: protege las entradas y salidas de bodega, en Inventario.",
  },
  {
    id: "checador",
    strong: ["checador", "entrada y salida", "reloj"],
    answer:
      "El checador registra entrada y salida del equipo.\nEl reparto de propinas por horas lo usa. Si nadie marcó entrada en esas fechas, no hay horas para repartir.",
  },
  {
    id: "masa",
    strong: ["masa", "produccion de masa"],
    answer:
      "Masa sigue en desarrollo. No produce ni descuenta inventario. No hace falta para vender.",
  },
  {
    id: "password",
    strong: ["contrasena", "password", "cerrar sesion", "recuperar"],
    words: ["sesion"],
    answer:
      "Para cambiar la contraseña entra a Recuperar, desde la pantalla de acceso. Te llega un enlace al correo.\nCerrar sesión está en el menú, en Salir. Eso cierra solo este navegador.",
  },
  {
    id: "general",
    strong: ["que es wapifood", "para que sirve", "necesito internet", "en el celular", "soporte"],
    words: ["internet", "celular"],
    answer:
      "Wapifood es el sistema del restaurante en el navegador: punto de venta, cocina, menú, meseros e inventario. No se instala.\nHace falta internet. En el celular se usa igual. En el teléfono, abajo están Venta, Cocina, Mesas e Inicio. El resto está en Más.\nSi una pantalla no abre al cobrar, casi siempre es el plan. Revisa Opciones de pago.",
  },
];

function has(text, phrase) {
  const token = fold(phrase);
  if (!token) return false;
  if (token.includes(" ")) return text.includes(token);
  return new RegExp(`(^|[^a-z0-9])${token}`).test(text);
}

function scoreTopic(topic, text) {
  let score = 0;
  for (const phrase of topic.strong || []) {
    if (has(text, phrase)) score += 6;
  }
  for (const word of topic.words || []) {
    if (has(text, word)) score += 2;
  }
  for (const phrase of topic.block || []) {
    if (has(text, phrase)) score -= 5;
  }
  return score;
}

export function answerHelp(question) {
  const text = fold(question).trim();
  if (!text) {
    return "Escribe una pregunta. Por ejemplo: cómo vender, cómo cobrar, cuándo baja el inventario o qué incluye el plan.";
  }
  let best = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    if ((topic.id === "hola" || topic.id === "gracias") && text.length > 28) continue;
    const score = scoreTopic(topic, text);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  if (!best || bestScore < 2) {
    return "No tengo una regla para esa frase. Pregúntame cómo vender, cómo cobrar, un descuento, cocina, productos, recetas, inventario, mesas, meseros, menú, domicilio, turno, propinas o el plan.";
  }
  return best.answer;
}

export const HELP_SUGGESTIONS = [
  "¿Cómo empiezo a vender?",
  "¿Cómo realizar un cobro?",
  "¿Cómo aplicar un descuento?",
  "¿Cuándo baja el inventario?",
  "¿Cómo marcar un producto como preparado?",
  "¿Qué incluye cada plan?",
  "¿Cómo entra un mesero?",
  "¿Cómo pido desde el QR de la mesa?",
];

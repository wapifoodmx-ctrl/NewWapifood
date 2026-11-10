/** Respuestas locales del asistente. El chatbot legado llamaba a api.wapifood.com, que ya no es el backend. */
const ANSWERS = [
  [/gráfica|dashboard|venta del día|estadística/i, "El panel suma las órdenes pagadas. Arriba ves mesas ocupadas, ventas y productos más pedidos."],
  [/agregar un nuevo producto|nuevo producto|carta/i, "En Carta crea la categoría y luego el producto. Puedes subir foto, precio y modo de inventario."],
  [/precio/i, "Edita el producto en Carta. El precio nuevo aplica a las órdenes que abras después."],
  [/imagen|foto|logo/i, "La foto del producto se sube en Carta. El logo del restaurante está en Restaurante."],
  [/categor/i, "Las categorías se ordenan en Carta. El menú y la caja respetan ese orden."],
  [/elimin/i, "Desactiva el producto en Carta para que deje de venderse sin borrar el historial."],
  [/ticket|beeper|qr/i, "Cada orden tiene un enlace /t/id. En Tickets puedes reimprimir la cuenta."],
  [/preparado|cocina/i, "En Cocina marca cada producto como Preparado o cancélalo. Cuando todos quedan preparados, la orden pasa a Lista."],
  [/tiempo real|notific/i, "Cocina, caja y mesas escuchan cambios de orders, order_items y dining_tables."],
  [/receta|insumo|inventario|stock/i, "La receta dice cuánto insumo baja al cobrar. El modo unitario descuenta una pieza. Los adicionales se configuran en Recetas."],
  [/mesero/i, "Crea al mesero con un código de 4 a 8 dígitos y asígnale mesas. Entra en /mesero/id-del-restaurante."],
  [/cobr|pago|efectivo|tarjeta|descuento|propina/i, "En la caja elige la mesa, aplica descuento de platillo o de la cuenta y cobra. La propina se escribe aparte y no cambia el precio. El cambio sale del efectivo recibido."],
  [/turno|corte|caj[oó]n/i, "En Turno de caja anotas el fondo, las entradas y las salidas. Al cerrar, cuentas el efectivo. Tarjeta y otro tipo de pago no entran al cajón. Puedes cobrar aunque el turno no esté abierto."],
  [/equipo|invit/i, "En Equipo invitas por correo con rol de administración, caja o cocina. La persona entra con ese correo. Una persona puede entrar a varios locales del mismo grupo."],
  [/dividir|separar/i, "En la caja marca los platillos y cobra solo lo marcado. El descuento de toda la cuenta no se reparte entre las partes."],
  [/contraseña|password|sesión/i, "Cambia la contraseña en Recuperar. Cerrar sesión está en la barra del panel."],
  [/plan|suscrip/i, "Los planes se pagan con Mercado Pago en Pagos. El webhook activa el plan. No se puede activar sin pago."],
  [/wapifood|internet|celular|soporte/i, "Wapifood opera el restaurante en el navegador: caja, cocina, menú e inventario. Hace falta internet."],
];

export function answerHelp(question) {
  const text = String(question || "").trim();
  if (!text) return "Escribe una pregunta sobre caja, cocina, carta o inventario.";
  const hit = ANSWERS.find(([re]) => re.test(text));
  return hit ? hit[1] : "No tengo esa respuesta todavía. Revisa Carta, Insumos, Recetas, Caja o Cocina en el menú.";
}

export const HELP_SUGGESTIONS = [
  "¿Cómo realizar un cobro?",
  "¿Cómo marcar un producto como preparado?",
  "¿Las recetas afectan el inventario?",
  "¿Cómo agregar un nuevo mesero?",
];

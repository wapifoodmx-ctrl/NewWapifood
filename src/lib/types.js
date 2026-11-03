/** @typedef {'owner'|'admin'|'piso'|'cocina'} AppRole */

/** Estados de mesa (enum table_state en Supabase) */
/** @typedef {'libre'|'ocupada'|'no_disponible'} TableState */

/**
 * Estados de orden (enum order_status en Supabase)
 * pendiente = web/domicilio por confirmar
 * abierta   = cuenta en mesa / POS sin enviar o en piso
 * cocina    = enviada a cocina
 * lista     = productos preparados
 * entregada = entregada en mesa
 * pagada    = cobrada
 * cancelada = anulada
 */
/** @typedef {'abierta'|'pendiente'|'cocina'|'lista'|'entregada'|'pagada'|'cancelada'} OrderStatus */

/** Estados de línea de pedido */
/** @typedef {'pendiente'|'preparado'|'cancelado'} OrderItemStatus */

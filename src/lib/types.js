/** @typedef {'owner'|'admin'|'piso'|'cocina'} AppRole */
/** @typedef {'libre'|'ocupada'} TableState */
/** @typedef {'abierta'|'cocina'|'lista'|'pagada'|'cancelada'} OrderStatus */
/** @typedef {'efectivo'|'tarjeta'|'transferencia'} PayMethod */

/**
 * @typedef {Object} Restaurant
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} restaurant_id
 * @property {string} category_id
 * @property {string} name
 * @property {number} price
 * @property {number} cost
 * @property {boolean} active
 */

/**
 * @typedef {Object} Ingredient
 * @property {string} id
 * @property {string} restaurant_id
 * @property {string} name
 * @property {string} unit
 * @property {number} stock
 * @property {number} min_stock
 */

/**
 * @typedef {Object} DiningTable
 * @property {string} id
 * @property {string} restaurant_id
 * @property {number} number
 * @property {number} seats
 * @property {TableState} state
 * @property {boolean} active
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} restaurant_id
 * @property {string} table_id
 * @property {OrderStatus} status
 * @property {PayMethod|null} method
 * @property {string} opened_at
 * @property {string|null} closed_at
 * @property {boolean} stock_applied
 */

export {};

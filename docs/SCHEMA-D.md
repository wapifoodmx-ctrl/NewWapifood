# Panel D — modelo de datos Wapifood (Supabase)

| Recurso | Uso |
|---|---|
| restaurants, memberships | Multi-tenant + roles owner/admin/piso/cocina |
| restaurant_profiles, menu_theme | Perfil, contacto, colores menú |
| products, categories (+ image_url) | Carta |
| ingredients, recipe_lines, stock_moves | Inventario y descuento al cobrar |
| dining_tables, orders, order_items | POS |
| waiters, waiter_tables | Meseros |
| subscriptions | Plan SaaS (trial/active) |
| storage `public-media` | Logos y fotos públicas |

RPCs clave: `create_my_restaurant`, `close_order`, `place_public_order`, `waiter_login`, `activate_plan`.

-- Unidades canónicas (documentación operativa):
-- Los insumos deben almacenarse en g / ml / pza.
-- recipe_lines.qty se interpreta SIEMPRE en la unidad base del insumo.
-- El Front y New convierten kg→g y L→ml en la app al guardar.
-- close_order descuenta recipe_lines.qty * order_items.qty del stock (misma unidad).

-- Normalización suave de etiquetas legacy si quedaron "kg"/"l" como unit
-- sin convertir números (solo etiqueta): opcional, comentado por seguridad.
-- update public.ingredients set unit = 'g' where lower(unit) in ('kg','kilo','kilos');
-- update public.ingredients set unit = 'ml' where lower(unit) in ('l','lt','litro','litros');

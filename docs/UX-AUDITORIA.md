# Auditoría de UX — NewWapifood

Fecha: 3 de noviembre de 2026. Comparado con los flujos de WapifoodFront (caja, cocina, mesero, menú, inventario y plan). No se quitó ninguna ruta.

## Hallazgos, de mayor a menor impacto

1. **El menú es una sola fila de 19 botones en mayúsculas.**  
   Un cajero o un cocinero no distingue qué abre la venta y qué es configuración. En el teléfono hay que deslizar sin saber a dónde.  
   **Por qué importa:** la persona con poca práctica se pierde antes de tomar el primer pedido.  
   **Arreglo:** agrupar por tarea (Hoy, En el piso, Tu carta, Tu negocio) y, en el teléfono, dejar cuatro accesos grandes más “Más”.

2. **No hay camino guiado a la primera venta.**  
   Después de registrarse caes al panel con módulos sueltos. El legado también era amplio, pero el dueño nuevo necesita un orden: datos, platillo, mesa, plan, caja.  
   **Arreglo:** pantalla Primeros pasos con una sola acción por paso pendiente.

3. **Los botones de caja, cocina y mesero se sienten de escritorio.**  
   Varios controles miden 36–40 px y el cobro está escondido dentro del carrito. En una tablet se fallan los toques.  
   **Arreglo:** alto mínimo de 48 px, barra inferior en el teléfono y cobro visible sin abrir otro menú.

4. **El contraste del texto secundario no llega a WCAG AA.**  
   El gris `#978e81` sobre el beige `#d8cbb8` se lee mal con luz de cocina.  
   **Arreglo:** fondo más claro y texto secundario más oscuro, sin tirar la paleta cálida.

5. **Los vacíos no dicen qué hacer.**  
   “Sin comandas” o “carrito vacío” no llevan a la siguiente acción.  
   **Arreglo:** una frase en español llano y un solo botón principal.

6. **El aviso de plan usa jerga (“modo configuración”, “ops”).**  
   **Arreglo:** “Todavía no puedes vender” y un enlace al plan.

7. **Confirmar antes de borrar ya existe en caja y meseros, pero no es parejo.**  
   Se mantiene el diálogo. No se agregó deshacer automático en esta pasada: haría falta una papelera de órdenes.

## Fuera de esta pasada

- Rediseñar el menú público y el kiosko pantalla por pantalla.
- Atajos de un solo toque para cerrar comanda de cocina y cobrar sin elegir método (hoy el método de pago es obligatorio y correcto).
- Chatbot remoto y producción de masa: no están implementados en el legado.

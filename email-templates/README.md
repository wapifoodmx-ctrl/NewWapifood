# Plantillas de correo (Supabase)

Supabase no toma estos archivos solo: hay que pegarlos una vez en el panel.

1. Supabase → Authentication → Email Templates
2. **Confirm signup** → pega `confirmacion-registro.html`
3. **Reset password** → pega `recuperar-password.html`
4. Authentication → URL configuration:
   - Site URL: `http://localhost:3000` (o tu dominio)
   - Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `https://TU-DOMINIO/auth/callback`

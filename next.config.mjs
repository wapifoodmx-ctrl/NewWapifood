/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache Components + cookies()/auth rompe el build en rutas protegidas.
  // Este es un SaaS con sesión: preferimos builds estables en Vercel.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

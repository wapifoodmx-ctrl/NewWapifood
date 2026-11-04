import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/ui/AppProviders";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Wapifood",
  description: "Caja, cocina, mesas y menú para tu restaurante. Fácil para todo el equipo.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#B93815",
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <div id="contenido">
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}

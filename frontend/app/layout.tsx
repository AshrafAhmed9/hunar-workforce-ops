import "./globals.css";
import { Archivo_Black, IBM_Plex_Mono } from "next/font/google";
import { NavLinks } from "../components/NavLinks";

const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-mono" });

export const metadata = { title: "Hunar Workforce Ops", description: "Consent-first voice operations" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <nav>
          <div>
            <strong>HUNAR /// WORKFORCE OPS</strong>
            <NavLinks />
          </div>
        </nav>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}

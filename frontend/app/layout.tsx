import "./globals.css";
import { NavLinks } from "../components/NavLinks";

export const metadata = { title: "Hunar Workforce Ops", description: "Consent-first voice operations" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <nav>
          <div>
            <strong>Hunar Workforce Ops</strong>
            <NavLinks />
          </div>
        </nav>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}

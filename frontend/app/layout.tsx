import "./globals.css";
import Link from "next/link";
export const metadata={title:"Hunar Workforce Ops",description:"Consent-first voice operations"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><nav><div><strong>Hunar Workforce Ops</strong><Link href="/screen">Screen</Link><Link href="/source">Source</Link><Link href="/rollcall">Rollcall</Link><Link href="/proof">Proof</Link></div></nav>{children}</body></html>}

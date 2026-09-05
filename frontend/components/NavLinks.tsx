"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/screen", label: "Screen" },
  { href: "/source", label: "Source" },
  { href: "/rollcall", label: "Rollcall" },
  { href: "/proof", label: "Proof" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map(link => (
        <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </>
  );
}

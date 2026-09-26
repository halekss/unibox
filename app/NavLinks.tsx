"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icons.tsx";

export function NavLinks({ inbox, toSort, toClean }: { inbox: number; toSort: number; toClean: number }) {
  const path = usePathname();
  const links = [
    { href: "/boite", icon: "inbox", text: "Boîte de réception", short: "Boîte", count: inbox, hot: false },
    { href: "/", icon: "sort", text: "À ranger", short: "À ranger", count: toSort, hot: toSort > 0 },
    { href: "/nettoyage", icon: "trash", text: "À supprimer", short: "À supprimer", count: toClean, hot: false },
    { href: "/comptes", icon: "user", text: "Comptes et IA", short: "Comptes", count: null, hot: false },
  ] as const;
  return (
    <nav className="sections" aria-label="Sections">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
          <Icon name={l.icon} />
          <span className="long">{l.text}</span>
          <span className="short">{l.short}</span>
          {l.count !== null && <span className={l.hot ? "count hot" : "count"}>{l.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

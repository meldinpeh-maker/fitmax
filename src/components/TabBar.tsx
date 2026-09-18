"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today ⚡" },
  { href: "/equipment", label: "Gear 🏋️" },
  { href: "/history", label: "History 📊" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <a key={t.href} href={t.href} className={path === t.href ? "on" : ""}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

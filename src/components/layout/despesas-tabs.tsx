"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, Repeat } from "lucide-react";

const TABS = [
  { href: "/despesas", label: "Resumo", icon: LayoutDashboard, match: (p: string) => p === "/despesas" },
  { href: "/transacoes", label: "Lançamentos", icon: ListChecks, match: (p: string) => p.startsWith("/transacoes") },
  { href: "/recorrencias", label: "Recorrências", icon: Repeat, match: (p: string) => p.startsWith("/recorrencias") },
] as const;

export function DespesasTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 mb-6 w-fit">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

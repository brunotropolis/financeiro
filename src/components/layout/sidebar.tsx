"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Building2,
  Tag,
  Repeat,
  Truck,
  ScrollText,
  Settings,
  CalendarRange,
  Upload,
  Target,
} from "lucide-react";

const navMain = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", icon: TrendingDown },
  { href: "/receitas", label: "Receitas", icon: TrendingUp },
  { href: "/recorrencias", label: "Recorrências", icon: Repeat },
  { href: "/faturas", label: "Faturas", icon: ScrollText },
  { href: "/importar", label: "Importar extrato", icon: Upload },
];

const navCadastros = [
  { href: "/entidades", label: "Entidades", icon: Building2 },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/categorias", label: "Categorias", icon: Tag },
  { href: "/origens", label: "Origens", icon: TrendingUp },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
];

export function Sidebar() {
  const pathname = usePathname();

  const renderItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
  }) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </Link>
    );
  };

  return (
    <aside className="w-60 min-h-screen bg-sidebar flex flex-col border-r border-sidebar-border">
      <div className="px-6 py-5 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-sidebar-foreground">
          💰 Financeiro
        </h1>
        <p className="text-xs text-sidebar-foreground/50 mt-0.5">
          Controle de Fluxo
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
          Operação
        </div>
        {navMain.map(renderItem)}

        <div className="px-2 pt-4 pb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
          Cadastros
        </div>
        {navCadastros.map(renderItem)}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        {renderItem({ href: "/configuracoes", label: "Configurações", icon: Settings })}
      </div>
    </aside>
  );
}

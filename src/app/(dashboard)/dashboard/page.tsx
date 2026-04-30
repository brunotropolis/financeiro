import { LayoutDashboard, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          Visão geral do fluxo financeiro
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Saldo total", value: "R$ —", icon: Wallet, color: "text-emerald-400" },
          { label: "Receitas (mês)", value: "R$ —", icon: TrendingUp, color: "text-blue-400" },
          { label: "Despesas (mês)", value: "R$ —", icon: TrendingDown, color: "text-rose-400" },
          { label: "Faturas em aberto", value: "—", icon: LayoutDashboard, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {label}
              </span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <LayoutDashboard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">
          Dashboard em construção — Sprint 1 (estrutura)
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Métricas, gráfico de fluxo de caixa, faturas e projeção 6 meses chegam no Sprint 2.
        </p>
      </div>
    </div>
  );
}

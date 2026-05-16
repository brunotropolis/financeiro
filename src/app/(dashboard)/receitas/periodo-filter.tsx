"use client";

import { useRouter } from "next/navigation";

const OPTS = [
  { value: "atual", label: "Mês atual" },
  { value: "proximos", label: "Próximos meses" },
  { value: "anteriores", label: "Meses anteriores" },
] as const;

export function PeriodoFilter({ current }: { current: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
      {OPTS.map((o) => (
        <button
          key={o.value}
          onClick={() =>
            router.push(o.value === "atual" ? "/receitas" : `/receitas?p=${o.value}`)
          }
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            current === o.value
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

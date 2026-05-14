"use client";

import { useRouter } from "next/navigation";

const OPTS = [
  { value: "1m", label: "Mês atual" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
] as const;

export function PeriodoFilter({ current }: { current: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
      {OPTS.map((o) => (
        <button
          key={o.value}
          onClick={() =>
            router.push(o.value === "1m" ? "/dashboard" : `/dashboard?p=${o.value}`)
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

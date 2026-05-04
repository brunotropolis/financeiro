import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  acao,
}: {
  icon?: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-600 mx-auto mb-3" />}
      <p className="text-gray-300 font-medium">{titulo}</p>
      {descricao && <p className="text-gray-500 text-sm mt-1">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

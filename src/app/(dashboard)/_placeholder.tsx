import { Construction } from "lucide-react";

export function PlaceholderPage({
  titulo,
  descricao,
  sprint,
}: {
  titulo: string;
  descricao: string;
  sprint?: string;
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{titulo}</h1>
        <p className="text-gray-400 text-sm mt-1">{descricao}</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Construction className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-300 font-medium">Em construção</p>
        {sprint && (
          <p className="text-gray-500 text-sm mt-1">Previsto para {sprint}</p>
        )}
      </div>
    </div>
  );
}

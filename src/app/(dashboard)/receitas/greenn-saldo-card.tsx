"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Wallet, ImageIcon, X, AlertCircle, Sparkles } from "lucide-react";
import { formatBRL } from "@/lib/formatters";

type Saldo = {
  disponivel: number;
  pendente: number;
  antecipavel: number;
  capturado_em: string;
};

function tempoRelativo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return min <= 1 ? "agora" : `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  return `${dias}d`;
}

export function GreennSaldoCard({ saldo: initial }: { saldo: Saldo | null }) {
  const [open, setOpen] = useState(false);
  const [saldo, setSaldo] = useState(initial);

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-950/40 to-teal-950/30 border border-emerald-900/50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" /> Saldo Greenn
            {saldo && (
              <span className="text-[11px] font-normal text-gray-500 ml-2">
                atualizado há {tempoRelativo(saldo.capturado_em)}
              </span>
            )}
          </h2>
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> {saldo ? "Atualizar" : "Lançar 1º saldo"}
          </button>
        </div>

        {saldo ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Disponível</div>
              <div className="text-xl font-bold text-emerald-300 mt-0.5">{formatBRL(saldo.disponivel)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">liberado pra saque</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Pendente</div>
              <div className="text-xl font-bold text-amber-300 mt-0.5">{formatBRL(saldo.pendente)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">provisionado / em aberto</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Antecipável</div>
              <div className="text-xl font-bold text-cyan-300 mt-0.5">{formatBRL(saldo.antecipavel)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">pode antecipar com taxa</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 py-2">
            Nenhum saldo capturado ainda. Cole um print da sua carteira Greenn pra começar.
          </div>
        )}
      </div>

      {open && (
        <SaldoModal
          onClose={() => setOpen(false)}
          onSaved={(novo) => {
            setSaldo({ ...novo, capturado_em: new Date().toISOString() });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function SaldoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (s: { disponivel: number; pendente: number; antecipavel: number }) => void;
}) {
  const router = useRouter();
  const [imageData, setImageData] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("image/png");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pasteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pasteRef.current?.focus();
  }, []);

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          setImageData(reader.result as string);
          setMediaType(item.type);
          setErro(null);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    setErro("Nada de imagem encontrada no clipboard. Tire um print primeiro (Win+Shift+S).");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setMediaType(file.type);
      setErro(null);
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!imageData) return setErro("Cole um print primeiro.");
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/greenn/parse-saldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, media_type: mediaType }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErro(j.error || "Erro ao processar");
        setLoading(false);
        return;
      }
      onSaved({ disponivel: j.disponivel, pendente: j.pendente, antecipavel: j.antecipavel });
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Atualizar saldo Greenn</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ol className="text-xs text-gray-400 mb-4 space-y-1 list-decimal list-inside">
          <li>Abra <a href="https://adm.greenn.com.br/extrato" target="_blank" rel="noopener" className="text-emerald-400 underline">adm.greenn.com.br/extrato</a></li>
          <li>Tire print da seção <em>Minha carteira</em> (Win+Shift+S)</li>
          <li>Cole aqui embaixo (Ctrl+V) ou clique pra escolher um arquivo</li>
        </ol>

        <div
          ref={pasteRef}
          tabIndex={0}
          onPaste={handlePaste}
          className="border-2 border-dashed border-gray-700 rounded-lg p-6 mb-4 cursor-text focus:border-emerald-500 focus:outline-none text-center"
        >
          {imageData ? (
            <div>
              <img src={imageData} alt="Preview" className="max-h-64 mx-auto rounded mb-2" />
              <button
                onClick={() => setImageData(null)}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                Remover e tentar outra
              </button>
            </div>
          ) : (
            <div className="text-gray-500">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Clique aqui e cole a imagem (Ctrl+V)</p>
              <p className="text-xs mt-1">ou</p>
              <label className="text-emerald-400 hover:text-emerald-300 cursor-pointer text-xs underline">
                escolher arquivo
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>
            </div>
          )}
        </div>

        {erro && (
          <div className="bg-rose-950/40 border border-rose-900 rounded-lg px-3 py-2 mb-4 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !imageData}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm text-white flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Extraindo com IA..." : "Extrair valores"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { CartaoCredito, Categoria, ContaBancaria } from "@/lib/types/database";
import { Upload, Loader2, AlertCircle, CheckCircle2, Eye, Link as LinkIcon, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { formatBRL, formatDate } from "@/lib/formatters";
import { buscarMatchesPrevistos, importarLinhas, type LinhaParseada } from "./actions";

type ContaLite = Pick<ContaBancaria, "id" | "nome" | "banco" | "entidade_id" | "ativo">;
type CartLite = Pick<CartaoCredito, "id" | "nome" | "entidade_id" | "ativo">;
type CatLite = Pick<Categoria, "id" | "nome" | "tipo" | "cor_hex" | "ativo">;

type LinhaRevisao = LinhaParseada & {
  acao: "criar" | "vincular" | "ignorar";
  transacao_prevista_id?: string | null;
  categoria_id?: string | null;
  candidatos?: Array<{ id: string; descricao: string; valor: number; data_competencia: string }>;
};

type DestinoTipo = "conta" | "cartao";

export function ImportarClient({
  contas,
  cartoes,
  categorias,
}: {
  contas: ContaLite[];
  cartoes: CartLite[];
  categorias: CatLite[];
}) {
  const [destinoTipo, setDestinoTipo] = useState<DestinoTipo>("conta");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [parsing, setParsing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ banco?: string; transacoes?: LinhaParseada[] } | null>(null);
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [pendingSalvar, startSalvar] = useTransition();
  const [sucesso, setSucesso] = useState<{ criadas: number; vinculadas: number; ignoradas: number } | null>(null);

  async function processar() {
    if (!arquivo) return setErro("Selecione um arquivo PDF.");
    if (destinoTipo === "conta" && !contaId) return setErro("Selecione a conta.");
    if (destinoTipo === "cartao" && !cartaoId) return setErro("Selecione o cartão.");

    setParsing(true);
    setErro(null);
    setResultado(null);
    setLinhas([]);
    setSucesso(null);

    try {
      const fd = new FormData();
      fd.append("file", arquivo);
      const r = await fetch("/api/importar/parse-pdf", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Falha no parser");

      setResultado(data);

      // Busca matches em transações previstas
      const matches = await buscarMatchesPrevistos(
        destinoTipo === "conta" ? contaId : null,
        destinoTipo === "cartao" ? cartaoId : null,
        data.transacoes
      );

      const linhasInic: LinhaRevisao[] = (data.transacoes as LinhaParseada[]).map((l, i) => ({
        ...l,
        acao: l.eh_estorno_par ? "ignorar" : matches[i]?.length === 1 ? "vincular" : "criar",
        transacao_prevista_id: matches[i]?.length === 1 ? matches[i][0].id : null,
        categoria_id: categoriaIdSugerida(l.categoria_sugerida, categorias),
        candidatos: matches[i],
      }));

      if (data._meta?.truncated) {
        setErro(`⚠️ Resposta da IA truncada — recuperei ${linhasInic.length} transações, mas pode ter mais. Se faltar, divida o PDF em 2 partes.`);
      }

      setLinhas(linhasInic);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setParsing(false);
    }
  }

  function salvar() {
    startSalvar(async () => {
      const res = await importarLinhas({
        conta_id: destinoTipo === "conta" ? contaId : (contas.find((c) => c.id === contaPagamentoDeCartao(cartaoId, cartoes))?.id ?? contaId),
        cartao_id: destinoTipo === "cartao" ? cartaoId : null,
        linhas: linhas.map((l) => ({
          ...l,
          transacao_prevista_id: l.transacao_prevista_id || null,
          categoria_id: l.categoria_id || null,
        })),
      });
      if ("error" in res && res.error) setErro(res.error);
      else if ("ok" in res) {
        setSucesso({ criadas: res.criadas ?? 0, vinculadas: res.vinculadas ?? 0, ignoradas: res.ignoradas ?? 0 });
        setLinhas([]);
        setResultado(null);
        setArquivo(null);
      }
    });
  }

  const cartoesFiltrados = cartoes;
  const contasFiltradas = contas;

  return (
    <div>
      <PageHeader
        titulo="Importar extrato"
        descricao="Sobe PDF do banco/cartão. IA extrai linhas, sugere categoria e tenta casar com transações previstas."
      />

      {sucesso && (
        <div className="mb-6 bg-emerald-900/30 border border-emerald-700 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-emerald-200 font-medium">Importado!</p>
            <p className="text-sm text-emerald-300/80">
              {sucesso.vinculadas} previstas marcadas como pagas · {sucesso.criadas} novas transações criadas · {sucesso.ignoradas} ignoradas
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSucesso(null)}><X className="w-4 h-4" /></Button>
        </div>
      )}

      {!resultado && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl">
          <div className="space-y-4">
            <div>
              <Label>Tipo do extrato</Label>
              <div className="flex gap-1 p-1 bg-gray-800 rounded-lg mt-1.5 w-fit">
                <button
                  type="button"
                  onClick={() => setDestinoTipo("conta")}
                  className={"px-3 py-1.5 text-xs rounded-md transition-colors " + (destinoTipo === "conta" ? "bg-blue-600 text-white" : "text-gray-400")}
                >
                  Conta corrente
                </button>
                <button
                  type="button"
                  onClick={() => setDestinoTipo("cartao")}
                  className={"px-3 py-1.5 text-xs rounded-md transition-colors " + (destinoTipo === "cartao" ? "bg-blue-600 text-white" : "text-gray-400")}
                >
                  Fatura de cartão
                </button>
              </div>
            </div>

            {destinoTipo === "conta" ? (
              <div>
                <Label>Conta destino</Label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contasFiltradas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Cartão</Label>
                <Select value={cartaoId} onValueChange={setCartaoId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {cartoesFiltrados.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="file">Arquivo PDF</Label>
              <input
                id="file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                className="mt-1.5 block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-medium hover:file:bg-blue-700"
              />
              {arquivo && (
                <p className="text-xs text-gray-500 mt-2">📄 {arquivo.name} ({Math.round(arquivo.size / 1024)} KB)</p>
              )}
            </div>

            {erro && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <Button onClick={processar} disabled={parsing || !arquivo}>
              {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisando com IA...</> : <><Upload className="w-4 h-4" /> Processar PDF</>}
            </Button>

            {parsing && <p className="text-xs text-gray-500">Pode levar 20-60 segundos dependendo do tamanho.</p>}
          </div>
        </div>
      )}

      {resultado && linhas.length > 0 && (
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                {resultado.banco ?? "Extrato"} — {linhas.length} transação{linhas.length === 1 ? "" : "ões"} extraída{linhas.length === 1 ? "" : "s"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {linhas.filter((l) => l.acao === "vincular").length} vai vincular · {linhas.filter((l) => l.acao === "criar").length} vai criar · {linhas.filter((l) => l.acao === "ignorar").length} ignoradas
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setResultado(null); setLinhas([]); }}>Cancelar</Button>
              <Button onClick={salvar} disabled={pendingSalvar}>
                {pendingSalvar ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Confirmar importação"}
              </Button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-left px-3 py-2">Categoria</th>
                  <th className="text-left px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {linhas.map((l, i) => (
                  <LinhaRow
                    key={i}
                    linha={l}
                    categorias={categorias}
                    onChange={(updated) => {
                      const novas = [...linhas];
                      novas[i] = updated;
                      setLinhas(novas);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaRow({
  linha,
  categorias,
  onChange,
}: {
  linha: LinhaRevisao;
  categorias: CatLite[];
  onChange: (l: LinhaRevisao) => void;
}) {
  const isEntrada = linha.tipo === "entrada";
  const corValor = isEntrada ? "text-emerald-300" : "text-gray-200";

  return (
    <tr className={"hover:bg-gray-800/30 " + (linha.acao === "ignorar" ? "opacity-40" : "")}>
      <td className="px-3 py-2 text-gray-400 whitespace-nowrap text-xs">{formatDate(linha.data)}</td>
      <td className="px-3 py-2">
        <div className="text-gray-200">{linha.descricao}</div>
        <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
          {linha.fornecedor && <span>{linha.fornecedor}</span>}
          {linha.eh_transferencia_interna && <span className="text-blue-400">↔ transferência interna</span>}
          {linha.eh_estorno_par && <span className="text-amber-400">⚠ estorno (par)</span>}
          {linha.origem_externa && <span className="text-emerald-400">→ {linha.origem_externa}</span>}
        </div>
      </td>
      <td className={"px-3 py-2 text-right font-mono whitespace-nowrap " + corValor}>
        {isEntrada ? "+" : "−"}{formatBRL(linha.valor)}
      </td>
      <td className="px-3 py-2">
        <select
          value={linha.categoria_id || ""}
          onChange={(e) => onChange({ ...linha, categoria_id: e.target.value || null })}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white w-full max-w-[180px]"
          disabled={linha.acao === "ignorar" || linha.eh_transferencia_interna}
        >
          <option value="">— sem —</option>
          {categorias
            .filter((c) => c.tipo === "ambos" || c.tipo === (isEntrada ? "receita" : "despesa"))
            .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onChange({ ...linha, acao: "criar" })}
            className={"p-1.5 rounded transition-colors " + (linha.acao === "criar" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700")}
            title="Criar nova"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {linha.candidatos && linha.candidatos.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...linha, acao: "vincular", transacao_prevista_id: linha.candidatos![0].id })}
              className={"p-1.5 rounded transition-colors " + (linha.acao === "vincular" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700")}
              title={`Vincular: ${linha.candidatos.length} candidato(s)`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange({ ...linha, acao: "ignorar" })}
            className={"p-1.5 rounded transition-colors " + (linha.acao === "ignorar" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700")}
            title="Ignorar"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
        {linha.acao === "vincular" && linha.candidatos && linha.candidatos.length > 1 && (
          <select
            value={linha.transacao_prevista_id ?? ""}
            onChange={(e) => onChange({ ...linha, transacao_prevista_id: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white mt-1 w-full"
          >
            {linha.candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao} — {formatDate(c.data_competencia)} — {formatBRL(c.valor)}
              </option>
            ))}
          </select>
        )}
      </td>
    </tr>
  );
}

// Helpers
function categoriaIdSugerida(sugerida: string | null, cats: CatLite[]): string | null {
  if (!sugerida) return null;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const target = norm(sugerida);
  const match = cats.find((c) => norm(c.nome) === target || norm(c.nome).includes(target));
  return match?.id ?? null;
}

// Pra cartão, a movimentação cai numa conta — pega conta padrão do cartão (futura: olhar conta_pagamento_id)
function contaPagamentoDeCartao(cartaoId: string, cartoes: CartLite[]): string {
  // Por ora, retorna primeira conta da entidade do cartão. Server Action vai escolher melhor.
  const c = cartoes.find((x) => x.id === cartaoId);
  return c?.entidade_id ?? "";
}

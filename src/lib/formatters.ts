/**
 * Formatadores compartilhados (moeda, datas, etc).
 */

export function formatBRL(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parse flexível de string monetária BR (aceita "1234,56", "1.234,56", "1234.56", etc).
 * Retorna 0 se inválido.
 */
export function parseBRL(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  const s = String(input).replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  // Se tem vírgula, é o separador decimal padrão BR
  if (s.includes(",")) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  // Sem vírgula: ponto é decimal (formato US) — mas só se houver UM ponto e a parte após tiver 1-2 dígitos
  const dotCount = (s.match(/\./g) ?? []).length;
  if (dotCount === 1) {
    const [, dec] = s.split(".");
    if (dec.length <= 2) {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }
  }
  // Sem vírgula e múltiplos pontos (ou ponto seguido de 3+ dígitos): pontos são milhares
  const n = parseFloat(s.replace(/\./g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formata número como string editável no padrão BR: "1.234,56" (sem prefixo R$).
 * Útil pra preencher inputs.
 */
export function formatBRLEditable(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? parseBRL(valor) : (valor ?? 0);
  if (!Number.isFinite(n) || n === 0) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Máscara que limpa caracteres inválidos enquanto o usuário digita um valor monetário.
 * Permite dígitos, ponto e vírgula. Não força formato — só remove lixo.
 */
export function maskBRLInput(input: string): string {
  return input.replace(/[^\d.,]/g, "");
}

/**
 * Normaliza nome pra busca/dedup (lowercase, sem acentos, trim).
 */
export function normalizeNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

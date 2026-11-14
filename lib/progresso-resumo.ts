// Resumo do topo da tela Progresso e abas dos gráficos (funções puras).
import { somarDias } from "@/lib/datas";

export const ABAS_GRAFICO = ["peso", "calorias", "deficit", "proteina", "treinos", "composicao"] as const;
export type AbaGrafico = (typeof ABAS_GRAFICO)[number];
export const ROTULOS_ABA: Record<AbaGrafico, string> = {
  peso: "Peso",
  calorias: "Calorias",
  deficit: "Déficit",
  proteina: "Proteína",
  treinos: "Treinos",
  composicao: "Composição",
};

export function abaValida(v: unknown): AbaGrafico {
  return typeof v === "string" && (ABAS_GRAFICO as readonly string[]).includes(v) ? (v as AbaGrafico) : "peso";
}

export type PontoTendencia = { data: string; tendencia: number };

export type ResumoPeso = {
  /** Tendência de hoje menos a tendência de ~30 dias atrás (negativo = perdeu). Null sem histórico suficiente. */
  variacao30d: number | null;
  /** Quanto falta da tendência atual até o peso da meta (positivo = ainda acima da meta). */
  faltaParaMeta: number | null;
  /** Dias desde a última pesagem. */
  diasSemPesar: number | null;
};

const arred = (v: number) => Math.round(v * 10) / 10;
const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/**
 * Compara a tendência mais recente com a tendência no ponto mais próximo de 30 dias antes (aceita de 21 a 45 dias,
 * para não comparar com uma pesagem de ontem nem de meses atrás). Tendência em ordem crescente de data.
 */
export function resumirPeso(tendencia: PontoTendencia[], hoje: string, pesoMetaKg: number | null): ResumoPeso {
  const ultimo = tendencia.at(-1);
  if (!ultimo) return { variacao30d: null, faltaParaMeta: null, diasSemPesar: null };
  const alvo = somarDias(ultimo.data, -30);
  let base: PontoTendencia | null = null;
  for (const p of tendencia) {
    const d = dias(p.data, ultimo.data);
    if (d < 21 || d > 45) continue;
    if (!base || Math.abs(dias(p.data, alvo)) < Math.abs(dias(base.data, alvo))) base = p;
  }
  return {
    variacao30d: base ? arred(ultimo.tendencia - base.tendencia) : null,
    faltaParaMeta: pesoMetaKg === null ? null : arred(ultimo.tendencia - pesoMetaKg),
    diasSemPesar: Math.max(0, dias(ultimo.data, hoje)),
  };
}

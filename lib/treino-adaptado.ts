// Adaptar o treino de hoje: versão que cabe no tempo, pular ou trocar exercício, só para aquele dia.
// Funções puras. O plano nunca é alterado; a adaptação é uma camada aplicada na hora de mostrar o treino.
import { normalizarBusca } from "@/lib/busca";

export const MINUTOS_OPCOES = [15, 20, 30, 45, 60] as const;
export type MinutosOpcao = (typeof MINUTOS_OPCOES)[number];
export const SERIES_MINIMAS = 2;
/** Execução estimada de uma série por repetições (segundos). */
export const EXECUCAO_SERIE_S = 40;
/** Troca entre exercícios (ajustar aparelho, pegar carga). */
export const TRANSICAO_S = 60;

export type ItemParaAdaptar = {
  id: string;
  /** Séries previstas hoje (já resolvidas pela fase do plano). */
  series: number;
  repsMax: number;
  descansoS: number;
  porSegundos: boolean;
  exercicioId: string;
  grupo: string | null;
  substitutos: ReadonlyArray<{ id: string; nome: string }>;
};

export type AjusteItem = {
  itemId: string;
  series: number;
  pular: boolean;
  /** Exercício usado no lugar do principal (null = o do plano). */
  exercicioId: string | null;
};

export type Adaptacao = { minutos: number | null; itens: AjusteItem[] };

/** Segundos de um exercício com N séries: execução de cada série e descanso entre elas. */
export function segundosDoExercicio(item: Pick<ItemParaAdaptar, "repsMax" | "descansoS" | "porSegundos">, series: number): number {
  if (series <= 0) return 0;
  const execucao = item.porSegundos ? item.repsMax : EXECUCAO_SERIE_S;
  return series * execucao + (series - 1) * item.descansoS;
}

/** Duração estimada (minutos, arredondada) de uma lista de exercícios com as séries dadas. */
export function minutosEstimados(itens: ReadonlyArray<Pick<ItemParaAdaptar, "repsMax" | "descansoS" | "porSegundos"> & { series: number }>): number {
  const ativos = itens.filter((i) => i.series > 0);
  const s = ativos.reduce((t, i) => t + segundosDoExercicio(i, i.series), 0) + Math.max(0, ativos.length - 1) * TRANSICAO_S;
  return Math.round(s / 60);
}

/** Ajuste neutro (treino completo). */
export function semAjuste(itens: ReadonlyArray<ItemParaAdaptar>): AjusteItem[] {
  return itens.map((i) => ({ itemId: i.id, series: i.series, pular: false, exercicioId: null }));
}

/**
 * Versão que cabe em `minutos`: primeiro tira uma série por vez do exercício com mais séries (empate: o mais ao
 * fim), sem descer abaixo de SERIES_MINIMAS (quem já tinha menos fica como está); se ainda não couber, pula
 * exercícios a partir do fim, mantendo pelo menos o primeiro. Trocas já escolhidas são mantidas.
 */
export function versaoNoTempo(itens: ReadonlyArray<ItemParaAdaptar>, minutos: number, base?: ReadonlyArray<AjusteItem>): AjusteItem[] {
  const trocas = new Map((base ?? []).map((a) => [a.itemId, a.exercicioId]));
  const ajustes = itens.map((i) => ({ itemId: i.id, series: i.series, pular: false, exercicioId: trocas.get(i.id) ?? null }));
  const porId = new Map(itens.map((i) => [i.id, i]));
  const segundos = () => {
    const ativos = ajustes.filter((a) => !a.pular);
    return ativos.reduce((t, a) => t + segundosDoExercicio(porId.get(a.itemId)!, a.series), 0) + Math.max(0, ativos.length - 1) * TRANSICAO_S;
  };
  const limite = minutos * 60;
  while (segundos() > limite) {
    let alvo = -1;
    for (let k = 0; k < ajustes.length; k++) {
      const a = ajustes[k];
      if (a.pular || a.series <= SERIES_MINIMAS) continue;
      if (alvo < 0 || a.series >= ajustes[alvo].series) alvo = k;
    }
    if (alvo >= 0) {
      ajustes[alvo].series -= 1;
      continue;
    }
    const ativos = ajustes.map((a, k) => (a.pular ? -1 : k)).filter((k) => k >= 0);
    if (ativos.length <= 1) break; // nunca tira tudo
    ajustes[ativos.at(-1)!].pular = true;
  }
  return ajustes;
}

export type Alternativa = { id: string; nome: string; origem: "substituto" | "mesmo_grupo" };

/** Alternativas para trocar um exercício: substitutos do plano e exercícios próprios do mesmo grupo muscular. */
export function alternativas(
  item: ItemParaAdaptar,
  exerciciosDoUsuario: ReadonlyArray<{ id: string; nome: string; grupo: string | null }>,
  limite = 8,
): Alternativa[] {
  const vistos = new Set<string>([item.exercicioId]);
  const lista: Alternativa[] = [];
  for (const s of item.substitutos) {
    if (vistos.has(s.id)) continue;
    vistos.add(s.id);
    lista.push({ id: s.id, nome: s.nome, origem: "substituto" });
  }
  const grupo = item.grupo ? normalizarBusca(item.grupo) : "";
  if (grupo) {
    for (const e of [...exerciciosDoUsuario].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
      if (vistos.has(e.id) || !e.grupo || normalizarBusca(e.grupo) !== grupo) continue;
      vistos.add(e.id);
      lista.push({ id: e.id, nome: e.nome, origem: "mesmo_grupo" });
    }
  }
  return lista.slice(0, limite);
}

/** A adaptação muda algo em relação ao treino completo? */
export function ehAdaptado(itens: ReadonlyArray<ItemParaAdaptar>, ajustes: ReadonlyArray<AjusteItem>): boolean {
  const porId = new Map(itens.map((i) => [i.id, i]));
  return ajustes.some((a) => a.pular || a.exercicioId !== null || a.series !== porId.get(a.itemId)?.series);
}

/**
 * Confere uma adaptação vinda do cliente contra o treino real: um ajuste por item do treino, séries de 1 até as
 * previstas, troca só para uma alternativa válida, pelo menos um exercício mantido. Devolve null se algo não bate.
 */
export function validarAdaptacao(
  itens: ReadonlyArray<ItemParaAdaptar>,
  ajustes: ReadonlyArray<AjusteItem>,
  exerciciosDoUsuario: ReadonlyArray<{ id: string; nome: string; grupo: string | null }>,
): AjusteItem[] | null {
  if (ajustes.length !== itens.length) return null;
  const porId = new Map(ajustes.map((a) => [a.itemId, a]));
  if (porId.size !== itens.length) return null;
  const saida: AjusteItem[] = [];
  for (const item of itens) {
    const a = porId.get(item.id);
    if (!a) return null;
    if (!Number.isInteger(a.series) || a.series < 1 || a.series > item.series) return null;
    if (a.exercicioId !== null && !alternativas(item, exerciciosDoUsuario, 500).some((alt) => alt.id === a.exercicioId)) return null;
    saida.push({ itemId: item.id, series: a.series, pular: a.pular === true, exercicioId: a.exercicioId });
  }
  if (saida.every((a) => a.pular)) return null;
  return saida;
}

/**
 * Aplica a adaptação guardada aos itens do dia. Itens que não existem mais no treino são ignorados; itens novos
 * (adicionados ao plano depois da adaptação) entram completos. Uma troca que deixou de ser válida volta ao
 * exercício do plano.
 */
export function aplicarAdaptacao<T extends ItemParaAdaptar>(
  itens: ReadonlyArray<T>,
  ajustes: ReadonlyArray<AjusteItem>,
  exerciciosDoUsuario: ReadonlyArray<{ id: string; nome: string; grupo: string | null }>,
): Array<T & { exercicioEscolhido: string | null }> {
  const porId = new Map(ajustes.map((a) => [a.itemId, a]));
  const saida: Array<T & { exercicioEscolhido: string | null }> = [];
  for (const item of itens) {
    const a = porId.get(item.id);
    if (a?.pular) continue;
    const series = a ? Math.min(Math.max(1, a.series), item.series) : item.series;
    const troca = a?.exercicioId && alternativas(item, exerciciosDoUsuario, 500).some((x) => x.id === a.exercicioId) ? a.exercicioId : null;
    saida.push({ ...item, series, exercicioEscolhido: troca });
  }
  return saida;
}

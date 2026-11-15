import "server-only";

import { seriesDoExercicio, treinoDoDia, type PlanoSeries } from "@/lib/treino";
import { aplicarAdaptacao, type ItemParaAdaptar } from "@/lib/treino-adaptado";
import { obterAdaptacao, type AdaptacaoDoDia } from "./adaptacoes";
import { listarExercicios, listarItensDoTreino, listarTreinos, obterAgenda, obterTrocas, type ItemDoTreino } from "./treino";
import { exigirId } from "./util";

export type ItemDoDia = ItemDoTreino & ItemParaAdaptar;

/** Converte os itens do plano em itens do dia (séries já resolvidas pela fase do plano). */
export function paraItensDoDia(itens: ReadonlyArray<ItemDoTreino>, plano: PlanoSeries, data: string): ItemDoDia[] {
  return itens.map((i) => ({
    ...i,
    series: seriesDoExercicio(i.series, plano, data),
    porSegundos: i.exercicio.medida === "segundos",
    exercicioId: i.exercicio.id,
    grupo: i.exercicio.grupo,
    substitutos: i.substitutos,
  }));
}

export type TreinoDoDia = {
  treino: { id: string; nome: string; foco: string | null };
  /** Itens completos do plano (para a tela de adaptar). */
  completos: ItemDoDia[];
  /** Itens com a adaptação do dia aplicada (o que se treina hoje). */
  doDia: Array<ItemDoDia & { exercicioEscolhido: string | null }>;
  adaptacao: AdaptacaoDoDia | null;
  exercicios: Array<{ id: string; nome: string; grupo: string | null; unilateral: boolean; cargaPorHalter: boolean; medida: string; fotoId: string | null }>;
};

/**
 * Treino do dia com a adaptação aplicada. Uma adaptação feita para outro treino (o treino do dia foi trocado depois)
 * é ignorada.
 */
export async function carregarTreinoDoDia(userId: string, plano: PlanoSeries & { id: string }, data: string): Promise<TreinoDoDia | null> {
  exigirId(userId);
  const [agenda, trocas, treinos] = await Promise.all([obterAgenda(userId), obterTrocas(userId, data, data), listarTreinos(userId, plano.id)]);
  const treino = treinos.find((t) => t.id === treinoDoDia(data, agenda, trocas));
  if (!treino) return null;
  const [itens, adaptacaoBruta, exercicios] = await Promise.all([listarItensDoTreino(userId, treino.id), obterAdaptacao(userId, data), listarExercicios(userId)]);
  const completos = paraItensDoDia(itens, plano, data);
  const adaptacao = adaptacaoBruta && adaptacaoBruta.treinoId === treino.id ? adaptacaoBruta : null;
  const doDia = adaptacao ? aplicarAdaptacao(completos, adaptacao.itens, exercicios) : completos.map((i) => ({ ...i, exercicioEscolhido: null }));
  return { treino: { id: treino.id, nome: treino.nome, foco: treino.foco }, completos, doDia, adaptacao, exercicios };
}

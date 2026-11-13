import { z } from "zod";

export const tipoAutorizacaoSchema = z.enum(["edicao", "fotos"]);
export const solicitarAutorizacaoSchema = z.object({ alunoId: z.uuid(), tipo: tipoAutorizacaoSchema });
export const decidirAutorizacaoSchema = z.object({ pedidoId: z.uuid(), decisao: z.enum(["aceitar", "recusar"]) });
export const contextoAcompanhamentoSchema = z.union([z.literal("proprio"), z.uuid()]);

/** O horário livre do formulário é sempre interpretado em America/Sao_Paulo. */
export function converterPrazoSaoPaulo(valor: string, agora = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}:00-03:00`);
  if (!Number.isFinite(data.getTime()) || data <= agora) return null;
  // Detecta normalização automática de dias impossíveis pelo Date.
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return local === valor ? data : null;
}

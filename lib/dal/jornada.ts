import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jornadasIniciais } from "@/lib/db/schema";
import {
  aplicarRespostas,
  etapaDisponivel,
  etapaSeguinte,
  tamanhoRascunho,
  TAMANHO_MAX_RASCUNHO,
  type Etapa,
  type EstadoJornada,
  type Rascunho,
} from "@/lib/jornada";
import { rascunhoSchema, salvarEtapaSchema, validarRespostas } from "@/lib/validacao/jornada";
import type { ErrosCampos } from "@/lib/validacao/comum";
import { errosPorCampo } from "@/lib/validacao/comum";
import { exigirId } from "./util";

// Jornada inicial da própria conta. Toda função recebe o user_id da SESSÃO (as Actions da 2B o obtêm com
// exigirContaPropria) e filtra por ele. O rascunho não é dado aplicado: nada aqui altera perfil, pesagens ou metas.

export type Jornada = {
  versao: number;
  revisao: number;
  estado: EstadoJornada;
  etapa: Etapa;
  rascunho: Rascunho;
  /** O rascunho guardado não passou na validação atual (ex.: versão antiga): tratado como vazio, sem perder a linha. */
  rascunhoInvalido: boolean;
  tutorial: { estado: string; passo?: string };
  criadoEm: Date;
  atualizadoEm: Date;
  concluidoEm: Date | null;
};

export type ResultadoSalvar =
  | { status: "salvo"; revisao: number; etapa: Etapa }
  | { status: "conflito"; revisao: number }
  | { status: "inexistente" }
  | { status: "encerrada" }
  | { status: "etapa_indisponivel" }
  | { status: "invalido"; erros: ErrosCampos };

function paraJornada(r: typeof jornadasIniciais.$inferSelect): Jornada {
  const rascunho = rascunhoSchema.safeParse(r.rascunho);
  return {
    versao: r.versao,
    revisao: r.revisao,
    estado: r.estado as EstadoJornada,
    etapa: r.etapa as Etapa,
    rascunho: rascunho.success ? (rascunho.data as Rascunho) : {},
    rascunhoInvalido: !rascunho.success,
    tutorial: r.tutorial as Jornada["tutorial"],
    criadoEm: r.criadoEm,
    atualizadoEm: r.atualizadoEm,
    concluidoEm: r.concluidoEm,
  };
}

export async function obterJornada(userId: string): Promise<Jornada | null> {
  exigirId(userId);
  const [r] = await db.select().from(jornadasIniciais).where(eq(jornadasIniciais.userId, userId)).limit(1);
  return r ? paraJornada(r) : null;
}

/** Cria a jornada se ainda não existir (repetir não zera nem duplica) e devolve o estado atual. */
export async function iniciarJornada(userId: string): Promise<Jornada> {
  exigirId(userId);
  await db.insert(jornadasIniciais).values({ userId }).onConflictDoNothing({ target: jornadasIniciais.userId });
  const j = await obterJornada(userId);
  if (!j) throw new Error("jornada não encontrada após criar");
  return j;
}

/**
 * Salva as respostas de uma etapa com controle otimista: só grava se a revisão guardada for a esperada, e a
 * revisão sobe na MESMA instrução (duas abas com a mesma revisão: só uma avança, a outra recebe "conflito").
 * Entrada: { versao, revisaoEsperada, etapa, respostas } — a identidade nunca vem daqui.
 */
export async function salvarEtapaJornada(userId: string, entrada: unknown): Promise<ResultadoSalvar> {
  exigirId(userId);
  const contrato = salvarEtapaSchema.safeParse(entrada);
  if (!contrato.success) return { status: "invalido", erros: errosPorCampo(contrato.error) };
  const { revisaoEsperada, etapa } = contrato.data;
  const respostas = validarRespostas(etapa, contrato.data.respostas);
  if (!respostas.ok) return { status: "invalido", erros: respostas.erros };

  const atual = await obterJornada(userId);
  if (!atual) return { status: "inexistente" };
  if (atual.estado === "concluida") return { status: "encerrada" };
  if (atual.revisao !== revisaoEsperada) return { status: "conflito", revisao: atual.revisao };
  if (!etapaDisponivel(atual.rascunho, etapa)) return { status: "etapa_indisponivel" };

  const novo = aplicarRespostas(atual.rascunho, etapa, respostas.respostas as never);
  if (!rascunhoSchema.safeParse(novo).success) return { status: "invalido", erros: { _: "Respostas fora do formato." } };
  if (tamanhoRascunho(novo) > TAMANHO_MAX_RASCUNHO) return { status: "invalido", erros: { _: "Respostas grandes demais." } };
  const proxima = etapaSeguinte(novo, etapa);

  const [gravado] = await db
    .update(jornadasIniciais)
    .set({
      rascunho: novo,
      etapa: proxima,
      revisao: sql`${jornadasIniciais.revisao} + 1`,
      estado: "em_andamento",
      atualizadoEm: new Date(),
    })
    .where(and(eq(jornadasIniciais.userId, userId), eq(jornadasIniciais.revisao, revisaoEsperada), ne(jornadasIniciais.estado, "concluida")))
    .returning({ revisao: jornadasIniciais.revisao });
  if (gravado) return { status: "salvo", revisao: gravado.revisao, etapa: proxima };

  // Outra aba gravou (ou a jornada mudou de estado) entre a leitura e a gravação.
  const depois = await obterJornada(userId);
  if (!depois) return { status: "inexistente" };
  if (depois.estado === "concluida") return { status: "encerrada" };
  return { status: "conflito", revisao: depois.revisao };
}

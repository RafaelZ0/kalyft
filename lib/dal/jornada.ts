import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jornadasIniciais, perfis, pesagens } from "@/lib/db/schema";
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
import { planoDeAplicacao, preferenciasDoRascunho, type CampoPerfilJornada, type PerfilAtual, type PlanoAplicacao } from "@/lib/jornada-aplicacao";
import { finalizarSchema, rascunhoSchema, salvarEtapaSchema, validarRespostas } from "@/lib/validacao/jornada";
import { lerTutorial, tutorialSchema, type EstadoTutorial } from "@/lib/tutorial-inicial";
import type { ErrosCampos } from "@/lib/validacao/comum";
import { errosPorCampo } from "@/lib/validacao/comum";
import { exigirId } from "./util";

// Jornada inicial da própria conta. Toda função recebe o user_id da SESSÃO (as Actions obtêm com
// exigirContaPropria) e filtra por ele. O rascunho não é dado aplicado: perfil e pesagens só mudam em
// finalizarJornada, depois da revisão confirmada.

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

// ───────────── adiar, retomar, revisão e finalização (2B) ─────────────

/** "Agora não": cria a jornada já adiada ou adia a existente em andamento. Não mexe no rascunho nem na revisão. */
export async function adiarJornada(userId: string): Promise<void> {
  exigirId(userId);
  await db
    .insert(jornadasIniciais)
    .values({ userId, estado: "adiada" })
    .onConflictDoUpdate({
      target: jornadasIniciais.userId,
      set: { estado: "adiada", atualizadoEm: new Date() },
      setWhere: eq(jornadasIniciais.estado, "em_andamento"),
    });
}

/** Volta uma jornada adiada para "em andamento" (retomar pela Conta ou pelo convite). */
export async function retomarJornada(userId: string): Promise<void> {
  exigirId(userId);
  await db
    .update(jornadasIniciais)
    .set({ estado: "em_andamento", atualizadoEm: new Date() })
    .where(and(eq(jornadasIniciais.userId, userId), eq(jornadasIniciais.estado, "adiada")));
}

async function dadosAtuais(userId: string, dataPesagem: string | undefined) {
  const [p] = await db
    .select({ nome: perfis.nome, dataNascimento: perfis.dataNascimento, sexo: perfis.sexo, alturaCm: perfis.alturaCm, nivelAtividade: perfis.nivelAtividade })
    .from(perfis)
    .where(eq(perfis.userId, userId))
    .limit(1);
  const [pes] = dataPesagem
    ? await db
        .select({ pesoKg: pesagens.pesoKg, massaMagraKg: pesagens.massaMagraKg })
        .from(pesagens)
        .where(and(eq(pesagens.userId, userId), eq(pesagens.data, dataPesagem)))
        .limit(1)
    : [];
  return { perfil: (p ?? null) as PerfilAtual | null, pesagem: pes ?? null };
}

/** Tudo o que a tela de revisão precisa, calculado no servidor a partir do rascunho guardado. */
export async function carregarRevisao(userId: string): Promise<{ jornada: Jornada; plano: PlanoAplicacao; atual: PerfilAtual } | null> {
  exigirId(userId);
  const jornada = await obterJornada(userId);
  if (!jornada) return null;
  const { perfil, pesagem } = await dadosAtuais(userId, jornada.rascunho.perfil?.dataPesagem);
  if (!perfil) return null;
  return { jornada, plano: planoDeAplicacao(jornada.rascunho, perfil, pesagem), atual: perfil };
}

export type ResultadoFinalizar =
  | { status: "concluida"; camposAplicados: number; pesagem: "registrada" | "substituida" | "mantida" | "nenhuma" }
  | { status: "conflito"; revisao: number }
  | { status: "desatualizado" }
  | { status: "incompleta" }
  | { status: "inexistente" }
  | { status: "encerrada" }
  | { status: "invalido"; erros: ErrosCampos };

// Colunas do perfil que a jornada pode aplicar (nomes fixos no código: nada vem do usuário).
const COLUNAS: Record<CampoPerfilJornada, { coluna: string; tipo: string }> = {
  nome: { coluna: "nome", tipo: "text" },
  dataNascimento: { coluna: "data_nascimento", tipo: "date" },
  sexo: { coluna: "sexo", tipo: "text" },
  alturaCm: { coluna: "altura_cm", tipo: "numeric" },
  nivelAtividade: { coluna: "nivel_atividade", tipo: "text" },
};
const igual = (a: unknown, b: unknown) => (a === null || a === undefined ? b === null || b === undefined : String(a) === String(b));

/**
 * Confirma a revisão. Os VALORES aplicados vêm do rascunho guardado; a pessoa só escolhe quais campos trocar e o
 * que fazer com a pesagem. Tudo numa ÚNICA instrução SQL (CTEs que modificam dados): a jornada só conclui se a
 * revisão for a esperada E o perfil/pesagem ainda forem os que a tela mostrou; perfil e pesagem só mudam se a
 * jornada concluiu. Ou tudo, ou nada.
 */
export async function finalizarJornada(userId: string, entrada: unknown): Promise<ResultadoFinalizar> {
  exigirId(userId);
  const e = finalizarSchema.safeParse(entrada);
  if (!e.success) return { status: "invalido", erros: errosPorCampo(e.error) };
  const { revisaoEsperada, aplicar, vistos, pesagem: escolha, pesoVisto } = e.data;

  const jornada = await obterJornada(userId);
  if (!jornada) return { status: "inexistente" };
  if (jornada.estado === "concluida") return { status: "encerrada" };
  if (jornada.revisao !== revisaoEsperada) return { status: "conflito", revisao: jornada.revisao };
  if (!etapaDisponivel(jornada.rascunho, "revisao")) return { status: "incompleta" };

  const { perfil: atual, pesagem: pesagemAtual } = await dadosAtuais(userId, jornada.rascunho.perfil?.dataPesagem);
  if (!atual) return { status: "inexistente" };
  const plano = planoDeAplicacao(jornada.rascunho, atual, pesagemAtual);

  // A tela precisa ter visto os mesmos valores atuais; senão, refaz a revisão.
  if (aplicar.some((c) => !plano.perfil.some((m) => m.campo === c))) return { status: "desatualizado" };
  const mudancas = plano.perfil.filter((m) => aplicar.includes(m.campo));
  if (mudancas.some((m) => !igual(vistos[m.campo], m.atual))) return { status: "desatualizado" };

  // A escolha da pesagem precisa combinar com a situação atual.
  const pp = plano.pesagem;
  const pesagemOk =
    (escolha === "registrar" && pp.tipo === "nova") ||
    (escolha === "substituir" && pp.tipo === "existente" && pp.podeSubstituir && pesoVisto === pp.pesoAtualKg) ||
    (escolha === "manter" && pp.tipo === "existente" && pesoVisto === pp.pesoAtualKg) ||
    (escolha === "nenhuma" && (pp.tipo === "nenhuma" || pp.tipo === "sem_data" || pp.tipo === "igual" || pp.tipo === "nova"));
  if (!pesagemOk) return { status: "desatualizado" };

  const condPerfil = mudancas.map((m) => {
    const c = COLUNAS[m.campo];
    return sql` and ${sql.raw(c.coluna)} is not distinct from ${m.atual === null ? null : String(m.atual)}::${sql.raw(c.tipo)}`;
  });
  const setPerfil = mudancas.map((m) => {
    const c = COLUNAS[m.campo];
    return sql`${sql.raw(c.coluna)} = ${String(m.novo)}::${sql.raw(c.tipo)}`;
  });
  const temData = pp.tipo === "nova" || pp.tipo === "existente";
  const data = temData ? pp.data : null;
  const novoPeso = temData ? pp.pesoKg : null;
  const gravarPeso = temData && (escolha === "registrar" || escolha === "substituir");
  let condPesagem = sql``;
  if (escolha === "registrar") {
    condPesagem = sql` and not exists (select 1 from pesagens where user_id = ${userId} and data = ${data}::date)`;
  } else if (escolha === "substituir") {
    condPesagem = sql` and exists (select 1 from pesagens where user_id = ${userId} and data = ${data}::date and peso_kg = ${pesoVisto}
      and (massa_magra_kg is null or massa_magra_kg <= ${novoPeso}))`;
  } else if (escolha === "manter") {
    condPesagem = sql` and exists (select 1 from pesagens where user_id = ${userId} and data = ${data}::date and peso_kg = ${pesoVisto})`;
  }
  const preferencias = JSON.stringify(preferenciasDoRascunho(jornada.rascunho));
  const cteUnico = sql`
    with j as (
      update jornadas_iniciais
         set estado = 'concluida', concluido_em = now(), etapa = 'inicio', revisao = revisao + 1,
             preferencias = ${preferencias}::jsonb, atualizado_em = now()
       where user_id = ${userId} and revisao = ${revisaoEsperada} and estado <> 'concluida'
         and exists (select 1 from perfis where user_id = ${userId}${sql.join(condPerfil, sql``)})
         ${condPesagem}
      returning user_id
    )`;
  const ctePerfil = setPerfil.length
    ? sql`, p as (update perfis set ${sql.join(setPerfil, sql`, `)}, atualizado_em = now() where user_id in (select user_id from j) returning 1)`
    : sql``;
  const ctePeso = gravarPeso
    ? sql`, w as (insert into pesagens (user_id, data, peso_kg) select user_id, ${data}::date, ${novoPeso} from j
        on conflict (user_id, data) do update set peso_kg = excluded.peso_kg returning 1)`
    : sql``;
  const r = await db.execute<{ concluiu: number }>(sql`${cteUnico}${ctePerfil}${ctePeso} select count(*)::int as concluiu from j`);

  if (Number(r.rows[0]?.concluiu ?? 0) === 1) {
    const pesagem = escolha === "registrar" ? "registrada" : escolha === "substituir" ? "substituida" : escolha === "manter" ? "mantida" : "nenhuma";
    return { status: "concluida", camposAplicados: mudancas.length, pesagem };
  }
  const depois = await obterJornada(userId);
  if (!depois) return { status: "inexistente" };
  if (depois.estado === "concluida") return { status: "encerrada" };
  if (depois.revisao !== revisaoEsperada) return { status: "conflito", revisao: depois.revisao };
  return { status: "desatualizado" };
}

// ───────────── passeio pelo app (2C) ─────────────

/** Estado do passeio e a área escolhida na jornada (para montar o roteiro). Sem jornada: não iniciado. */
export async function obterTutorial(userId: string): Promise<{ tutorial: EstadoTutorial; area: "comida" | "treino" | "ambos" | undefined }> {
  exigirId(userId);
  const [r] = await db
    .select({ tutorial: jornadasIniciais.tutorial, rascunho: jornadasIniciais.rascunho })
    .from(jornadasIniciais)
    .where(eq(jornadasIniciais.userId, userId))
    .limit(1);
  if (!r) return { tutorial: { estado: "nao_iniciado" }, area: undefined };
  const rascunho = rascunhoSchema.safeParse(r.rascunho);
  return { tutorial: lerTutorial(r.tutorial), area: rascunho.success ? rascunho.data.foco?.area : undefined };
}

/**
 * Guarda o estado do passeio (validado). Quem nunca fez a jornada ganha uma linha "adiada" só para guardar o
 * passeio (o convite do Hoje não reaparece; a jornada continua disponível em Conta). Não mexe no rascunho.
 */
export async function atualizarTutorial(userId: string, tutorial: EstadoTutorial): Promise<boolean> {
  exigirId(userId);
  const t = tutorialSchema.safeParse(tutorial);
  if (!t.success) return false;
  await db
    .insert(jornadasIniciais)
    .values({ userId, estado: "adiada", tutorial: t.data })
    .onConflictDoUpdate({ target: jornadasIniciais.userId, set: { tutorial: t.data, atualizadoEm: new Date() } });
  return true;
}

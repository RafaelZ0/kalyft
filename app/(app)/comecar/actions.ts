"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirContaPropria } from "@/lib/auth/acompanhamento";
import { adiarJornada, finalizarJornada, iniciarJornada, retomarJornada, salvarEtapaJornada } from "@/lib/dal/jornada";
import { ETAPAS, ETAPAS_PULAVEIS, VERSAO_JORNADA, type Etapa } from "@/lib/jornada";
import { CAMPOS_PERFIL_JORNADA } from "@/lib/jornada-aplicacao";
import { registrarErro } from "@/lib/log";
import type { ErrosCampos } from "@/lib/validacao/comum";

// Jornada inicial: só na conta própria (exigirContaPropria recusa no acompanhamento de aluno). Toda Action:
// sessão → Zod → DAL com o user_id da sessão. Respostas nunca vão para log.

export type EstadoJornadaForm = { erro?: string; erros?: ErrosCampos; conflito?: boolean };

/** Campos de cada etapa no formulário (os de lista vêm de várias caixas com o mesmo nome). */
const CAMPOS: Record<Etapa, { simples: string[]; listas: string[] }> = {
  foco: { simples: ["area", "primeira"], listas: [] },
  perfil: { simples: ["nome", "nascimento", "sexo", "alturaCm", "pesoKg", "dataPesagem"], listas: [] },
  objetivo: { simples: ["objetivo", "pesoReferenciaKg"], listas: [] },
  rotina: { simples: ["trabalho", "deslocamento"], listas: [] },
  atividade: { simples: ["exercicio", "diasPorSemana", "minutos", "nivelDeclarado"], listas: ["tipos"] },
  treino: { simples: ["metodo", "experiencia", "local", "minutosSessao", "limitacao"], listas: ["equipamentos", "diasSemana"] },
  alimentacao: { simples: ["metodo", "preferencia", "restricao", "alergia", "refeicoesPorDia", "minutosPreparo", "planejamento"], listas: [] },
  revisao: { simples: [], listas: [] },
  inicio: { simples: [], listas: [] },
};

function respostasDoForm(etapa: Etapa, form: FormData): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const c of CAMPOS[etapa].simples) {
    const v = form.get(c);
    if (typeof v === "string" && v.trim() !== "") r[c] = v;
  }
  for (const c of CAMPOS[etapa].listas) {
    const v = form.getAll(c).filter((x): x is string => typeof x === "string" && x !== "");
    if (v.length) r[c] = v;
  }
  return r;
}

const comum = z.object({ etapa: z.enum(ETAPAS), revisao: z.coerce.number().int().min(0) });

export async function iniciarJornadaAcao(): Promise<void> {
  const { userId } = await exigirContaPropria();
  try {
    await iniciarJornada(userId);
    await retomarJornada(userId);
  } catch (e) {
    registrarErro("iniciarJornada", e);
  }
  revalidatePath("/comecar");
  redirect("/comecar");
}

/** "Agora não" para a jornada inteira: some do Hoje; retomável em Conta. */
export async function adiarJornadaAcao(): Promise<void> {
  const { userId } = await exigirContaPropria();
  try {
    await adiarJornada(userId);
  } catch (e) {
    registrarErro("adiarJornada", e);
  }
  revalidatePath("/hoje");
  redirect("/hoje");
}

export async function salvarEtapaAcao(_: EstadoJornadaForm, form: FormData): Promise<EstadoJornadaForm> {
  const { userId } = await exigirContaPropria();
  const c = comum.safeParse({ etapa: form.get("etapa"), revisao: form.get("revisao") });
  if (!c.success) return { erro: "Não foi possível salvar. Atualize a página." };
  const pular = form.get("pular") === "1" && (ETAPAS_PULAVEIS as readonly string[]).includes(c.data.etapa);
  const respostas = pular ? {} : respostasDoForm(c.data.etapa, form);
  let r;
  try {
    r = await salvarEtapaJornada(userId, { versao: VERSAO_JORNADA, revisaoEsperada: c.data.revisao, etapa: c.data.etapa, respostas });
  } catch (e) {
    registrarErro("salvarEtapaJornada", e);
    return { erro: "Não foi possível salvar agora. Suas respostas desta tela continuam aqui; tente de novo." };
  }
  if (r.status === "invalido") return { erros: r.erros, erro: r.erros._ };
  if (r.status === "conflito") return { conflito: true, erro: "Suas respostas foram atualizadas em outra aba ou aparelho. Recarregue para continuar de onde ficou." };
  if (r.status === "inexistente") return { erro: "Seu começo ainda não foi iniciado. Atualize a página." };
  revalidatePath("/comecar");
  redirect("/comecar");
}

const finalizar = z.object({
  revisao: z.coerce.number().int().min(0),
  pesagem: z.enum(["registrar", "substituir", "manter", "nenhuma"]),
  pesoVisto: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().min(0).max(400).nullable()),
});

export async function finalizarJornadaAcao(_: EstadoJornadaForm, form: FormData): Promise<EstadoJornadaForm> {
  const { userId } = await exigirContaPropria();
  const f = finalizar.safeParse({ revisao: form.get("revisao"), pesagem: form.get("pesagem") ?? "nenhuma", pesoVisto: form.get("pesoVisto") });
  if (!f.success) return { erro: "Escolha o que fazer com a pesagem." };
  const aplicar = form.getAll("aplicar").filter((x): x is string => typeof x === "string");
  const vistos: Record<string, string | null> = {};
  for (const campo of CAMPOS_PERFIL_JORNADA) {
    const v = form.get(`visto_${campo}`);
    if (typeof v === "string") vistos[campo] = v === "" ? null : v;
  }
  let r;
  try {
    r = await finalizarJornada(userId, { versao: VERSAO_JORNADA, revisaoEsperada: f.data.revisao, aplicar, vistos, pesagem: f.data.pesagem, pesoVisto: f.data.pesoVisto });
  } catch (e) {
    registrarErro("finalizarJornada", e);
    return { erro: "Não foi possível confirmar agora. Nada foi alterado; tente de novo." };
  }
  if (r.status === "concluida" || r.status === "encerrada") {
    revalidatePath("/", "layout");
    redirect("/comecar");
  }
  if (r.status === "desatualizado" || r.status === "conflito") {
    revalidatePath("/comecar");
    return { conflito: true, erro: "Seus dados mudaram enquanto você revisava. Nada foi alterado. Recarregue a revisão e confira de novo." };
  }
  if (r.status === "incompleta") return { erro: "Falta escolher o foco e o objetivo antes de revisar." };
  if (r.status === "invalido") return { erro: "Escolhas inválidas. Recarregue a revisão." };
  return { erro: "Seu começo não foi encontrado. Atualize a página." };
}

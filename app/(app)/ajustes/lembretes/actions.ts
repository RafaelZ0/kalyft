"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirContaPropria as exigirUsuario } from "@/lib/auth/acompanhamento";
import {
  adiarLembrete,
  apagarLembrete,
  atualizarLembrete,
  criarLembrete,
  inscricaoExiste,
  inscricoesDoUsuario,
  pausarLembrete,
  pausarTodos,
  removerInscricao,
  salvarInscricao,
  type DadosLembrete,
} from "@/lib/dal/lembretes";
import { hojeSaoPaulo } from "@/lib/datas";
import { endpointPushValido, LIMITES_LEMBRETE, minutoValido, pausarAte, TIPOS_LEMBRETE } from "@/lib/lembretes";
import { dentroDoLimite } from "@/lib/limites";
import { registrarErro } from "@/lib/log";
import { enviarPushReal } from "@/lib/push";
import { REFEICOES } from "@/lib/validacao/comida";

// Lembretes e aparelhos são da conta própria (no acompanhamento, exigirContaPropria recusa). Toda action: sessão,
// Zod e user_id da sessão. O endpoint do aparelho nunca vai para log.

export type EstadoLembrete = { ok?: boolean; erro?: string };

const caminho = "/ajustes/lembretes";

const esquemaLembrete = z
  .object({
    tipo: z.enum(TIPOS_LEMBRETE),
    refeicao: z.enum(REFEICOES).nullable(),
    hora: z.coerce.number().int().min(0).max(23),
    min: z.coerce.number().int().refine((m) => [0, 15, 30, 45].includes(m)),
    dias: z.array(z.coerce.number().int()).min(1, "Escolha pelo menos um dia."),
    silenciarFeito: z.boolean(),
    ativo: z.boolean(),
  })
  .refine((d) => (d.tipo === "refeicao") === (d.refeicao !== null), { message: "Escolha a refeição." });

function lerLembrete(form: FormData): { dados: DadosLembrete } | { erro: string } {
  const tipo = form.get("tipo");
  const r = esquemaLembrete.safeParse({
    tipo,
    refeicao: tipo === "refeicao" ? form.get("refeicao") || null : null,
    hora: form.get("hora"),
    min: form.get("min"),
    dias: form.getAll("dias"),
    silenciarFeito: form.get("silenciarFeito") === "on",
    ativo: form.get("ativo") === "on",
  });
  if (!r.success) return { erro: r.error.issues[0]?.message || "Confira os campos." };
  const dias = r.data.dias.reduce((acc, b) => ([1, 2, 4, 8, 16, 32, 64].includes(b) ? acc | b : acc), 0);
  const minuto = r.data.hora * 60 + r.data.min;
  if (dias < 1 || dias > 127) return { erro: "Escolha pelo menos um dia." };
  if (!minutoValido(minuto)) return { erro: "Horário inválido." };
  return {
    dados: { tipo: r.data.tipo, refeicao: r.data.refeicao, minuto, dias, silenciarFeito: r.data.silenciarFeito, ativo: r.data.ativo },
  };
}

const mensagens = {
  limite: `Você já tem ${LIMITES_LEMBRETE.porPessoa} lembretes. Apague um para criar outro.`,
  repetido: "Já existe um lembrete igual nesse horário.",
  nao_encontrado: "Lembrete não encontrado.",
} as const;

export async function criarLembreteAcao(_: EstadoLembrete, form: FormData): Promise<EstadoLembrete> {
  const { userId } = await exigirUsuario();
  const l = lerLembrete(form);
  if ("erro" in l) return { erro: l.erro };
  try {
    const r = await criarLembrete(userId, l.dados);
    if (r !== "ok") return { erro: mensagens[r] };
  } catch (e) {
    registrarErro("criarLembrete", e);
    return { erro: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath(caminho);
  return { ok: true };
}

export async function atualizarLembreteAcao(_: EstadoLembrete, form: FormData): Promise<EstadoLembrete> {
  const { userId } = await exigirUsuario();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: mensagens.nao_encontrado };
  const l = lerLembrete(form);
  if ("erro" in l) return { erro: l.erro };
  try {
    const r = await atualizarLembrete(userId, id.data, l.dados);
    if (r !== "ok") return { erro: mensagens[r] };
  } catch (e) {
    registrarErro("atualizarLembrete", e);
    return { erro: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath(caminho);
  return { ok: true };
}

export async function apagarLembreteAcao(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  try {
    await apagarLembrete(userId, id.data);
  } catch (e) {
    registrarErro("apagarLembrete", e);
  }
  revalidatePath(caminho);
}

export async function pausarTodosAcao(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const dias = z.coerce.number().int().refine((d) => (LIMITES_LEMBRETE.pausarDias as readonly number[]).includes(d)).safeParse(form.get("dias"));
  const retomar = form.get("retomar") === "1";
  if (!retomar && !dias.success) return;
  try {
    await pausarTodos(userId, retomar ? null : pausarAte(hojeSaoPaulo(), dias.data!));
  } catch (e) {
    registrarErro("pausarTodos", e);
  }
  revalidatePath(caminho);
}

/** Faixa aberta pela notificação: "Lembrar de novo em 30 min". */
export async function adiarLembreteAcao(_: EstadoLembrete, form: FormData): Promise<EstadoLembrete> {
  const { userId } = await exigirUsuario();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: mensagens.nao_encontrado };
  try {
    const ok = await adiarLembrete(userId, id.data, new Date(Date.now() + LIMITES_LEMBRETE.adiarMin * 60_000));
    if (!ok) return { erro: mensagens.nao_encontrado };
  } catch (e) {
    registrarErro("adiarLembrete", e);
    return { erro: "Não foi possível agora. Tente de novo." };
  }
  return { ok: true };
}

/** Faixa aberta pela notificação: "Hoje não" (só este lembrete, só hoje). */
export async function hojeNaoAcao(_: EstadoLembrete, form: FormData): Promise<EstadoLembrete> {
  const { userId } = await exigirUsuario();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: mensagens.nao_encontrado };
  try {
    const ok = await pausarLembrete(userId, id.data, hojeSaoPaulo());
    if (!ok) return { erro: mensagens.nao_encontrado };
  } catch (e) {
    registrarErro("pausarLembrete", e);
    return { erro: "Não foi possível agora. Tente de novo." };
  }
  revalidatePath(caminho);
  return { ok: true };
}

// ───────────── aparelho ─────────────

const esquemaInscricao = z.object({
  endpoint: z.string().max(1000).refine(endpointPushValido),
  p256dh: z.string().regex(/^[A-Za-z0-9_-]{20,200}$/),
  auth: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
});

export type EstadoAparelho = { ok?: boolean; erro?: string; inscrito?: boolean };

export async function salvarInscricaoAcao(dados: unknown): Promise<EstadoAparelho> {
  const { userId } = await exigirUsuario();
  if (!(await dentroDoLimite([{ tipo: "inscricaoPushPorUsuario", valor: userId }]))) return { erro: "Muitas tentativas. Tente mais tarde." };
  const r = esquemaInscricao.safeParse(dados);
  if (!r.success) return { erro: "Este aparelho não forneceu uma inscrição válida." };
  try {
    const s = await salvarInscricao(userId, r.data);
    if (s === "limite") return { erro: `Já há ${LIMITES_LEMBRETE.inscricoesPorPessoa} aparelhos com notificações. Desative em um deles.` };
    if (s === "invalida") return { erro: "Este aparelho não forneceu uma inscrição válida." };
  } catch (e) {
    registrarErro("salvarInscricao", e);
    return { erro: "Não foi possível ativar agora. Tente de novo." };
  }
  revalidatePath(caminho);
  return { ok: true, inscrito: true };
}

export async function removerInscricaoAcao(endpoint: unknown): Promise<EstadoAparelho> {
  const { userId } = await exigirUsuario();
  const r = z.string().max(1000).safeParse(endpoint);
  if (!r.success) return { erro: "Inscrição inválida." };
  try {
    await removerInscricao(userId, r.data);
  } catch (e) {
    registrarErro("removerInscricao", e);
    return { erro: "Não foi possível desativar agora. Tente de novo." };
  }
  revalidatePath(caminho);
  return { ok: true, inscrito: false };
}

/** Este aparelho está inscrito nesta conta? (o navegador pode ter uma inscrição de outra conta) */
export async function conferirInscricaoAcao(endpoint: unknown): Promise<boolean> {
  const { userId } = await exigirUsuario();
  const r = z.string().max(1000).safeParse(endpoint);
  if (!r.success) return false;
  try {
    return await inscricaoExiste(userId, r.data);
  } catch (e) {
    registrarErro("conferirInscricao", e);
    return false;
  }
}

export async function enviarTesteAcao(): Promise<EstadoAparelho> {
  const { userId } = await exigirUsuario();
  if (!(await dentroDoLimite([{ tipo: "testeLembretePorUsuario", valor: userId }]))) return { erro: "Você já enviou vários testes. Tente mais tarde." };
  try {
    const inscricoes = await inscricoesDoUsuario(userId);
    if (inscricoes.length === 0) return { erro: "Nenhum aparelho com notificações ativas." };
    let algum = false;
    for (const i of inscricoes) {
      const r = await enviarPushReal(i, { titulo: "Kalyft", corpo: "Teste: as notificações estão funcionando.", url: "/ajustes/lembretes", tag: "teste" });
      if (r === "ok") algum = true;
      if (r === "expirada") await removerInscricao(userId, i.endpoint);
    }
    if (!algum) return { erro: "Não foi possível entregar o teste. Desative e ative de novo neste aparelho." };
  } catch (e) {
    registrarErro("enviarTeste", e);
    return { erro: "Não foi possível enviar agora." };
  }
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { exigirContaPropria, exigirContextoDados } from "@/lib/auth/acompanhamento";
import { exigirAdmin } from "@/lib/auth/sessao";
import { decidirAutorizacao, revogarAutorizacao, solicitarAutorizacao } from "@/lib/dal/acompanhamento";
import { converterPrazoSaoPaulo } from "@/lib/validacao/acompanhamento";

export type EstadoAcompanhamento = { ok?: boolean; erro?: string };
const FALHA = "Não foi possível concluir agora. Tente de novo.";
const idSchema = z.uuid();

function atualizar() {
  revalidatePath("/", "layout");
}

export async function solicitarAcesso(_: EstadoAcompanhamento, form: FormData): Promise<EstadoAcompanhamento> {
  const admin = await exigirAdmin();
  const contexto = await exigirContextoDados();
  if (form.get("contextoId") !== contexto.contextoId) return { erro: "A conta acompanhada mudou. Atualize a página antes de continuar." };
  if (contexto.modo !== "acompanhamento") return { erro: "Escolha um aluno para solicitar autorização." };
  const tipo = z.enum(["edicao", "fotos"]).safeParse(form.get("tipo"));
  if (!tipo.success) return { erro: "Escolha a autorização desejada." };
  try {
    await solicitarAutorizacao(admin, contexto.titularId, tipo.data);
  } catch (erro) {
    unstable_rethrow(erro);
    return { erro: FALHA };
  }
  atualizar();
  return { ok: true };
}

export async function responderPedido(_: EstadoAcompanhamento, form: FormData): Promise<EstadoAcompanhamento> {
  const contexto = await exigirContaPropria();
  const dados = z.object({ pedidoId: idSchema, decisao: z.enum(["aceitar", "recusar"]), tipo: z.enum(["edicao", "fotos"]) })
    .safeParse({ pedidoId: form.get("pedidoId"), decisao: form.get("decisao"), tipo: form.get("tipo") });
  if (!dados.success) return { erro: "Solicitação inválida. Atualize a página." };
  const { pedidoId, decisao, tipo } = dados.data;
  const expiraEm = decisao === "aceitar" && tipo === "edicao" ? converterPrazoSaoPaulo(String(form.get("prazo") ?? "")) : null;
  if (decisao === "aceitar" && tipo === "edicao" && !expiraEm) return { erro: "Escolha uma data e um horário futuros válidos em São Paulo." };
  try {
    if (!(await decidirAutorizacao(contexto.titularId, pedidoId, decisao, expiraEm))) return { erro: "Esta solicitação não está mais disponível. Atualize a página." };
  } catch (erro) {
    unstable_rethrow(erro);
    return { erro: FALHA };
  }
  atualizar();
  return { ok: true };
}

export async function revogarAcesso(_: EstadoAcompanhamento, form: FormData): Promise<EstadoAcompanhamento> {
  const contexto = await exigirContaPropria();
  const id = idSchema.safeParse(form.get("pedidoId"));
  if (!id.success) return { erro: "Autorização inválida. Atualize a página." };
  try {
    if (!(await revogarAutorizacao(contexto.titularId, id.data))) return { erro: "Esta autorização não está mais disponível. Atualize a página." };
  } catch (erro) {
    unstable_rethrow(erro);
    return { erro: FALHA };
  }
  atualizar();
  return { ok: true };
}

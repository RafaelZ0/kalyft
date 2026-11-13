import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exigirUsuario, obterVinculoSessao } from "@/lib/auth/sessao";
import { criarContexto, encerrarContexto, obterContextoAcompanhamento } from "@/lib/dal/acompanhamento";
import { executarNoContexto, obterExecucaoAcompanhada, type ContextoDados } from "@/lib/acompanhamento/execucao";

export type { ContextoDados } from "@/lib/acompanhamento/execucao";
export const COOKIE_ACOMPANHAMENTO = "kalyft_acompanhamento";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ErroAcompanhamento extends Error {
  constructor(public readonly codigo: "contexto" | "leitura" | "pessoal", mensagem: string) {
    super(mensagem);
    this.name = "ErroAcompanhamento";
  }
}

function contextoMudou(): never {
  redirect("/acompanhamento-expirado");
}

/** Identidade real permanece em exigirUsuario; somente os dados usam o titular. */
export async function exigirContextoDados(): Promise<ContextoDados> {
  const execucao = obterExecucaoAcompanhada();
  if (execucao) return execucao.contexto;
  const usuario = await exigirUsuario();
  const cookie = (await cookies()).get(COOKIE_ACOMPANHAMENTO);
  if (!cookie) return {
    ...usuario, atorId: usuario.userId, titularId: usuario.userId, contextoId: "proprio",
    modo: "proprio", podeEditar: true, podeVerFotos: true, edicaoAte: null, nome: "",
  };
  if (!usuario.admin || !UUID.test(cookie.value)) contextoMudou();
  const contexto = await obterContextoAcompanhamento(cookie.value, usuario.userId, await obterVinculoSessao());
  if (!contexto) contextoMudou();
  return {
    userId: contexto.alunoId, atorId: usuario.userId, titularId: contexto.alunoId,
    contextoId: contexto.id, modo: "acompanhamento", podeEditar: contexto.podeEditar,
    podeVerFotos: contexto.podeVerFotos, edicaoAte: contexto.edicaoAte, nome: contexto.nome ?? contexto.email,
    admin: null,
  };
}

/** IA, segurança e integrações pessoais nunca herdam o contexto do aluno. */
export async function exigirContaPropria(): Promise<ContextoDados> {
  const contexto = await exigirContextoDados();
  if (contexto.modo !== "proprio") redirect("/hoje?acompanhamento=pessoal");
  return contexto;
}

export async function executarAcaoAcompanhada<T>(marcador: unknown, operacao: string, executar: () => T | Promise<T>): Promise<T> {
  const contexto = await exigirContextoDados();
  if (typeof marcador !== "string" || marcador !== contexto.contextoId) redirect("/hoje?acompanhamento=contexto");
  if (!contexto.podeEditar) redirect("/hoje?acompanhamento=leitura");
  const sessaoHash = contexto.modo === "acompanhamento" ? await obterVinculoSessao() : "";
  return executarNoContexto(contexto, sessaoHash, operacao, executar);
}

export async function criarContextoAcompanhamento(alunoId: string): Promise<string> {
  const { admin } = await exigirUsuario();
  if (!admin) contextoMudou();
  const contexto = await criarContexto(admin, alunoId, await obterVinculoSessao());
  (await cookies()).set(COOKIE_ACOMPANHAMENTO, contexto.id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 60 * 60,
  });
  return contexto.id;
}

/** Retorno e logout também recuperam cookies inválidos/encerrados. */
export async function encerrarContextoAcompanhamento(): Promise<void> {
  const cookieStore = await cookies();
  const contextoId = cookieStore.get(COOKIE_ACOMPANHAMENTO)?.value;
  cookieStore.delete(COOKIE_ACOMPANHAMENTO);
  if (!contextoId || !UUID.test(contextoId)) return;
  const { admin } = await exigirUsuario();
  if (admin) await encerrarContexto(admin, contextoId, await obterVinculoSessao());
}

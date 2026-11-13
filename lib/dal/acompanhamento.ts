import "server-only";

import { and, asc, desc, eq, ilike, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { acessos, acompanhamentoAutorizacoes as autorizacoes, acompanhamentoContextos as contextos, acompanhamentoEventos as eventos, perfis } from "@/lib/db/schema";
import type { EstadoAutorizacao, TipoAutorizacao } from "@/lib/acompanhamento/regras";
import { chaveDoLimite, chaveHmacLimites } from "@/lib/regras-limites";
import type { Administrador } from "./acessos";
import { ehUuid, exigirId } from "./util";

export type AlunoResumo = { userId: string; nome: string | null; email: string };
export type AutorizacaoResumo = {
  id: string; administradorId: string; administradorNome: string | null;
  tipo: TipoAutorizacao; estado: EstadoAutorizacao;
  solicitadoEm: Date; decididoEm: Date | null; expiraEm: Date | null; revogadoEm: Date | null;
};
export type EventoResumo = {
  id: string; atorId: string; atorNome: string | null; operacao: string;
  recurso: string; recursoId: string | null; criadoEm: Date;
};
export type ContextoAcompanhamento = {
  id: string; administradorId: string; alunoId: string; nome: string | null; email: string;
  expiraEm: Date; podeEditar: boolean; podeVerFotos: boolean; edicaoAte: Date | null;
};

function emailsAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

async function conferirAdministrador(administradorId: string): Promise<boolean> {
  exigirId(administradorId);
  const [acesso] = await db.select({ email: acessos.email }).from(acessos)
    .where(and(eq(acessos.userId, administradorId), eq(acessos.status, "aprovado"))).limit(1);
  return !!acesso && emailsAdmin().includes(acesso.email.toLowerCase());
}

async function exigirAdministrador(admin: Administrador): Promise<void> {
  if (!admin.__admin || !(await conferirAdministrador(admin.userId))) throw new Error("Acesso administrativo necessário.");
}

function filtroAluno(adminId: string) {
  const admins = emailsAdmin();
  return and(eq(acessos.status, "aprovado"), ne(acessos.userId, adminId),
    admins.length ? notInArray(sql`lower(${acessos.email})`, admins) : undefined);
}

async function alunoElegivel(admin: Administrador, alunoId: string): Promise<boolean> {
  exigirId(alunoId);
  const [linha] = await db.select({ id: acessos.userId }).from(acessos)
    .innerJoin(perfis, eq(perfis.userId, acessos.userId))
    .where(and(eq(acessos.userId, alunoId), filtroAluno(admin.userId))).limit(1);
  return !!linha;
}

export async function listarAlunos(admin: Administrador, busca = "", pagina = 1): Promise<AlunoResumo[]> {
  await exigirAdministrador(admin);
  const termo = busca.trim().slice(0, 200).replace(/[\\%_]/g, "\\$&");
  return db.select({ userId: acessos.userId, nome: perfis.nome, email: acessos.email }).from(acessos)
    .innerJoin(perfis, eq(perfis.userId, acessos.userId))
    .where(and(filtroAluno(admin.userId), termo ? or(ilike(perfis.nome, `%${termo}%`), ilike(acessos.email, `%${termo}%`)) : undefined))
    .orderBy(asc(perfis.nome), asc(acessos.userId)).limit(20).offset((paginaValida(pagina) - 1) * 20);
}

function paginaValida(pagina: number): number {
  return Number.isSafeInteger(pagina) ? Math.min(100_000, Math.max(1, pagina)) : 1;
}

function conferirHash(hash: string): void {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Sessão inválida para acompanhamento.");
}

export async function criarContexto(admin: Administrador, alunoId: string, sessaoHash: string) {
  await exigirAdministrador(admin);
  conferirHash(sessaoHash);
  if (!(await alunoElegivel(admin, alunoId))) throw new Error("Aluno indisponível para acompanhamento.");
  const [linha] = await db.insert(contextos).values({ administradorId: admin.userId, alunoId, sessaoHash }).returning();
  return linha;
}

export async function obterContextoAcompanhamento(contextoId: string, administradorId: string, sessaoHash: string): Promise<ContextoAcompanhamento | null> {
  if (!ehUuid(contextoId) || !ehUuid(administradorId) || !/^[a-f0-9]{64}$/.test(sessaoHash)) return null;
  if (!(await conferirAdministrador(administradorId))) return null;
  const [linha] = await db.select({ id: contextos.id, administradorId: contextos.administradorId, alunoId: contextos.alunoId,
    nome: perfis.nome, email: acessos.email, expiraEm: contextos.expiraEm,
    podeEditar: sql<boolean>`exists (select 1 from acompanhamento_autorizacoes a where a.administrador_id = ${administradorId}::uuid and a.aluno_id = ${contextos.alunoId} and a.tipo = 'edicao' and a.estado = 'aceita' and a.expira_em > clock_timestamp())`,
    podeVerFotos: sql<boolean>`exists (select 1 from acompanhamento_autorizacoes a where a.administrador_id = ${administradorId}::uuid and a.aluno_id = ${contextos.alunoId} and a.tipo = 'fotos' and a.estado = 'aceita' and (a.expira_em is null or a.expira_em > clock_timestamp()))`,
    edicaoAte: sql<string | null>`(select max(a.expira_em) from acompanhamento_autorizacoes a where a.administrador_id = ${administradorId}::uuid and a.aluno_id = ${contextos.alunoId} and a.tipo = 'edicao' and a.estado = 'aceita' and a.expira_em > clock_timestamp())`,
  }).from(contextos).innerJoin(perfis, eq(perfis.userId, contextos.alunoId)).innerJoin(acessos, eq(acessos.userId, contextos.alunoId))
    .where(and(eq(contextos.id, contextoId), eq(contextos.administradorId, administradorId), eq(contextos.sessaoHash, sessaoHash),
      sql`${contextos.encerradoEm} is null`, sql`${contextos.expiraEm} > clock_timestamp()`, filtroAluno(administradorId))).limit(1);
  return linha ? { ...linha, edicaoAte: linha.edicaoAte ? new Date(linha.edicaoAte) : null } : null;
}

export async function encerrarContexto(admin: Administrador, contextoId: string, sessaoHash: string): Promise<void> {
  exigirId(admin.userId);
  if (!ehUuid(contextoId)) return;
  conferirHash(sessaoHash);
  await db.update(contextos).set({ encerradoEm: sql`clock_timestamp()` }).where(and(eq(contextos.id, contextoId), eq(contextos.administradorId, admin.userId), eq(contextos.sessaoHash, sessaoHash)));
}

export async function solicitarAutorizacao(admin: Administrador, alunoId: string, tipo: TipoAutorizacao): Promise<string> {
  await exigirAdministrador(admin);
  if (tipo !== "edicao" && tipo !== "fotos") throw new Error("Tipo de autorização inválido.");
  if (!(await alunoElegivel(admin, alunoId))) throw new Error("Aluno indisponível para acompanhamento.");
  const chave = chaveDoLimite("acompanhamento", `${admin.userId}:${alunoId}:${tipo}`, chaveHmacLimites(process.env.LIMITES_HMAC_KEY));
  const resultado = await db.execute(sql`select acompanhamento_solicitar(${admin.userId}::uuid, ${alunoId}::uuid, ${tipo}, ${chave}) as id`);
  return resultado.rows[0].id as string;
}

/** alunoId é sempre o titular da sessão real; o contexto acompanhado não pode decidir. */
export async function decidirAutorizacao(alunoId: string, pedidoId: string, decisao: "aceitar" | "recusar", expiraEm: Date | null): Promise<boolean> {
  exigirId(alunoId);
  if (!ehUuid(pedidoId)) return false;
  if (decisao !== "aceitar" && decisao !== "recusar") throw new Error("Decisão inválida.");
  if (expiraEm && !Number.isFinite(expiraEm.getTime())) throw new Error("Prazo inválido.");
  const resultado = await db.execute(sql`select acompanhamento_decidir(${alunoId}::uuid, ${pedidoId}::uuid, ${decisao}, ${expiraEm?.toISOString() ?? null}::timestamptz) as ok`);
  return resultado.rows[0].ok === true;
}

export async function revogarAutorizacao(alunoId: string, pedidoId: string): Promise<boolean> {
  exigirId(alunoId);
  if (!ehUuid(pedidoId)) return false;
  const resultado = await db.execute(sql`select acompanhamento_revogar(${alunoId}::uuid, ${pedidoId}::uuid) as ok`);
  return resultado.rows[0].ok === true;
}

export async function listarAutorizacoes(alunoId: string): Promise<AutorizacaoResumo[]> {
  exigirId(alunoId);
  return db.select({ id: autorizacoes.id, administradorId: autorizacoes.administradorId, administradorNome: perfis.nome,
    tipo: autorizacoes.tipo, estado: autorizacoes.estado, solicitadoEm: autorizacoes.solicitadoEm, decididoEm: autorizacoes.decididoEm,
    expiraEm: autorizacoes.expiraEm, revogadoEm: autorizacoes.revogadoEm }).from(autorizacoes)
    .innerJoin(perfis, eq(perfis.userId, autorizacoes.administradorId)).where(eq(autorizacoes.alunoId, alunoId))
    .orderBy(desc(autorizacoes.solicitadoEm)).limit(100);
}

export async function listarHistorico(alunoId: string, pagina = 1): Promise<EventoResumo[]> {
  exigirId(alunoId);
  return db.select({ id: eventos.id, atorId: eventos.atorId, atorNome: perfis.nome, operacao: eventos.operacao,
    recurso: eventos.recurso, recursoId: eventos.recursoId, criadoEm: eventos.criadoEm }).from(eventos)
    .innerJoin(perfis, eq(perfis.userId, eventos.atorId)).where(eq(eventos.alunoId, alunoId))
    .orderBy(desc(eventos.criadoEm), desc(eventos.id)).limit(20).offset((paginaValida(pagina) - 1) * 20);
}

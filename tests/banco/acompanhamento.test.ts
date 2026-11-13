import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { acessos, acompanhamentoAutorizacoes, acompanhamentoEventos, agua, perfis } from "@/lib/db/schema";
import { criarContexto, decidirAutorizacao, listarAlunos, listarAutorizacoes, obterContextoAcompanhamento, revogarAutorizacao, solicitarAutorizacao } from "@/lib/dal/acompanhamento";

const admin = { userId: randomUUID(), __admin: true } as const;
const outroAdmin = { userId: randomUUID(), __admin: true } as const;
const aluno = randomUUID();
const terceiro = randomUUID();
const ids = [admin.userId, outroAdmin.userId, aluno, terceiro];
const hash = "a".repeat(64);
let pedido: string;
let contexto: Awaited<ReturnType<typeof criarContexto>>;
const emailsAntes = process.env.ADMIN_EMAILS;

beforeAll(async () => {
  process.env.ADMIN_EMAILS = "admin@acompanhamento.invalid,outro@acompanhamento.invalid";
  await db.insert(perfis).values(ids.map((userId) => ({ userId })));
  await db.insert(acessos).values(ids.map((userId, i) => ({ userId, email: ["admin@acompanhamento.invalid", "outro@acompanhamento.invalid", "aluno@acompanhamento.invalid", "terceiro@acompanhamento.invalid"][i], status: "aprovado" })));
});
afterAll(async () => {
  process.env.ADMIN_EMAILS = emailsAntes;
  await db.delete(perfis).where(inArray(perfis.userId, ids));
  await db.delete(acessos).where(inArray(acessos.userId, ids));
});

describe("acompanhamento persistido", () => {
  it("lista somente alunos elegíveis e vincula contexto à sessão", async () => {
    const lista = await listarAlunos(admin, "@acompanhamento.invalid", 1);
    expect(lista.map((a) => a.userId).sort()).toEqual([aluno, terceiro].sort());
    contexto = await criarContexto(admin, aluno, hash);
    expect(await obterContextoAcompanhamento(contexto.id, admin.userId, "b".repeat(64))).toBeNull();
    expect((await obterContextoAcompanhamento(contexto.id, admin.userId, hash))?.podeEditar).toBe(false);
  });
  it("deduplica pendências concorrentes e não deixa terceiro decidir", async () => {
    const pedidos = await Promise.all([solicitarAutorizacao(admin, aluno, "edicao"), solicitarAutorizacao(admin, aluno, "edicao")]);
    expect(pedidos[0]).toBe(pedidos[1]);
    pedido = pedidos[0];
    expect(await decidirAutorizacao(terceiro, pedido, "aceitar", new Date(Date.now() + 60_000))).toBe(false);
    expect((await listarAutorizacoes(aluno))[0].estado).toBe("pendente");
  });
  it("exige prazo e concede só ao administrador do pedido", async () => {
    await expect(decidirAutorizacao(aluno, pedido, "aceitar", null)).rejects.toThrow();
    expect(await decidirAutorizacao(aluno, pedido, "aceitar", new Date(Date.now() + 60_000))).toBe(true);
    expect((await obterContextoAcompanhamento(contexto.id, admin.userId, hash))?.podeEditar).toBe(true);
    const outro = await criarContexto(outroAdmin, aluno, hash);
    expect((await obterContextoAcompanhamento(outro.id, outroAdmin.userId, hash))?.podeEditar).toBe(false);
  });
  it("audita mutação na mesma transação e revogação bloqueia próxima escrita", async () => {
    await db.batch([
      db.execute(sql`select acompanhamento_validar(${contexto.id}::uuid, ${admin.userId}::uuid, ${aluno}::uuid, ${hash}, 'edicao')`),
      db.insert(agua).values({ userId: aluno, data: "2026-11-13", ml: 200 }),
    ]);
    const eventos = await db.select().from(acompanhamentoEventos).where(eq(acompanhamentoEventos.alunoId, aluno));
    expect(eventos.some((e) => e.recurso === "agua" && e.operacao === "INSERT" && e.atorId === admin.userId)).toBe(true);
    expect(await revogarAutorizacao(terceiro, pedido)).toBe(false);
    expect(await revogarAutorizacao(aluno, pedido)).toBe(true);
    await expect(db.batch([
      db.execute(sql`select acompanhamento_validar(${contexto.id}::uuid, ${admin.userId}::uuid, ${aluno}::uuid, ${hash}, 'edicao')`),
      db.insert(agua).values({ userId: aluno, data: "2026-11-13", ml: 200 }),
    ])).rejects.toThrow();
    expect((await db.select().from(agua).where(eq(agua.userId, aluno))).reduce((s, a) => s + a.ml, 0)).toBe(200);
  });
  it("CHECK recusa aceite de edição sem prazo", async () => {
    await expect(db.insert(acompanhamentoAutorizacoes).values({ administradorId: admin.userId, alunoId: terceiro, tipo: "edicao", estado: "aceita" })).rejects.toThrow();
  });
});

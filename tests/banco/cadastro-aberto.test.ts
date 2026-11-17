// Fase 12A: cadastro aberto. Conta nova entra direto; "recusado" continua bloqueado; o administrador vê
// toda conta nova, mas só edita com autorização do titular.
import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { acessos, agua, perfis } from "@/lib/db/schema";
import { decidirAcesso, registrarAcesso } from "@/lib/dal/acessos";
import { criarContexto, listarAlunos, obterContextoAcompanhamento } from "@/lib/dal/acompanhamento";

const admin = { userId: randomUUID(), __admin: true } as const;
const nova = randomUUID();
const antiga = randomUUID();
const bloqueada = randomUUID();
const ids = [admin.userId, nova, antiga, bloqueada];
const hash = "c".repeat(64);
const emailsAntes = process.env.ADMIN_EMAILS;

beforeAll(async () => {
  process.env.ADMIN_EMAILS = "admin@cadastro-aberto.invalid";
  await db.insert(perfis).values(ids.map((userId) => ({ userId })));
  await registrarAcesso(admin.userId, "admin@cadastro-aberto.invalid", true);
});
afterAll(async () => {
  process.env.ADMIN_EMAILS = emailsAntes;
  await db.delete(perfis).where(inArray(perfis.userId, ids));
  await db.delete(acessos).where(inArray(acessos.userId, ids));
});

describe("cadastro aberto", () => {
  it("conta nova entra aprovada, sem pedido de aprovação", async () => {
    expect((await registrarAcesso(nova, "Nova@Cadastro-Aberto.invalid", false)).status).toBe("aprovado");
  });

  it("conta pendente antiga passa a aprovada no próximo acesso", async () => {
    await db.insert(acessos).values({ userId: antiga, email: "antiga@cadastro-aberto.invalid", status: "pendente" });
    expect((await registrarAcesso(antiga, "antiga@cadastro-aberto.invalid", false)).status).toBe("aprovado");
  });

  it("conta recusada continua bloqueada", async () => {
    await registrarAcesso(bloqueada, "bloqueada@cadastro-aberto.invalid", false);
    expect(await decidirAcesso(admin, bloqueada, "recusado")).toBe(true);
    expect((await registrarAcesso(bloqueada, "bloqueada@cadastro-aberto.invalid", false)).status).toBe("recusado");
  });

  it("o administrador vê a conta nova, mas não edita sem autorização", async () => {
    const lista = await listarAlunos(admin, "@cadastro-aberto.invalid", 1);
    expect(lista.map((a) => a.userId).sort()).toEqual([nova, antiga].sort());
    const ctx = await criarContexto(admin, nova, hash);
    expect((await obterContextoAcompanhamento(ctx.id, admin.userId, hash))?.podeEditar).toBe(false);
    await expect(db.batch([
      db.execute(sql`select acompanhamento_validar(${ctx.id}::uuid, ${admin.userId}::uuid, ${nova}::uuid, ${hash}, 'edicao')`),
      db.insert(agua).values({ userId: nova, data: "2026-11-16", ml: 200 }),
    ])).rejects.toThrow();
    expect(await db.select().from(agua).where(inArray(agua.userId, [nova]))).toHaveLength(0);
  });
});

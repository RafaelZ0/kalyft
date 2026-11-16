// Fase 11A (2A): rascunho da jornada inicial no banco de teste. Isolamento, revisão otimista e limites.
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { jornadasIniciais, perfis, pesagens } from "@/lib/db/schema";
import { garantirPerfil, obterPerfil } from "@/lib/dal/perfil";
import { iniciarJornada, obterJornada, salvarEtapaJornada } from "@/lib/dal/jornada";

const A = randomUUID();
const B = randomUUID();
const C = randomUUID(); // usada só no teste de cascata

const salvar = (userId: string, revisaoEsperada: number, etapa: string, respostas: Record<string, unknown>) =>
  salvarEtapaJornada(userId, { versao: 1, revisaoEsperada, etapa, respostas });

beforeAll(async () => {
  for (const u of [A, B, C]) await garantirPerfil(u);
});
afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B, C]));
});

describe("criar e ler", () => {
  it("sem jornada: obter devolve null e salvar devolve 'inexistente'", async () => {
    expect(await obterJornada(A)).toBeNull();
    expect(await salvar(A, 0, "foco", { area: "comida" })).toEqual({ status: "inexistente" });
  });

  it("iniciar é idempotente: repetir não zera nem duplica", async () => {
    const j1 = await iniciarJornada(A);
    expect(j1).toMatchObject({ versao: 1, revisao: 0, estado: "em_andamento", etapa: "foco", rascunho: {} });
    expect(await salvar(A, 0, "foco", { area: "comida" })).toEqual({ status: "salvo", revisao: 1, etapa: "perfil" });
    const j2 = await iniciarJornada(A);
    expect(j2).toMatchObject({ revisao: 1, etapa: "perfil", rascunho: { foco: { area: "comida" } } });
    expect(await db.select().from(jornadasIniciais).where(eq(jornadasIniciais.userId, A))).toHaveLength(1);
  });

  it("rejeita user_id inválido antes de consultar", async () => {
    await expect(obterJornada("nao-e-uuid")).rejects.toThrow();
    await expect(iniciarJornada("")).rejects.toThrow();
  });
});

describe("salvar etapa", () => {
  it("salva, converte números e avança para a próxima etapa do caminho", async () => {
    const r = await salvar(A, 1, "perfil", { alturaCm: "172", pesoKg: "78,5", nome: "" });
    expect(r).toEqual({ status: "salvo", revisao: 2, etapa: "objetivo" });
    const j = await obterJornada(A);
    expect(j?.rascunho.perfil).toEqual({ alturaCm: 172, pesoKg: 78.5 });
  });

  it("não aplica nada no perfil nem nas pesagens (rascunho não é dado aplicado)", async () => {
    const perfil = await obterPerfil(A);
    expect(perfil?.alturaCm ?? null).toBeNull();
    expect(await db.select().from(pesagens).where(eq(pesagens.userId, A))).toHaveLength(0);
  });

  it("entrada inválida: erros por campo, nada muda", async () => {
    const r = await salvar(A, 2, "objetivo", { objetivo: "forca", pesoReferenciaKg: "80" });
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") expect(r.erros).toHaveProperty("pesoReferenciaKg");
    expect((await obterJornada(A))?.revisao).toBe(2);
    const extra = await salvarEtapaJornada(A, { versao: 1, revisaoEsperada: 2, etapa: "foco", respostas: {}, userId: B });
    expect(extra.status).toBe("invalido");
    const versao = await salvarEtapaJornada(A, { versao: 2, revisaoEsperada: 2, etapa: "foco", respostas: { area: "comida" } });
    expect(versao.status).toBe("invalido");
  });

  it("etapa fora do caminho é recusada", async () => {
    const r = await salvar(A, 2, "treino", { minutosSessao: "30" });
    expect(r).toEqual({ status: "etapa_indisponivel" });
  });

  it("trocar a área remove as respostas da área que saiu", async () => {
    expect((await salvar(A, 2, "foco", { area: "ambos", primeira: "treino" })).status).toBe("salvo");
    expect((await salvar(A, 3, "treino", { minutosSessao: "30" })).status).toBe("salvo");
    expect((await salvar(A, 4, "alimentacao", { refeicoesPorDia: "4" })).status).toBe("salvo");
    expect((await salvar(A, 5, "foco", { area: "comida" })).status).toBe("salvo");
    const j = await obterJornada(A);
    expect(j?.rascunho.treino).toBeUndefined();
    expect(j?.rascunho.alimentacao).toEqual({ refeicoesPorDia: 4 });
    expect(j?.revisao).toBe(6);
  });
});

describe("duas abas", () => {
  it("com a mesma revisão, só uma avança; a outra recebe conflito com a revisão atual", async () => {
    const atual = (await obterJornada(A))!.revisao;
    const [r1, r2] = await Promise.all([
      salvar(A, atual, "rotina", { trabalho: "sentado" }),
      salvar(A, atual, "rotina", { trabalho: "fisico" }),
    ]);
    const status = [r1.status, r2.status].sort();
    expect(status).toEqual(["conflito", "salvo"]);
    const conflito = [r1, r2].find((r) => r.status === "conflito");
    expect(conflito).toEqual({ status: "conflito", revisao: atual + 1 });
    expect((await obterJornada(A))?.revisao).toBe(atual + 1);
  });

  it("revisão antiga não sobrescreve a mais nova", async () => {
    const atual = (await obterJornada(A))!.revisao;
    expect(await salvar(A, atual - 1, "rotina", { trabalho: "alternado" })).toEqual({ status: "conflito", revisao: atual });
  });
});

describe("isolamento entre contas", () => {
  it("B não lê nem altera a jornada de A", async () => {
    expect(await obterJornada(B)).toBeNull();
    expect(await salvar(B, 0, "foco", { area: "treino" })).toEqual({ status: "inexistente" });
    await iniciarJornada(B);
    expect((await salvar(B, 0, "foco", { area: "treino" })).status).toBe("salvo");
    const a = await obterJornada(A);
    expect(a?.rascunho.foco).toEqual({ area: "comida" });
    expect((await obterJornada(B))?.rascunho.foco).toEqual({ area: "treino" });
  });
});

describe("estado e limites", () => {
  it("jornada concluída não aceita mais salvamentos", async () => {
    await db.update(jornadasIniciais).set({ estado: "concluida", concluidoEm: new Date() }).where(eq(jornadasIniciais.userId, B));
    const rev = (await obterJornada(B))!.revisao;
    expect(await salvar(B, rev, "perfil", { alturaCm: "180" })).toEqual({ status: "encerrada" });
  });

  it("jornada adiada volta a 'em andamento' ao salvar", async () => {
    await db.update(jornadasIniciais).set({ estado: "adiada" }).where(eq(jornadasIniciais.userId, A));
    const rev = (await obterJornada(A))!.revisao;
    expect((await salvar(A, rev, "atividade", {})).status).toBe("salvo");
    expect((await obterJornada(A))?.estado).toBe("em_andamento");
  });

  it("CHECKs do banco (inclusive NULL e tamanho)", async () => {
    const upd = (set: Record<string, unknown>) => db.update(jornadasIniciais).set(set).where(eq(jornadasIniciais.userId, A));
    await expect(upd({ estado: "pausada" })).rejects.toThrow();
    await expect(upd({ etapa: "cartao" })).rejects.toThrow();
    await expect(upd({ revisao: -1 })).rejects.toThrow();
    await expect(upd({ estado: "concluida" })).rejects.toThrow(); // concluída sem data
    await expect(upd({ concluidoEm: new Date() })).rejects.toThrow(); // data sem estar concluída
    await expect(upd({ rascunho: [] })).rejects.toThrow();
    await expect(upd({ rascunho: { x: "a".repeat(17_000) } })).rejects.toThrow();
    await expect(upd({ tutorial: {} })).rejects.toThrow();
    await expect(upd({ tutorial: { estado: "assistido" } })).rejects.toThrow();
  });

  it("apagar o perfil apaga a jornada (cascata)", async () => {
    await iniciarJornada(C);
    await db.delete(perfis).where(eq(perfis.userId, C));
    const [r] = (await db.execute<{ n: number }>(sql`select count(*)::int as n from jornadas_iniciais where user_id = ${C}`)).rows;
    expect(r.n).toBe(0);
  });
});

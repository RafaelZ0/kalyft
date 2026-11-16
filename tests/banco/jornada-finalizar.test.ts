// Fase 11B (2B): revisão e finalização atômica da jornada inicial no banco de teste.
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { jornadasIniciais, perfis, pesagens } from "@/lib/db/schema";
import { garantirPerfil, obterPerfil } from "@/lib/dal/perfil";
import { adiarJornada, carregarRevisao, finalizarJornada, iniciarJornada, obterJornada, retomarJornada, salvarEtapaJornada } from "@/lib/dal/jornada";

const usuarios: string[] = [];
const DATA = "2026-11-10";

async function novaPessoa(perfil: Partial<typeof perfis.$inferInsert> = {}) {
  const u = randomUUID();
  usuarios.push(u);
  await garantirPerfil(u);
  if (Object.keys(perfil).length) await db.update(perfis).set(perfil).where(eq(perfis.userId, u));
  return u;
}

/** Percorre a jornada até a revisão. */
async function ateRevisao(u: string, perfil: Record<string, string>, extra: { nivel?: string } = {}) {
  await iniciarJornada(u);
  let rev = 0;
  const salvar = async (etapa: string, respostas: Record<string, unknown>) => {
    const r = await salvarEtapaJornada(u, { versao: 1, revisaoEsperada: rev, etapa, respostas });
    if (r.status !== "salvo") throw new Error(`${etapa}: ${JSON.stringify(r)}`);
    rev = r.revisao;
  };
  await salvar("foco", { area: "comida" });
  await salvar("perfil", perfil);
  await salvar("objetivo", { objetivo: "manter" });
  await salvar("rotina", {});
  await salvar("atividade", extra.nivel ? { nivelDeclarado: extra.nivel } : {});
  await salvar("alimentacao", { refeicoesPorDia: "4" });
  return rev;
}

const finalizar = (u: string, rev: number, o: Partial<{ aplicar: string[]; vistos: Record<string, unknown>; pesagem: string; pesoVisto: number | null }> = {}) =>
  finalizarJornada(u, { versao: 1, revisaoEsperada: rev, aplicar: [], vistos: {}, pesagem: "nenhuma", pesoVisto: null, ...o });

beforeAll(() => undefined);
afterAll(async () => {
  if (usuarios.length) await db.delete(perfis).where(inArray(perfis.userId, usuarios));
});

describe("revisão", () => {
  it("propõe só o informado, com o valor atual ao lado", async () => {
    const u = await novaPessoa({ nome: "Ana", alturaCm: 165 });
    await ateRevisao(u, { alturaCm: "170", pesoKg: "80", dataPesagem: DATA }, { nivel: "leve" });
    const r = await carregarRevisao(u);
    expect(r?.plano.perfil).toEqual([
      { campo: "alturaCm", atual: 165, novo: 170, padrao: false },
      { campo: "nivelAtividade", atual: null, novo: "leve", padrao: true },
    ]);
    expect(r?.plano.pesagem).toEqual({ tipo: "nova", data: DATA, pesoKg: 80 });
  });
});

describe("finalizar", () => {
  it("aplica só os campos escolhidos e registra a pesagem; nunca apaga dados existentes", async () => {
    const u = await novaPessoa({ nome: "Ana", alturaCm: 165, sexo: "feminino" });
    const rev = await ateRevisao(u, { alturaCm: "170", pesoKg: "80", dataPesagem: DATA }, { nivel: "leve" });
    const r = await finalizar(u, rev, { aplicar: ["nivelAtividade"], vistos: { nivelAtividade: null }, pesagem: "registrar" });
    expect(r).toEqual({ status: "concluida", camposAplicados: 1, pesagem: "registrada" });
    const p = await obterPerfil(u);
    expect(p).toMatchObject({ nome: "Ana", alturaCm: 165, sexo: "feminino", nivelAtividade: "leve" });
    const [pes] = await db.select().from(pesagens).where(eq(pesagens.userId, u));
    expect(pes).toMatchObject({ data: DATA, pesoKg: 80 });
    const j = await obterJornada(u);
    expect(j).toMatchObject({ estado: "concluida", etapa: "inicio" });
    expect(j?.concluidoEm).toBeInstanceOf(Date);
    const [linha] = await db.select().from(jornadasIniciais).where(eq(jornadasIniciais.userId, u));
    expect(linha.preferencias).toMatchObject({ foco: { area: "comida" }, objetivo: { objetivo: "manter" }, alimentacao: { refeicoesPorDia: 4 } });
    expect(await finalizar(u, rev + 1)).toEqual({ status: "encerrada" });
  });

  it("pesagem existente: substituir troca só o peso e preserva massa magra e cintura", async () => {
    const u = await novaPessoa();
    await db.insert(pesagens).values({ userId: u, data: DATA, pesoKg: 82, massaMagraKg: 60, cinturaCm: 90 });
    const rev = await ateRevisao(u, { pesoKg: "80", dataPesagem: DATA });
    expect((await carregarRevisao(u))?.plano.pesagem).toMatchObject({ tipo: "existente", pesoAtualKg: 82, podeSubstituir: true });
    expect(await finalizar(u, rev, { pesagem: "registrar" })).toEqual({ status: "desatualizado" });
    expect((await finalizar(u, rev, { pesagem: "substituir", pesoVisto: 82 })).status).toBe("concluida");
    const [pes] = await db.select().from(pesagens).where(eq(pesagens.userId, u));
    expect(pes).toMatchObject({ pesoKg: 80, massaMagraKg: 60, cinturaCm: 90 });
  });

  it("pesagem existente: manter não altera a medição", async () => {
    const u = await novaPessoa();
    await db.insert(pesagens).values({ userId: u, data: DATA, pesoKg: 82 });
    const rev = await ateRevisao(u, { pesoKg: "80", dataPesagem: DATA });
    expect((await finalizar(u, rev, { pesagem: "manter", pesoVisto: 82 })).status).toBe("concluida");
    const [pes] = await db.select().from(pesagens).where(eq(pesagens.userId, u));
    expect(pes.pesoKg).toBe(82);
  });

  it("pesagem nova desmarcada: conclui sem registrar", async () => {
    const u = await novaPessoa();
    const rev = await ateRevisao(u, { pesoKg: "80", dataPesagem: DATA });
    expect(await finalizar(u, rev, { pesagem: "nenhuma" })).toEqual({ status: "concluida", camposAplicados: 0, pesagem: "nenhuma" });
    expect(await db.select().from(pesagens).where(eq(pesagens.userId, u))).toHaveLength(0);
  });

  it("peso sem data não cria medição", async () => {
    const u = await novaPessoa();
    const rev = await ateRevisao(u, { pesoKg: "80" });
    expect((await carregarRevisao(u))?.plano.pesagem).toEqual({ tipo: "sem_data", pesoKg: 80 });
    expect(await finalizar(u, rev, { pesagem: "registrar" })).toEqual({ status: "desatualizado" });
    expect((await finalizar(u, rev)).status).toBe("concluida");
    expect(await db.select().from(pesagens).where(eq(pesagens.userId, u))).toHaveLength(0);
  });

  it("perfil mudou em outra aba depois da revisão: nada é aplicado", async () => {
    const u = await novaPessoa({ alturaCm: 165 });
    const rev = await ateRevisao(u, { alturaCm: "170", pesoKg: "80", dataPesagem: DATA });
    await db.update(perfis).set({ alturaCm: 168 }).where(eq(perfis.userId, u));
    const r = await finalizar(u, rev, { aplicar: ["alturaCm"], vistos: { alturaCm: 165 }, pesagem: "registrar" });
    expect(r).toEqual({ status: "desatualizado" });
    expect((await obterPerfil(u))?.alturaCm).toBe(168);
    expect(await db.select().from(pesagens).where(eq(pesagens.userId, u))).toHaveLength(0);
    expect((await obterJornada(u))?.estado).toBe("em_andamento");
  });

  it("pesagem criada em outra aba entre a revisão e a confirmação: nada é aplicado (tudo ou nada)", async () => {
    const u = await novaPessoa({ alturaCm: 165 });
    const rev = await ateRevisao(u, { alturaCm: "170", pesoKg: "80", dataPesagem: DATA });
    // A tela viu "nova pesagem"; outra aba registra antes da confirmação chegar ao banco.
    await db.insert(pesagens).values({ userId: u, data: DATA, pesoKg: 79 });
    const r = await finalizar(u, rev, { aplicar: ["alturaCm"], vistos: { alturaCm: 165 }, pesagem: "registrar" });
    expect(r).toEqual({ status: "desatualizado" });
    expect((await obterPerfil(u))?.alturaCm).toBe(165);
    const [pes] = await db.select().from(pesagens).where(and(eq(pesagens.userId, u), eq(pesagens.data, DATA)));
    expect(pes.pesoKg).toBe(79);
  });

  it("revisão antiga recebe conflito; campo fora do plano é recusado; entrada inválida também", async () => {
    const u = await novaPessoa();
    const rev = await ateRevisao(u, { alturaCm: "170" });
    expect(await finalizar(u, rev - 1)).toEqual({ status: "conflito", revisao: rev });
    expect(await finalizar(u, rev, { aplicar: ["nome"], vistos: { nome: null } })).toEqual({ status: "desatualizado" });
    expect((await finalizar(u, rev, { aplicar: ["email"] })).status).toBe("invalido");
    expect((await finalizarJornada(u, { versao: 1, revisaoEsperada: rev, aplicar: [], vistos: {}, pesagem: "nenhuma", pesoVisto: null, userId: u })).status).toBe("invalido");
  });

  it("sem objetivo a revisão não está disponível", async () => {
    const u = await novaPessoa();
    await iniciarJornada(u);
    const s = await salvarEtapaJornada(u, { versao: 1, revisaoEsperada: 0, etapa: "foco", respostas: { area: "treino" } });
    expect(s.status).toBe("salvo");
    expect(await finalizar(u, 1)).toEqual({ status: "incompleta" });
  });

  it("isolamento: B não finaliza a jornada de A", async () => {
    const a = await novaPessoa();
    const b = await novaPessoa();
    const rev = await ateRevisao(a, { alturaCm: "170" });
    expect(await finalizar(b, rev)).toEqual({ status: "inexistente" });
    expect((await obterJornada(a))?.estado).toBe("em_andamento");
  });
});

describe("adiar e retomar", () => {
  it("adiar cria já adiada; retomar volta para em andamento; concluída não é adiada", async () => {
    const u = await novaPessoa();
    await adiarJornada(u);
    expect((await obterJornada(u))?.estado).toBe("adiada");
    await retomarJornada(u);
    expect((await obterJornada(u))?.estado).toBe("em_andamento");
    const v = await novaPessoa();
    const rev = await ateRevisao(v, {});
    expect((await finalizar(v, rev)).status).toBe("concluida");
    await adiarJornada(v);
    expect((await obterJornada(v))?.estado).toBe("concluida");
  });
});

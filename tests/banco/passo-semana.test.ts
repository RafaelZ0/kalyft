// Fase 9C: resumo semanal com próximo passo, contra o banco de teste.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { createElement } from "react";
import { prerender } from "react-dom/static";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const sessao = { userId: A, admin: null };
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao, obterVinculoSessao: async () => "0".repeat(64) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); },
  usePathname: () => "/progresso/semana",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { db } from "@/lib/db";
import { agua, metas, passosSemana, perfis } from "@/lib/db/schema";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { salvarPesagem } from "@/lib/dal/corpo";
import { dadosDaSemana, obterPassoSemana } from "@/lib/dal/passos-semana";
import { garantirPerfil } from "@/lib/dal/perfil";
import { criarRegistros } from "@/lib/dal/registros";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { inicioDaSemana } from "@/lib/progresso-graficos";
import { semanaSeguinte } from "@/lib/relatorio";
import { escolherPassoSemana, removerPassoSemanaAcao } from "@/app/(app)/progresso/semana/passo-actions";
import PaginaSemana from "@/app/(app)/progresso/semana/page";

const HOJE = hojeSaoPaulo();
const SEMANA = inicioDaSemana(HOJE);
const form = (campos: Record<string, string>) => {
  const f = new FormData();
  f.set("contextoId", "proprio");
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};
async function html(searchParams: Record<string, string> = {}): Promise<string> {
  const arvore = await PaginaSemana({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) } as never);
  const { prelude } = await prerender(createElement("div", null, arvore));
  return new Response(prelude).text();
}

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  await db.insert(metas).values({ userId: A, vigenteDesde: somarDias(SEMANA, -30), kcal: 2000, proteinaG: 120, aguaMl: 2000 });
  const al = await criarAlimentoUsuario(A, { nome: "Frango grelhado", marca: null, kcal: 160, proteinaG: 30, carboG: 0, gorduraG: 4, fibraG: 0, sodioMg: 60 });
  // segunda-feira: almoço com 130 g de proteína (bate a meta) e jantar; se a semana já tem terça, almoço com 60 g
  const dias = [SEMANA, ...(HOJE > SEMANA ? [somarDias(SEMANA, 1)] : [])];
  await criarRegistros(A, [
    { data: dias[0], refeicao: "almoco", tipo: "usuario", alimentoId: al, nome: "Frango", gramas: 400, medidaTexto: null, nutrientes: { kcal: 640, proteinaG: 130, carboG: 0, gorduraG: 16, fibraG: 0 } },
    { data: dias[0], refeicao: "jantar", tipo: "usuario", alimentoId: al, nome: "Frango", gramas: 100, medidaTexto: null, nutrientes: { kcal: 160, proteinaG: 30, carboG: 0, gorduraG: 4, fibraG: 0 } },
    ...(dias[1] ? [{ data: dias[1], refeicao: "almoco" as const, tipo: "usuario" as const, alimentoId: al, nome: "Frango", gramas: 200, medidaTexto: null, nutrientes: { kcal: 320, proteinaG: 60, carboG: 0, gorduraG: 8, fibraG: 0 } }] : []),
  ]);
  await salvarPesagem(A, SEMANA, { pesoKg: 88, massaMagraKg: null, cinturaCm: null });
  await db.insert(agua).values([{ userId: A, data: SEMANA, ml: 1500 }, { userId: A, data: SEMANA, ml: 600 }]);
}, 120_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

describe("contagens da semana", () => {
  it("conta dias, refeições, pesagens e metas atingidas só do próprio usuário", async () => {
    const d = await dadosDaSemana(A, SEMANA, HOJE);
    const doisDias = HOJE > SEMANA;
    expect(d.diasComRegistro).toBe(doisDias ? 2 : 1);
    expect(d.diasPorRefeicao).toEqual({ almoco: doisDias ? 2 : 1, jantar: 1 });
    expect(d.pesagens).toBe(1);
    expect(d.treinosFeitos).toBe(0);
    expect(d.diasProteinaNaMeta).toBe(1); // 160 g na segunda; 60 g na terça não conta
    expect(d.diasAguaNaMeta).toBe(1); // 2100 ml ≥ 2000
    const b = await dadosDaSemana(B, SEMANA, HOJE);
    expect(b).toEqual({ diasComRegistro: 0, diasPorRefeicao: {}, pesagens: 0, treinosFeitos: 0, diasProteinaNaMeta: null, diasAguaNaMeta: null });
  });
});

describe("escolher o passo", () => {
  it("passo sugerido para esta semana: grava e a tela mostra o andamento", async () => {
    expect((await escolherPassoSemana({}, form({ semana: "atual", escolha: "pesar_dias|3|" }))).ok).toBeDefined();
    expect(await obterPassoSemana(A, SEMANA)).toEqual({ tipo: "pesar_dias", alvo: 3, refeicao: null, texto: null });
    const h = await html();
    expect(h).toContain("Pesar em 3 dias");
    expect(h).toContain("1 de 3");
    expect(h).toContain("Próximo passo para a semana que vem");
    expect(h).toContain("O que dá para dizer");
  });
  it("passo livre para a próxima semana, com texto limpo", async () => {
    expect((await escolherPassoSemana({}, form({ semana: "proxima", escolha: "livre", texto: "  levar   marmita\n três dias " }))).ok).toBeDefined();
    expect(await obterPassoSemana(A, semanaSeguinte(SEMANA))).toEqual({ tipo: "livre", alvo: null, refeicao: null, texto: "levar marmita três dias" });
  });
  it("passo de refeição exige a refeição", async () => {
    expect((await escolherPassoSemana({}, form({ semana: "proxima", escolha: "refeicao_dias|5|jantar" }))).ok).toBeDefined();
    expect(await obterPassoSemana(A, semanaSeguinte(SEMANA))).toMatchObject({ tipo: "refeicao_dias", refeicao: "jantar", alvo: 5 });
    expect((await escolherPassoSemana({}, form({ semana: "proxima", escolha: "refeicao_dias|5|" }))).erro).toBeDefined();
    expect((await escolherPassoSemana({}, form({ semana: "proxima", escolha: "pesar_dias|3|jantar" }))).erro).toBeDefined();
  });
  it.each([
    ["semana passada", { semana: "anterior", escolha: "pesar_dias|3|" }],
    ["alvo acima de 7", { semana: "atual", escolha: "pesar_dias|8|" }],
    ["alvo zero", { semana: "atual", escolha: "treinos|0|" }],
    ["tipo inventado", { semana: "atual", escolha: "comer_menos|3|" }],
    ["texto livre curto", { semana: "atual", escolha: "livre", texto: "a" }],
    ["texto livre longo", { semana: "atual", escolha: "livre", texto: "x".repeat(121) }],
  ])("recusa %s sem mudar o passo gravado", async (_, campos) => {
    const antes = await obterPassoSemana(A, SEMANA);
    expect((await escolherPassoSemana({}, form(campos as Record<string, string>))).erro).toBeDefined();
    expect(await obterPassoSemana(A, SEMANA)).toEqual(antes);
  });
  it("tirar o passo apaga só o do próprio usuário", async () => {
    sessao.userId = B;
    await removerPassoSemanaAcao(form({ semana: "atual" }));
    sessao.userId = A;
    expect(await obterPassoSemana(A, SEMANA)).not.toBeNull();
    await removerPassoSemanaAcao(form({ semana: "atual" }));
    expect(await obterPassoSemana(A, SEMANA)).toBeNull();
    expect(await html()).toContain("Um passo para esta semana");
  });
});

describe("banco", () => {
  it("CHECKs recusam semana que não é segunda e passos incoerentes", async () => {
    const terca = somarDias(SEMANA, 1);
    await expect(db.insert(passosSemana).values({ userId: A, inicio: terca, tipo: "pesar_dias", alvo: 3 })).rejects.toThrow();
    await expect(db.insert(passosSemana).values({ userId: A, inicio: somarDias(SEMANA, -7), tipo: "livre", alvo: 3, texto: "x" })).rejects.toThrow();
    await expect(db.insert(passosSemana).values({ userId: A, inicio: somarDias(SEMANA, -7), tipo: "pesar_dias", alvo: null })).rejects.toThrow();
    await expect(db.insert(passosSemana).values({ userId: A, inicio: somarDias(SEMANA, -7), tipo: "refeicao_dias", alvo: 3 })).rejects.toThrow();
    await expect(db.insert(passosSemana).values({ userId: A, inicio: somarDias(SEMANA, -7), tipo: "comer_menos", alvo: 3 })).rejects.toThrow();
  });
});

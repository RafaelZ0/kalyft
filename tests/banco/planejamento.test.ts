// Fase 9E: planejamento da semana e lista de compras, contra o banco de teste.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
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
  notFound: () => { throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); },
  usePathname: () => "/comida/planejar",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { db } from "@/lib/db";
import { alimentosBase, comprasItens, perfis, refeicoesPlanejadas, registrosAlimentares } from "@/lib/db/schema";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { garantirPerfil } from "@/lib/dal/perfil";
import { ingredientesDoPeriodo, listarPlanejados, marcasDaSemana } from "@/lib/dal/planejamento";
import { criarRefeicaoSalva } from "@/lib/dal/refeicoes-salvas";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { diasDaSemana, listaDeCompras, semanaDoPlanejamento } from "@/lib/planejamento";
import { salvarReceita } from "@/app/(app)/comida/receitas/actions";
import {
  adicionarAvulsoAcao, alternarAvulsoAcao, alternarCompradoAcao, comiIsso, planejarItem, removerAvulsoAcao, removerPlanejadoAcao, repetirSemanaAcao,
} from "@/app/(app)/comida/planejar/actions";
import PaginaPlanejar from "@/app/(app)/comida/planejar/page";
import PaginaCompras from "@/app/(app)/comida/planejar/compras/page";
import PaginaComida from "@/app/(app)/comida/page";

const HOJE = hojeSaoPaulo();
const SEMANA = semanaDoPlanejamento(HOJE, HOJE);
const DIAS = diasDaSemana(SEMANA);
let arroz: string;
let feijao: string;
let frangoA: string;
let alimentoDeB: string;
let receita: string;
let salva: string;

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  f.set("contextoId", "proprio");
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};
const destino = async (p: Promise<unknown>) => {
  try {
    const r = await p;
    return { estado: r as { erro?: string; ok?: string }, url: null as string | null };
  } catch (e) {
    const d = (e as { digest?: string }).digest;
    if (!d?.startsWith("NEXT_REDIRECT")) throw e;
    return { estado: null, url: d.split(";").at(-1)! };
  }
};
const planejar = (c: Record<string, string>) => destino(planejarItem({}, form({ data: HOJE, refeicao: "almoco", tipoAlimento: "", ...c })));
async function html(Pagina: (p: never) => Promise<React.ReactNode>, sp: Record<string, string> = {}): Promise<string> {
  const arvore = await Pagina({ searchParams: Promise.resolve(sp), params: Promise.resolve({}) } as never);
  const { prelude } = await prerender(createElement("div", null, arvore));
  return new Response(prelude).text();
}

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  const [a] = await db.select({ id: alimentosBase.id }).from(alimentosBase).where(eq(alimentosBase.nome, "Arroz, integral, cozido")).limit(1);
  const [f] = await db.select({ id: alimentosBase.id }).from(alimentosBase).where(eq(alimentosBase.nome, "Feijão, carioca, cozido")).limit(1);
  arroz = a.id;
  feijao = f.id;
  frangoA = await criarAlimentoUsuario(A, { nome: "Frango da casa", marca: null, kcal: 160, proteinaG: 30, carboG: 0, gorduraG: 4, fibraG: 0, sodioMg: 60 });
  alimentoDeB = await criarAlimentoUsuario(B, { nome: "Alimento do B", marca: null, kcal: 100, proteinaG: 1, carboG: 1, gorduraG: 1, fibraG: 0, sodioMg: 0 });
  // receita: 400 g de arroz + 200 g de frango, 4 porções, peso final 600 g (150 g por porção)
  const r = await destino(salvarReceita({}, form({ receita: JSON.stringify({ nome: "Arroz com frango", porcoes: 4, pesoFinalG: 600, itens: [{ tipo: "base", alimentoId: arroz, gramas: 400 }, { tipo: "usuario", alimentoId: frangoA, gramas: 200 }] }) })));
  receita = /receitas\/([0-9a-f-]{36})/.exec(r.url ?? "")![1];
  salva = await criarRefeicaoSalva(A, "Prato feito", [{ alimentoBaseId: arroz, alimentoUsuarioId: null, gramas: 100, medidaTexto: null }, { alimentoBaseId: feijao, alimentoUsuarioId: null, gramas: 80, medidaTexto: null }]);
}, 120_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

describe("planejar", () => {
  it("planeja receita, refeição salva e alimento; nada entra no diário", async () => {
    expect((await planejar({ tipo: "receita", referenciaId: receita, quantidade: "2" })).url).toContain(`/comida/planejar?semana=${SEMANA}`);
    expect((await planejar({ tipo: "salva", referenciaId: salva, quantidade: "1" })).url).toBeDefined();
    expect((await planejar({ tipo: "alimento", referenciaId: feijao, tipoAlimento: "base", quantidade: "150", refeicao: "jantar" })).url).toBeDefined();
    const l = await listarPlanejados(A, HOJE, HOJE);
    expect(l.map((p) => [p.tipo, p.nome, p.quantidade])).toEqual([["receita", "Arroz com frango", 2], ["salva", "Prato feito", 1], ["alimento", "Feijão, carioca, cozido", 150]]);
    expect(await db.select().from(registrosAlimentares).where(eq(registrosAlimentares.userId, A))).toEqual([]);
  });

  it("limite de 4 itens por refeição do dia", async () => {
    await planejar({ tipo: "alimento", referenciaId: arroz, tipoAlimento: "base", quantidade: "100" });
    await planejar({ tipo: "alimento", referenciaId: feijao, tipoAlimento: "base", quantidade: "100" });
    const r = await planejar({ tipo: "alimento", referenciaId: arroz, tipoAlimento: "base", quantidade: "50" });
    expect(r.estado?.erro).toContain("4 itens");
  });

  it.each([
    ["receita de outra pessoa (o banco recusa)", { tipo: "alimento", referenciaId: alimentoDeB, tipoAlimento: "usuario", quantidade: "100", refeicao: "ceia" }],
    ["porções fora do limite", { tipo: "receita", referenciaId: "", quantidade: "11", refeicao: "ceia" }],
    ["gramas fora do limite", { tipo: "alimento", referenciaId: "", tipoAlimento: "base", quantidade: "6000", refeicao: "ceia" }],
    ["alimento sem tipo", { tipo: "alimento", referenciaId: "", tipoAlimento: "", quantidade: "100", refeicao: "ceia" }],
    ["data fora da janela", { tipo: "alimento", referenciaId: "", tipoAlimento: "base", quantidade: "100", refeicao: "ceia", data: somarDias(HOJE, 70) }],
    ["tipo inventado", { tipo: "jejum", referenciaId: "", quantidade: "1", refeicao: "ceia" }],
  ])("recusa %s", async (_, c) => {
    const campos = { ...c, referenciaId: c.referenciaId || (c.tipo === "receita" ? receita : arroz) } as Record<string, string>;
    const r = await planejar(campos);
    expect(r.estado?.erro).toBeDefined();
    expect((await listarPlanejados(A, somarDias(HOJE, -70), somarDias(HOJE, 70))).some((p) => p.refeicao === "ceia")).toBe(false);
  });
});

describe("comi isso", () => {
  it("receita: registra porções × gramas por porção, com nutrientes do banco, e só uma vez", async () => {
    const p = (await listarPlanejados(A, HOJE, HOJE)).find((x) => x.tipo === "receita")!;
    expect((await comiIsso({}, form({ id: p.id }))).ok).toBe("Registrado no diário.");
    expect((await comiIsso({}, form({ id: p.id }))).ok).toBe("Já estava registrado.");
    const regs = await db.select().from(registrosAlimentares).where(eq(registrosAlimentares.userId, A));
    expect(regs).toHaveLength(1);
    expect(Number(regs[0].gramas)).toBe(300); // 2 porções × 150 g
    expect(regs[0].medidaTexto).toBe("2 porções");
    expect(Number(regs[0].kcal)).toBeGreaterThan(0);
    expect((await listarPlanejados(A, HOJE, HOJE)).find((x) => x.id === p.id)!.consumido).toBe(true);
  });

  it("refeição salva: um registro por item; alimento: gramas planejadas", async () => {
    const l = await listarPlanejados(A, HOJE, HOJE);
    await comiIsso({}, form({ id: l.find((x) => x.tipo === "salva")!.id }));
    await comiIsso({}, form({ id: l.find((x) => x.tipo === "alimento" && x.refeicao === "jantar")!.id }));
    const regs = await db.select().from(registrosAlimentares).where(eq(registrosAlimentares.userId, A));
    expect(regs).toHaveLength(4);
    expect(regs.filter((r) => r.refeicao === "jantar").map((r) => Number(r.gramas))).toEqual([150]);
  });

  it("não marca como comido no futuro nem item de outra pessoa", async () => {
    const amanha = somarDias(HOJE, 1);
    await destino(planejarItem({}, form({ data: amanha, refeicao: "cafe", tipo: "alimento", referenciaId: arroz, tipoAlimento: "base", quantidade: "50" })));
    const futuro = (await listarPlanejados(A, amanha, amanha))[0];
    expect((await comiIsso({}, form({ id: futuro.id }))).erro).toContain("no dia ou depois");
    sessao.userId = B;
    expect((await comiIsso({}, form({ id: futuro.id }))).erro).toBe("Item não encontrado.");
    await removerPlanejadoAcao(form({ id: futuro.id }));
    sessao.userId = A;
    expect(await listarPlanejados(A, amanha, amanha)).toHaveLength(1); // B não apagou
    await removerPlanejadoAcao(form({ id: futuro.id }));
    expect(await listarPlanejados(A, amanha, amanha)).toHaveLength(0);
  });
});

describe("lista de compras", () => {
  it("soma receita (proporção das porções), refeição salva e alimentos", async () => {
    const lista = listaDeCompras(await ingredientesDoPeriodo(A, DIAS[0], DIAS[6]));
    const g = (id: string) => lista.find((i) => i.chave === id)?.gramas;
    // arroz: receita 400 × 2/4 = 200 + salva 100 + alimento 100 = 400
    expect(g(`base:${arroz}`)).toBe(400);
    // feijão: salva 80 + jantar 150 + almoço 100 = 330
    expect(g(`base:${feijao}`)).toBe(330);
    expect(g(`usuario:${frangoA}`)).toBe(100); // 200 × 2/4
    expect(await ingredientesDoPeriodo(B, DIAS[0], DIAS[6])).toEqual([]);
  });

  it("marcar comprado, item avulso, isolamento e a tela", async () => {
    await alternarCompradoAcao(form({ semana: SEMANA, chave: `base:${arroz}` }));
    expect((await marcasDaSemana(A, SEMANA)).comprados.has(`base:${arroz}`)).toBe(true);
    await alternarCompradoAcao(form({ semana: SEMANA, chave: `base:${arroz}` }));
    expect((await marcasDaSemana(A, SEMANA)).comprados.has(`base:${arroz}`)).toBe(false);
    await alternarCompradoAcao(form({ semana: SEMANA, chave: "base:'; drop table x;--" })); // recusado pelo Zod
    expect((await adicionarAvulsoAcao({}, form({ semana: SEMANA, texto: "  papel\ntoalha " }))).ok).toBeDefined();
    expect((await adicionarAvulsoAcao({}, form({ semana: SEMANA, texto: "x".repeat(81) }))).erro).toBeDefined();
    const [av] = (await marcasDaSemana(A, SEMANA)).avulsos;
    expect(av.texto).toBe("papel toalha");
    sessao.userId = B;
    await alternarAvulsoAcao(form({ id: av.id }));
    await removerAvulsoAcao(form({ id: av.id }));
    sessao.userId = A;
    expect((await marcasDaSemana(A, SEMANA)).avulsos).toEqual([{ id: av.id, texto: "papel toalha", comprado: false }]);
    const h = await html(PaginaCompras, { semana: SEMANA });
    expect(h).toContain("Lista de compras");
    expect(h).toContain("Feijão, carioca, cozido");
    expect(h).toContain("papel toalha");
  });

  it("CHECKs: semana que não é segunda, chave malformada e item vazio são recusados", async () => {
    await expect(db.insert(comprasItens).values({ userId: A, semana: somarDias(SEMANA, 1), texto: "x" })).rejects.toThrow();
    await expect(db.insert(comprasItens).values({ userId: A, semana: SEMANA, chave: "base:nao-uuid" })).rejects.toThrow();
    await expect(db.insert(comprasItens).values({ userId: A, semana: SEMANA })).rejects.toThrow();
    await expect(db.insert(refeicoesPlanejadas).values({ userId: A, data: HOJE, refeicao: "almoco", tipo: "receita", quantidade: 1 })).rejects.toThrow(); // receita sem id
    await expect(db.insert(refeicoesPlanejadas).values({ userId: A, data: HOJE, refeicao: "almoco", tipo: "alimento", alimentoBaseId: arroz, alimentoUsuarioId: frangoA, quantidade: 100 })).rejects.toThrow();
  });
});

describe("telas e repetir semana", () => {
  it("semana e diário mostram o planejado separado do consumido", async () => {
    const s = await html(PaginaPlanejar, { semana: SEMANA });
    expect(s).toContain("Planejar a semana");
    expect(s).toContain("Arroz com frango");
    expect(s).toContain("Comido");
    const d = await html(PaginaComida);
    expect(d).toContain("Planejado");
    expect(d).toContain("Comi isso");
  });

  it("repetir a semana passada copia só para semana vazia", async () => {
    const seguinte = somarDias(SEMANA, 7);
    await repetirSemanaAcao(form({ semana: seguinte }));
    const copiados = await listarPlanejados(A, seguinte, somarDias(seguinte, 6));
    const originais = await listarPlanejados(A, SEMANA, somarDias(SEMANA, 6));
    expect(copiados).toHaveLength(originais.length);
    expect(copiados.every((c) => !c.consumido)).toBe(true);
    await repetirSemanaAcao(form({ semana: seguinte }));
    expect(await listarPlanejados(A, seguinte, somarDias(seguinte, 6))).toHaveLength(originais.length);
    expect(await db.select().from(refeicoesPlanejadas).where(and(eq(refeicoesPlanejadas.userId, B)))).toEqual([]);
  });
});

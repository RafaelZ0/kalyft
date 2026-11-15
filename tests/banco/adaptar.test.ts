// Fase 9B: adaptar o treino de hoje, contra o banco de teste.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
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
  usePathname: () => "/treino",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { db } from "@/lib/db";
import { adaptacoesTreino, perfis, treinoExercicios } from "@/lib/db/schema";
import { obterAdaptacao } from "@/lib/dal/adaptacoes";
import { garantirPerfil } from "@/lib/dal/perfil";
import { adicionarItem, adicionarSubstituto, criarExercicio, criarPlano, criarTreino, definirAgenda, listarItensDoTreino } from "@/lib/dal/treino";
import { carregarTreinoDoDia } from "@/lib/dal/treino-do-dia";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { diaDaSemana } from "@/lib/treino";
import { semAjuste, versaoNoTempo } from "@/lib/treino-adaptado";
import { removerAdaptacaoAcao, salvarAdaptacao } from "@/app/(app)/treino/adaptar/actions";
import PaginaTreino from "@/app/(app)/treino/page";
import PaginaSessao from "@/app/(app)/treino/sessao/page";
import PaginaAdaptar from "@/app/(app)/treino/adaptar/page";

const HOJE = hojeSaoPaulo();
const ex: Record<string, string> = {};
let treinoId: string;
let itens: Awaited<ReturnType<typeof listarItensDoTreino>>;
let exDeB: string;

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  f.set("contextoId", "proprio");
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};
const redirecionou = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { digest?: string }).digest ?? null;
  }
};
async function html(Pagina: (p: never) => Promise<React.ReactNode>, searchParams: Record<string, string> = {}): Promise<string> {
  const arvore = await Pagina({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) } as never);
  const { prelude } = await prerender(createElement("div", null, arvore));
  return new Response(prelude).text();
}
async function plano() {
  return (await import("@/lib/dal/treino")).planoAtivo(A).then((p) => p!);
}

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  for (const [chave, nome, grupo] of [["supino", "Supino reto", "Peito"], ["cross", "Crucifixo no cross", "Peito"], ["flexao", "Flexão", "peito"], ["remada", "Remada baixa", "Costas"], ["puxada", "Puxada alta", "Costas"], ["agach", "Agachamento", "Pernas"]] as const) {
    ex[chave] = await criarExercicio(A, { nome, grupo, unilateral: false, cargaPorHalter: false, medida: "repeticoes", fotoId: null });
  }
  exDeB = await criarExercicio(B, { nome: "Supino do B", grupo: "Peito", unilateral: false, cargaPorHalter: false, medida: "repeticoes", fotoId: null });
  const planoId = await criarPlano(A, { nome: "Plano teste", inicio: somarDias(HOJE, -60), seriesInicio: 2, seriesDepois: 3, semanasInicio: 1 });
  treinoId = await criarTreino(A, planoId, "Treino A", "Peito e costas");
  for (const chave of ["supino", "remada", "puxada", "agach"]) {
    await adicionarItem(A, { treinoId, exercicioId: ex[chave], series: null, repsMin: 8, repsMax: 12, descansoS: 90, observacao: null });
  }
  itens = await listarItensDoTreino(A, treinoId);
  await adicionarSubstituto(A, itens.find((i) => i.exercicio.id === ex.remada)!.id, ex.puxada);
  await definirAgenda(A, diaDaSemana(HOJE), treinoId);
}, 120_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

describe("treino do dia sem adaptação", () => {
  it("usa as séries da fase do plano e mostra o botão de adaptar", async () => {
    const dia = (await carregarTreinoDoDia(A, await plano(), HOJE))!;
    expect(dia.completos.map((i) => i.series)).toEqual([3, 3, 3, 3]);
    expect(dia.adaptacao).toBeNull();
    const h = await html(PaginaTreino);
    expect(h).toContain("Adaptar o treino de hoje");
    expect(h).not.toContain("Adaptado para hoje");
  });
});

describe("salvar a adaptação", () => {
  it("grava a versão de 15 minutos com troca e o plano continua igual", async () => {
    const dia = (await carregarTreinoDoDia(A, await plano(), HOJE))!;
    const agach = itens.find((i) => i.exercicio.id === ex.agach)!.id;
    // 15 min: todos com 2 séries; mais a troca do supino pelo cross e o agachamento pulado (escolha da pessoa)
    const v = versaoNoTempo(dia.completos, 15).map((a) => (a.itemId === itens[0].id ? { ...a, exercicioId: ex.cross } : a.itemId === agach ? { ...a, pular: true } : a));
    const r = await redirecionou(salvarAdaptacao({}, form({ data: HOJE, minutos: "15", itens: JSON.stringify(v) })));
    expect(r).toContain(`/treino?data=${HOJE}`);
    const salva = (await obterAdaptacao(A, HOJE))!;
    expect(salva.minutos).toBe(15);
    expect(salva.itens).toEqual(v);
    // plano intacto
    const noBanco = await db.select().from(treinoExercicios).where(eq(treinoExercicios.treinoId, treinoId));
    expect(noBanco.every((i) => i.series === null)).toBe(true);
    expect(noBanco.map((i) => i.exercicioId).sort()).toEqual([ex.supino, ex.remada, ex.puxada, ex.agach].sort());
  });

  it("as telas mostram a versão do dia: Treino, sessão e adaptar", async () => {
    const t = await html(PaginaTreino);
    expect(t).toContain("Adaptado para hoje");
    expect(t).toContain("Crucifixo no cross");
    expect(t).toContain("no lugar de");
    expect(t).toContain("pulado");
    const s = await html(PaginaSessao);
    expect(s).toContain("Treino adaptado para hoje");
    expect(s.indexOf("Crucifixo no cross")).toBeGreaterThan(-1);
    expect(s).not.toContain("Agachamento"); // pulado na adaptação
    const a = await html(PaginaAdaptar);
    expect(a).toContain("Voltar ao treino completo");
    expect(a).toContain("Usar esta versão hoje");
  });

  it("recusa adaptação que não bate com o treino, sem mudar a gravada", async () => {
    const antes = await obterAdaptacao(A, HOJE);
    const base = semAjuste((await carregarTreinoDoDia(A, await plano(), HOJE))!.completos);
    const casos = [
      base.slice(1), // item faltando
      base.map((a, i) => (i === 0 ? { ...a, series: 9 } : a)), // mais séries que o previsto
      base.map((a, i) => (i === 0 ? { ...a, exercicioId: ex.agach } : a)), // troca fora do grupo/substitutos
      base.map((a, i) => (i === 0 ? { ...a, exercicioId: exDeB } : a)), // exercício de outra pessoa
      base.map((a) => ({ ...a, pular: true })), // tudo pulado
      base.map((a, i) => (i === 0 ? { ...a, itemId: randomUUID() } : a)), // item de outro treino
    ];
    for (const c of casos) {
      expect((await salvarAdaptacao({}, form({ data: HOJE, minutos: "", itens: JSON.stringify(c) }))).erro).toBeDefined();
    }
    expect((await salvarAdaptacao({}, form({ data: HOJE, minutos: "17", itens: JSON.stringify(base) }))).erro).toBeDefined();
    expect((await salvarAdaptacao({}, form({ data: HOJE, minutos: "", itens: "não é json" }))).erro).toBeDefined();
    expect((await salvarAdaptacao({}, form({ data: somarDias(HOJE, 1), minutos: "", itens: JSON.stringify(base) }))).erro).toBeDefined(); // futuro
    expect(await obterAdaptacao(A, HOJE)).toEqual(antes);
  });

  it("salvar igual ao plano remove a adaptação (sem etiqueta vazia)", async () => {
    const base = semAjuste((await carregarTreinoDoDia(A, await plano(), HOJE))!.completos);
    await redirecionou(salvarAdaptacao({}, form({ data: HOJE, minutos: "", itens: JSON.stringify(base) })));
    expect(await obterAdaptacao(A, HOJE)).toBeNull();
  });

  it("voltar ao treino completo apaga só a do próprio usuário", async () => {
    const dia = (await carregarTreinoDoDia(A, await plano(), HOJE))!;
    await redirecionou(salvarAdaptacao({}, form({ data: HOJE, minutos: "20", itens: JSON.stringify(versaoNoTempo(dia.completos, 20)) })));
    expect(await obterAdaptacao(A, HOJE)).not.toBeNull();
    sessao.userId = B;
    await removerAdaptacaoAcao(form({ data: HOJE }));
    sessao.userId = A;
    expect(await obterAdaptacao(A, HOJE)).not.toBeNull();
    await removerAdaptacaoAcao(form({ data: HOJE }));
    expect(await obterAdaptacao(A, HOJE)).toBeNull();
  });
});

describe("isolamento e banco", () => {
  it("outra pessoa não vê a adaptação e não consegue gravar no treino de A", async () => {
    const dia = (await carregarTreinoDoDia(A, await plano(), HOJE))!;
    await redirecionou(salvarAdaptacao({}, form({ data: HOJE, minutos: "15", itens: JSON.stringify(versaoNoTempo(dia.completos, 15)) })));
    expect(await obterAdaptacao(B, HOJE)).toBeNull();
    // B não tem plano: a action recusa sem tocar em A
    sessao.userId = B;
    expect((await salvarAdaptacao({}, form({ data: HOJE, minutos: "", itens: JSON.stringify(semAjuste(dia.completos)) }))).erro).toBeDefined();
    sessao.userId = A;
    // o banco recusa adaptação apontando para treino de outra pessoa (chave composta)
    await expect(db.insert(adaptacoesTreino).values({ userId: B, data: HOJE, treinoId, minutos: null, itens: [{ itemId: itens[0].id, series: 1, pular: false, exercicioId: null }] })).rejects.toThrow();
  });

  it("CHECKs: minutos fora das opções e lista vazia são recusados", async () => {
    await expect(db.insert(adaptacoesTreino).values({ userId: A, data: somarDias(HOJE, -1), treinoId, minutos: 17, itens: [{ itemId: itens[0].id, series: 1, pular: false, exercicioId: null }] })).rejects.toThrow();
    await expect(db.insert(adaptacoesTreino).values({ userId: A, data: somarDias(HOJE, -1), treinoId, minutos: null, itens: [] })).rejects.toThrow();
  });

  it("trocar o treino do dia faz a adaptação antiga ser ignorada", async () => {
    const planoId = (await plano()).id;
    const outro = await criarTreino(A, planoId, "Treino B", null);
    await adicionarItem(A, { treinoId: outro, exercicioId: ex.agach, series: null, repsMin: 8, repsMax: 12, descansoS: 60, observacao: null });
    await definirAgenda(A, diaDaSemana(HOJE), outro);
    const dia = (await carregarTreinoDoDia(A, await plano(), HOJE))!;
    expect(dia.treino.id).toBe(outro);
    expect(dia.adaptacao).toBeNull();
    expect(dia.doDia).toHaveLength(1);
    await definirAgenda(A, diaDaSemana(HOJE), treinoId);
  });
});

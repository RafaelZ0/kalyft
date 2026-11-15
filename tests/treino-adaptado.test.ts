import { describe, expect, it } from "vitest";
import {
  alternativas,
  aplicarAdaptacao,
  ehAdaptado,
  minutosEstimados,
  segundosDoExercicio,
  semAjuste,
  validarAdaptacao,
  versaoNoTempo,
  type ItemParaAdaptar,
} from "@/lib/treino-adaptado";

const item = (id: string, series: number, extra: Partial<ItemParaAdaptar> = {}): ItemParaAdaptar => ({
  id, series, repsMax: 12, descansoS: 90, porSegundos: false, exercicioId: `ex-${id}`, grupo: "Peito", substitutos: [], ...extra,
});
// 5 exercícios × 3 séries: cada um 3×40 + 2×90 = 300 s; + 4 transições de 60 s = 1740 s = 29 min
const treino = ["a", "b", "c", "d", "e"].map((id) => item(id, 3));
const meus = [
  { id: "ex-a", nome: "Supino", grupo: "Peito" },
  { id: "ex-cross", nome: "Crucifixo no cross", grupo: "peito" },
  { id: "ex-flexao", nome: "Flexão", grupo: "Peito " },
  { id: "ex-agach", nome: "Agachamento", grupo: "Pernas" },
];

describe("estimativa de duração", () => {
  it("séries × execução + descanso entre séries + transições", () => {
    expect(segundosDoExercicio(item("x", 3), 3)).toBe(300);
    expect(segundosDoExercicio(item("x", 3, { porSegundos: true, repsMax: 30 }), 2)).toBe(150); // 2×30 + 90
    expect(segundosDoExercicio(item("x", 3), 0)).toBe(0);
    expect(minutosEstimados(treino)).toBe(29);
    expect(minutosEstimados([])).toBe(0);
  });
});

describe("versão que cabe no tempo", () => {
  it("se já cabe, não muda nada", () => {
    expect(ehAdaptado(treino, versaoNoTempo(treino, 30))).toBe(false);
  });
  it("primeiro reduz séries (até 2), do fim para o começo", () => {
    const v = versaoNoTempo(treino, 25);
    expect(v.every((a) => !a.pular)).toBe(true);
    expect(v.map((a) => a.series)).toEqual([3, 3, 3, 2, 2]); // 2 cortes de 130 s: 1740 → 1480 s ≤ 1500 s
    const min = minutosEstimados(v.map((a) => ({ ...treino.find((t) => t.id === a.itemId)!, series: a.series })));
    expect(min).toBeLessThanOrEqual(25);
  });
  it("com todas em 2 séries, pula exercícios a partir do fim", () => {
    const v = versaoNoTempo(treino, 15);
    expect(v.map((a) => a.series)).toEqual([2, 2, 2, 2, 2]);
    expect(v.map((a) => a.pular)).toEqual([false, false, false, false, true]); // 5×170+240 = 1090 s; sem o último, 860 s ≤ 900 s
  });
  it("nunca tira todos os exercícios, mesmo sem caber", () => {
    const longo = [item("a", 5, { descansoS: 600 })];
    const v = versaoNoTempo(longo, 15);
    expect(v[0].pular).toBe(false);
    expect(v[0].series).toBe(2);
  });
  it("quem já tinha menos que o mínimo fica como está", () => {
    const v = versaoNoTempo([item("a", 1), item("b", 4)], 1);
    expect(v[0].series).toBe(1);
  });
  it("mantém as trocas já escolhidas ao mudar o tempo", () => {
    const base = semAjuste(treino).map((a) => (a.itemId === "a" ? { ...a, exercicioId: "ex-cross" } : a));
    expect(versaoNoTempo(treino, 20, base)[0].exercicioId).toBe("ex-cross");
  });
});

describe("alternativas para trocar", () => {
  it("substitutos do plano primeiro, depois o mesmo grupo (sem acento/maiúscula/espaço), sem o próprio", () => {
    const a = item("a", 3, { exercicioId: "ex-a", substitutos: [{ id: "ex-sub", nome: "Supino com halteres" }] });
    expect(alternativas(a, meus)).toEqual([
      { id: "ex-sub", nome: "Supino com halteres", origem: "substituto" },
      { id: "ex-cross", nome: "Crucifixo no cross", origem: "mesmo_grupo" },
      { id: "ex-flexao", nome: "Flexão", origem: "mesmo_grupo" },
    ]);
  });
  it("sem grupo, só os substitutos", () => {
    expect(alternativas(item("a", 3, { grupo: null }), meus)).toEqual([]);
  });
});

describe("validação do que vem do cliente", () => {
  it("aceita uma adaptação coerente", () => {
    const v = versaoNoTempo(treino, 15).map((a) => (a.itemId === "a" ? { ...a, exercicioId: "ex-cross" } : a));
    expect(validarAdaptacao(treino, v, meus)).toEqual(v);
  });
  it.each([
    ["item faltando", semAjuste(treino).slice(1)],
    ["item de outro treino", [...semAjuste(treino).slice(1), { itemId: "z", series: 3, pular: false, exercicioId: null }]],
    ["mais séries que o previsto", semAjuste(treino).map((a, i) => (i === 0 ? { ...a, series: 4 } : a))],
    ["zero séries", semAjuste(treino).map((a, i) => (i === 0 ? { ...a, series: 0 } : a))],
    ["troca para exercício que não é alternativa", semAjuste(treino).map((a, i) => (i === 0 ? { ...a, exercicioId: "ex-agach" } : a))],
    ["troca para exercício de outra pessoa", semAjuste(treino).map((a, i) => (i === 0 ? { ...a, exercicioId: "ex-de-outro" } : a))],
    ["todos pulados", semAjuste(treino).map((a) => ({ ...a, pular: true }))],
    ["item repetido", [...semAjuste(treino).slice(0, 4), semAjuste(treino)[0]]],
  ])("recusa %s", (_, ajustes) => {
    expect(validarAdaptacao(treino, ajustes, meus)).toBeNull();
  });
});

describe("aplicar a adaptação guardada", () => {
  it("tira os pulados, ajusta séries e marca a troca", () => {
    const v = versaoNoTempo(treino, 15).map((a) => (a.itemId === "a" ? { ...a, exercicioId: "ex-cross" } : a));
    const r = aplicarAdaptacao(treino, v, meus);
    expect(r.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(r.map((i) => i.series)).toEqual([2, 2, 2, 2]);
    expect(r[0].exercicioEscolhido).toBe("ex-cross");
    expect(r[1].exercicioEscolhido).toBeNull();
  });
  it("plano mudou depois: item novo entra completo, troca inválida volta ao do plano, séries limitadas", () => {
    const ajustes = [{ itemId: "a", series: 9, pular: false, exercicioId: "ex-agach" }];
    const r = aplicarAdaptacao([item("a", 3), item("novo", 4)], ajustes, meus);
    expect(r.map((i) => [i.id, i.series, i.exercicioEscolhido])).toEqual([["a", 3, null], ["novo", 4, null]]);
  });
});

import { describe, expect, it } from "vitest";
import { ajustarPorcao, chaveOculto, horaSaoPaulo, itensHabituais, refeicaoDoHorario, type RegistroHistorico } from "@/lib/rotina";
import { detectarPausa, emPausa, limitarPausa } from "@/lib/retomar";

const r = (data: string, alimentoId: string, gramas: number, refeicao: RegistroHistorico["refeicao"] = "cafe", nome = alimentoId): RegistroHistorico => ({ data, refeicao, tipo: "base", alimentoId, nome, gramas });
const HOJE = "2026-11-14";

describe("refeição do horário", () => {
  it.each([[4, "ceia"], [5, "cafe"], [9, "cafe"], [10, "almoco"], [14, "almoco"], [15, "lanche"], [17, "lanche"], [18, "jantar"], [21, "jantar"], [22, "ceia"], [0, "ceia"]] as const)("%sh → %s", (h, esperado) => {
    expect(refeicaoDoHorario(h)).toBe(esperado);
  });
  it("hora em São Paulo (UTC−3)", () => {
    expect(horaSaoPaulo(new Date("2026-11-14T10:30:00Z"))).toBe(7);
    expect(horaSaoPaulo(new Date("2026-11-14T02:00:00Z"))).toBe(23);
  });
});

describe("itens habituais", () => {
  const hist = [
    r("2026-11-01", "pao", 50), r("2026-11-03", "pao", 50), r("2026-11-05", "pao", 60), r("2026-11-07", "pao", 52),
    r("2026-11-02", "cafe-leite", 200), r("2026-11-04", "cafe-leite", 180), r("2026-11-06", "cafe-leite", 210),
    r("2026-11-03", "ovo", 100), r("2026-11-05", "ovo", 100), // só 2 dias: não é hábito
    r("2026-11-03", "banana", 100, "lanche"), r("2026-11-04", "banana", 100, "lanche"), r("2026-11-05", "banana", 100, "lanche"),
  ];
  it("pega quem aparece em 3 dias ou mais naquela refeição, com a porção mediana", () => {
    expect(itensHabituais(hist, "cafe", { hoje: HOJE })).toEqual([
      { tipo: "base", alimentoId: "pao", nome: "pao", gramas: 50, dias: 4 }, // mediana 51 → 50
      { tipo: "base", alimentoId: "cafe-leite", nome: "cafe-leite", gramas: 200, dias: 3 },
    ]);
    expect(itensHabituais(hist, "lanche", { hoje: HOJE }).map((i) => i.alimentoId)).toEqual(["banana"]);
    expect(itensHabituais(hist, "jantar", { hoje: HOJE })).toEqual([]);
  });
  it("vários registros no mesmo dia contam como um dia", () => {
    const h = [r("2026-11-01", "x", 10), r("2026-11-01", "x", 10), r("2026-11-01", "x", 10), r("2026-11-02", "x", 10)];
    expect(itensHabituais(h, "cafe", { hoje: HOJE })).toEqual([]);
  });
  it("tira o que já foi registrado hoje e o que foi ocultado", () => {
    const comHoje = [...hist, r(HOJE, "pao", 50)];
    expect(itensHabituais(comHoje, "cafe", { hoje: HOJE }).map((i) => i.alimentoId)).toEqual(["cafe-leite"]);
    const ocultos = new Set([chaveOculto("cafe", "base", "cafe-leite")]);
    expect(itensHabituais(hist, "cafe", { hoje: HOJE, ocultos }).map((i) => i.alimentoId)).toEqual(["pao"]);
    // ocultar no café não esconde no lanche
    expect(itensHabituais(hist, "lanche", { hoje: HOJE, ocultos: new Set([chaveOculto("cafe", "base", "banana")]) })).toHaveLength(1);
  });
  it("respeita o limite e usa o nome mais recente", () => {
    const h = ["a", "b", "c", "d", "e"].flatMap((id) => ["2026-11-01", "2026-11-02", "2026-11-03"].map((d) => r(d, id, 100)));
    expect(itensHabituais(h, "cafe", { hoje: HOJE })).toHaveLength(4);
    const renomeado = [r("2026-11-01", "p", 50, "cafe", "Pão antigo"), r("2026-11-02", "p", 50), r("2026-11-03", "p", 50, "cafe", "Pão francês")];
    expect(itensHabituais(renomeado, "cafe", { hoje: HOJE })[0].nome).toBe("Pão francês");
  });
});

describe("porção com − e +", () => {
  it("passos de 10% arredondados a 5 g, com limites", () => {
    expect(ajustarPorcao(200, 200, 1)).toBe(220);
    expect(ajustarPorcao(200, 200, -1)).toBe(180);
    expect(ajustarPorcao(30, 30, 1)).toBe(35); // passo mínimo de 5 g
    expect(ajustarPorcao(5, 30, -1)).toBe(5);
    expect(ajustarPorcao(4990, 1000, 1)).toBe(5000);
  });
});

describe("pausa", () => {
  it("3 dias sem atividade viram pausa, do dia seguinte à última até ontem", () => {
    expect(detectarPausa(["2026-11-01", "2026-11-10"], HOJE)).toEqual({ inicio: "2026-11-11", fim: "2026-11-13", dias: 3 });
  });
  it("menos de 3 dias, atividade hoje ou conta nova: sem pausa", () => {
    expect(detectarPausa(["2026-11-11"], HOJE)).toBeNull(); // 2 dias
    expect(detectarPausa(["2026-11-01", HOJE], HOJE)).toBeNull();
    expect(detectarPausa([], HOJE)).toBeNull();
    expect(detectarPausa(["2026-12-01"], HOJE)).toBeNull(); // data futura não conta
  });
  it("pausa longa é limitada a 90 dias, mantendo os mais recentes", () => {
    const p = detectarPausa(["2026-01-01"], HOJE)!;
    expect(p.dias).toBeGreaterThan(90);
    expect(limitarPausa(p)).toEqual({ inicio: "2026-08-16", fim: "2026-11-13", dias: 90 });
  });
  it("data dentro de uma pausa marcada", () => {
    const pausas = [{ inicio: "2026-11-11", fim: "2026-11-13" }];
    expect(emPausa("2026-11-12", pausas)).toBe(true);
    expect(emPausa("2026-11-14", pausas)).toBe(false);
  });
});

import { calendarioDoMes } from "@/lib/treino";
describe("calendário com pausa", () => {
  it("dia planejado e passado dentro da pausa vira 'pausa'; fora dela continua 'sem registro'", () => {
    const pausas = [{ inicio: "2026-11-10", fim: "2026-11-12" }];
    const dias = calendarioDoMes(2026, 11, HOJE, [], () => true, (d) => emPausa(d, pausas));
    const st = (d: string) => dias.find((x) => x.data === d)!.status;
    expect(st("2026-11-11")).toBe("pausa");
    expect(st("2026-11-09")).toBe("sem_registro");
    expect(st("2026-11-20")).toBe("planejado");
    // treino feito dentro da pausa continua contando como feito
    const comSessao = calendarioDoMes(2026, 11, HOJE, [{ data: "2026-11-11", status: "feito", motivo: null }], () => true, (d) => emPausa(d, pausas));
    expect(comSessao.find((x) => x.data === "2026-11-11")!.status).toBe("feito");
  });
});

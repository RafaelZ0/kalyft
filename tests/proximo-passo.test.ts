import { describe, expect, it } from "vitest";
import { fraseDoResultado, lacunasDaSemana, leiturasDaSemana, medirPasso, sugerirPassos, textoDoPasso, type DadosDaSemana, type Passo } from "@/lib/proximo-passo";
import type { RelatorioSemanal } from "@/lib/relatorio";

const rel = (extra: Partial<RelatorioSemanal> = {}): RelatorioSemanal => ({
  inicio: "2026-11-09", fim: "2026-11-15", parcial: false,
  calorias: { media: 1900, dias: 5, meta: 2000, difMedia: -100 },
  proteina: { media: 110, meta: 140, difMedia: -30 },
  treino: { feitos: 2, faltas: 1, planejados: 4 },
  peso: { inicioKg: 90, fimKg: 89.6, variacaoKg: -0.4, pesagens: 3 },
  gasto: { valor: 2400, minimo: 2300, maximo: 2500, metodo: "adaptativo" },
  ritmoRealKgSemana: 0.4, ritmoPrevistoKgSemana: 0.45, passos: { media: null, dias: 0 }, avisos: [],
  ...extra,
});
const dados = (extra: Partial<DadosDaSemana> = {}): DadosDaSemana => ({
  diasComRegistro: 5, diasPorRefeicao: { cafe: 5, almoco: 5, jantar: 3 }, pesagens: 3, treinosFeitos: 2, diasProteinaNaMeta: 1, diasAguaNaMeta: 2, ...extra,
});

describe("leituras e lacunas", () => {
  it("frases só com o que os números permitem", () => {
    const l = leiturasDaSemana(rel());
    expect(l[0]).toContain("perto da sua referência");
    expect(l.join(" ")).toContain("30 g abaixo da meta");
    expect(l.join(" ")).toContain("2 treinos feitos de 4 planejados");
    expect(l.join(" ")).toContain("caiu 0,4 kg");
    expect(l.join(" ")).not.toContain("diferente do que o consumo"); // ritmos próximos
  });
  it("avisa quando o peso anda diferente do consumo, sem acusar", () => {
    expect(leiturasDaSemana(rel({ ritmoRealKgSemana: -0.2, ritmoPrevistoKgSemana: 0.6 })).join(" ")).toContain("andou diferente");
  });
  it("sem dados, não inventa leituras e explica as lacunas", () => {
    const vazio = rel({ calorias: { media: null, dias: 0, meta: null, difMedia: null }, proteina: { media: null, meta: null, difMedia: null }, treino: { feitos: 0, faltas: 0, planejados: null }, peso: { inicioKg: null, fimKg: null, variacaoKg: null, pesagens: 0 }, gasto: null, ritmoRealKgSemana: null, ritmoPrevistoKgSemana: null, parcial: true });
    expect(leiturasDaSemana(vazio)).toEqual([]);
    const lac = lacunasDaSemana(vazio);
    expect(lac).toHaveLength(5);
    expect(lac.join(" ")).toContain("não dá para falar da alimentação");
  });
});

describe("sugestões de próximo passo", () => {
  it("parte das lacunas, com alvos alcançáveis e no máximo 4", () => {
    const s = sugerirPassos(rel(), dados(), { proteina: true, agua: true });
    expect(s.length).toBeLessThanOrEqual(4);
    expect(s.map((p) => p.tipo)).toEqual(["proteina_dias", "treinos", "agua_dias", "refeicao_dias"]);
    expect(s.find((p) => p.tipo === "proteina_dias")!.alvo).toBe(3);
    expect(s.find((p) => p.tipo === "treinos")!.alvo).toBe(3); // feitos + 1, até o planejado
    expect(s.find((p) => p.tipo === "refeicao_dias")).toMatchObject({ refeicao: "jantar", alvo: 5 });
  });
  it("pouco registro e poucas pesagens vêm primeiro", () => {
    const s = sugerirPassos(rel(), dados({ diasComRegistro: 2, pesagens: 0 }), { proteina: false, agua: false });
    expect(s.slice(0, 2)).toEqual([
      { tipo: "registrar_dias", alvo: 4, refeicao: null, texto: null },
      { tipo: "pesar_dias", alvo: 3, refeicao: null, texto: null },
    ]);
  });
  it("sem meta, não sugere proteína nem água; alvo nunca passa de 7", () => {
    const s = sugerirPassos(rel({ treino: { feitos: 0, faltas: 0, planejados: 9 } }), dados({ diasComRegistro: 6 }), { proteina: false, agua: false });
    expect(s.some((p) => p.tipo === "proteina_dias" || p.tipo === "agua_dias")).toBe(false);
    for (const p of s) expect(p.alvo!).toBeLessThanOrEqual(7);
  });
  it("tudo em dia ainda oferece um passo de manutenção", () => {
    const s = sugerirPassos(rel({ treino: { feitos: 4, faltas: 0, planejados: 4 } }), dados({ diasComRegistro: 7, diasPorRefeicao: { cafe: 7, almoco: 7, jantar: 7 }, pesagens: 5, treinosFeitos: 4, diasProteinaNaMeta: 6, diasAguaNaMeta: 6 }), { proteina: true, agua: true });
    expect(s).toEqual([{ tipo: "registrar_dias", alvo: 7, refeicao: null, texto: null }]);
  });
  it("nenhuma sugestão fala em comer menos ou perder peso", () => {
    const todas = sugerirPassos(rel(), dados({ diasComRegistro: 1, pesagens: 0 }), { proteina: true, agua: true }).map(textoDoPasso).join(" ").toLowerCase();
    for (const proibido of ["menos", "perder", "cortar", "déficit", "deficit"]) expect(todas).not.toContain(proibido);
  });
});

describe("medição do passo", () => {
  const p = (tipo: Passo["tipo"], alvo: number | null, refeicao: Passo["refeicao"] = null): Passo => ({ tipo, alvo, refeicao, texto: null });
  it("conta pelos dados da semana", () => {
    expect(medirPasso(p("registrar_dias", 5), dados())).toEqual({ feito: 5, alvo: 5, concluido: true });
    expect(medirPasso(p("refeicao_dias", 5, "jantar"), dados())).toEqual({ feito: 3, alvo: 5, concluido: false });
    expect(medirPasso(p("treinos", 3), dados())).toEqual({ feito: 2, alvo: 3, concluido: false });
  });
  it("passo livre ou sem meta para medir: só aparece", () => {
    expect(medirPasso({ tipo: "livre", alvo: null, refeicao: null, texto: "Caminhar no sábado" }, dados())).toBeNull();
    expect(medirPasso(p("proteina_dias", 3), dados({ diasProteinaNaMeta: null }))).toBeNull();
  });
  it("frases sem cobrança", () => {
    expect(fraseDoResultado({ feito: 5, alvo: 5, concluido: true }, true)).toBe("5 de 5. Passo cumprido.");
    expect(fraseDoResultado({ feito: 2, alvo: 5, concluido: false }, false)).toBe("2 de 5 até agora.");
    expect(fraseDoResultado({ feito: 3, alvo: 5, concluido: false }, true)).toBe("3 de 5. Bom avanço.");
    expect(fraseDoResultado({ feito: 0, alvo: 5, concluido: false }, true)).toContain("Tudo bem");
  });
  it("textos dos passos", () => {
    expect(textoDoPasso(p("refeicao_dias", 1, "jantar"))).toBe("Registrar o jantar em 1 dia");
    expect(textoDoPasso(p("treinos", 3))).toBe("Fazer 3 treinos");
  });
});

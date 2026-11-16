import { describe, expect, it } from "vitest";
import { escalaBonita, passoBonito } from "@/lib/grafico-escala";

describe("escala do gráfico", () => {
  it("passo redondo", () => {
    expect(passoBonito(4.3)).toBe(2);
    expect(passoBonito(1700)).toBe(500);
    expect(passoBonito(0.9)).toBe(0.25);
    expect(passoBonito(0)).toBe(1);
  });
  it("peso: marcas redondas que contêm os dados", () => {
    const e = escalaBonita(88.37, 92.1);
    expect(e.marcas).toEqual([88, 89, 90, 91, 92, 93]);
    expect(e.min).toBeLessThanOrEqual(88.37);
    expect(e.max).toBeGreaterThanOrEqual(92.1);
  });
  it("barras começam em zero", () => {
    expect(escalaBonita(1200, 2650, { zero: true }).marcas).toEqual([0, 1000, 2000, 3000]);
    expect(escalaBonita(0, 3, { zero: true }).marcas).toEqual([0, 1, 2, 3]);
  });
  it("valores iguais ganham folga e não quebram", () => {
    const e = escalaBonita(80, 80);
    expect(e.min).toBeLessThan(80);
    expect(e.max).toBeGreaterThan(80);
    expect(escalaBonita(0, 0, { zero: true }).marcas.length).toBeGreaterThan(1);
  });
  it("sem erro de ponto flutuante nas marcas", () => {
    for (const m of escalaBonita(0.1, 0.7).marcas) expect(String(m).length).toBeLessThan(6);
  });
});

import { escalaComReferencia, indiceMaisPerto, marcasEixoX, rotuloEixoX } from "@/lib/grafico-escala";

describe("escalaComReferencia", () => {
  it("meta longe dos dados não entra no desenho (não esmaga a variação)", () => {
    const { escala, referenciaNoDesenho } = escalaComReferencia([150.2, 152.1, 151.3, 153.8], 95);
    expect(referenciaNoDesenho).toBe(false);
    expect(escala.min).toBeGreaterThanOrEqual(148);
    expect(escala.max).toBeLessThanOrEqual(156);
    expect(escala.marcas.length).toBeGreaterThanOrEqual(2);
  });
  it("meta perto dos dados entra e a escala a contém", () => {
    const { escala, referenciaNoDesenho } = escalaComReferencia([82, 83.5, 84], 80);
    expect(referenciaNoDesenho).toBe(true);
    expect(escala.min).toBeLessThanOrEqual(80);
  });
  it("sem referência, com folga: os dados nunca encostam na borda", () => {
    const { escala } = escalaComReferencia([100, 110], null);
    expect(escala.min).toBeLessThan(100);
    expect(escala.max).toBeGreaterThan(110);
  });
  it("barras começam em zero e incluem a linha de referência próxima", () => {
    const { escala, referenciaNoDesenho } = escalaComReferencia([1800, 2100, 2500], 2300, { zero: true });
    expect(escala.min).toBe(0);
    expect(referenciaNoDesenho).toBe(true);
    expect(escala.max).toBeGreaterThanOrEqual(2500);
  });
  it("valores iguais não quebram", () => {
    const { escala } = escalaComReferencia([70, 70], null);
    expect(escala.max).toBeGreaterThan(escala.min);
  });
});

describe("eixo X", () => {
  it("até 4 marcas, sempre em pontos reais, com o primeiro e o último", () => {
    expect(marcasEixoX([0, 3, 7, 10, 14, 20, 27])).toEqual([0, 10, 20, 27]);
    expect(marcasEixoX([0, 5, 9])).toEqual([0, 5, 9]);
    expect(marcasEixoX([4, 4, 4])).toEqual([4]);
  });
  it("ponto mais perto do toque", () => {
    expect(indiceMaisPerto([0, 3, 7, 10], 6)).toBe(2);
    expect(indiceMaisPerto([0, 3, 7, 10], -5)).toBe(0);
  });
  it("rótulos por data e por semana", () => {
    expect(rotuloEixoX({ tipo: "dias", inicio: "2026-10-24" }, 0)).toBe("24/10");
    expect(rotuloEixoX({ tipo: "dias", inicio: "2026-10-24" }, 23)).toBe("16/11");
    expect(rotuloEixoX({ tipo: "semanas" }, 0)).toBe("hoje");
    expect(rotuloEixoX({ tipo: "semanas" }, 6)).toBe("sem. 6");
  });
});

describe("escala sem folga negativa", () => {
  it("dados a partir de zero não mostram valores negativos no eixo", () => {
    const { escala } = escalaComReferencia([0, 0.4, 1.2, 2], null);
    expect(escala.min).toBe(0);
  });
});

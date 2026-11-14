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

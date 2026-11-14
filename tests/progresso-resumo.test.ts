import { describe, expect, it } from "vitest";
import { abaValida, resumirPeso } from "@/lib/progresso-resumo";

const t = (data: string, tendencia: number) => ({ data, tendencia });

describe("resumo do peso", () => {
  it("compara com a tendência de cerca de 30 dias antes", () => {
    const r = resumirPeso([t("2026-10-01", 90), t("2026-10-14", 89.4), t("2026-10-31", 88.2)], "2026-11-01", 80);
    expect(r.variacao30d).toBe(-1.8);
    expect(r.faltaParaMeta).toBe(8.2);
    expect(r.diasSemPesar).toBe(1);
  });
  it("escolhe o ponto mais perto de 30 dias dentro da janela de 21 a 45 dias", () => {
    const r = resumirPeso([t("2026-09-10", 95), t("2026-10-05", 91), t("2026-10-08", 90.5), t("2026-11-05", 89)], "2026-11-05", null);
    expect(r.variacao30d).toBe(-2); // 05/10 (31 dias) está mais perto de 30 que 08/10 (28); 10/09 fica fora da janela
  });
  it("sem histórico suficiente não inventa variação", () => {
    expect(resumirPeso([t("2026-11-01", 80), t("2026-11-05", 79.8)], "2026-11-06", null)).toEqual({ variacao30d: null, faltaParaMeta: null, diasSemPesar: 1 });
    expect(resumirPeso([t("2026-07-01", 90), t("2026-11-05", 80)], "2026-11-05", null).variacao30d).toBeNull();
    expect(resumirPeso([], "2026-11-05", 70)).toEqual({ variacao30d: null, faltaParaMeta: null, diasSemPesar: null });
  });
  it("meta abaixo do peso atual dá valor negativo", () => {
    expect(resumirPeso([t("2026-11-05", 68)], "2026-11-05", 70).faltaParaMeta).toBe(-2);
  });
});

describe("aba do gráfico", () => {
  it("aceita só abas conhecidas", () => {
    expect(abaValida("proteina")).toBe("proteina");
    expect(abaValida("<script>")).toBe("peso");
    expect(abaValida(["calorias"])).toBe("peso");
    expect(abaValida(undefined)).toBe("peso");
  });
});

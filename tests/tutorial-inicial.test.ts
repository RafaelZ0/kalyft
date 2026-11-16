import { describe, expect, it } from "vitest";
import { lerTutorial, passosPara, tutorialSchema, vizinhos } from "@/lib/tutorial-inicial";

describe("roteiro do passeio", () => {
  it("adapta-se à área: comida, treino, ambos e sem jornada", () => {
    expect(passosPara("comida").map((p) => p.id)).toEqual(["hoje", "comida", "progresso", "conta"]);
    expect(passosPara("treino").map((p) => p.id)).toEqual(["hoje", "treino", "progresso", "conta"]);
    expect(passosPara("ambos").map((p) => p.id)).toEqual(["hoje", "comida", "treino", "progresso", "conta"]);
    expect(passosPara(undefined).map((p) => p.id)).toEqual(["hoje", "comida", "treino", "progresso", "conta"]);
  });
  it("só rotas reais do app; Conta é a quinta aba (sem aba de Ajuda inventada)", () => {
    expect(passosPara("ambos").map((p) => p.rota)).toEqual(["/hoje", "/comida", "/treino", "/progresso", "/ajustes"]);
  });
  it("vizinhos: primeiro sem anterior, último sem próximo; id desconhecido volta ao início", () => {
    const p = passosPara("comida");
    expect(vizinhos(p, "hoje")).toMatchObject({ indice: 0, anterior: null, proximo: { id: "comida" } });
    expect(vizinhos(p, "conta")).toMatchObject({ indice: 3, anterior: { id: "progresso" }, proximo: null });
    expect(vizinhos(p, "treino").indice).toBe(0);
  });
});

describe("estado guardado", () => {
  it("passo só quando em andamento; nada de campos extras", () => {
    expect(tutorialSchema.safeParse({ estado: "em_andamento", passo: "hoje" }).success).toBe(true);
    expect(tutorialSchema.safeParse({ estado: "em_andamento" }).success).toBe(false);
    expect(tutorialSchema.safeParse({ estado: "pulado", passo: "hoje" }).success).toBe(false);
    expect(tutorialSchema.safeParse({ estado: "concluido", premio: 10 }).success).toBe(false);
    expect(tutorialSchema.safeParse({ estado: "em_andamento", passo: "ajuda" }).success).toBe(false);
  });
  it("estado inesperado vira 'não iniciado' sem quebrar", () => {
    expect(lerTutorial({ estado: "assistido" })).toEqual({ estado: "nao_iniciado" });
    expect(lerTutorial(null)).toEqual({ estado: "nao_iniciado" });
    expect(lerTutorial({ estado: "pulado" })).toEqual({ estado: "pulado" });
  });
});

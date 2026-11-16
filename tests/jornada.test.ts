import { describe, expect, it } from "vitest";
import {
  aplicarRespostas,
  etapaAnterior,
  etapaDisponivel,
  etapaSeguinte,
  etapasAplicaveis,
  ETAPAS_PULAVEIS,
  type Rascunho,
} from "@/lib/jornada";

const comida: Rascunho = { foco: { area: "comida" } };
const treino: Rascunho = { foco: { area: "treino" } };
const ambos: Rascunho = { foco: { area: "ambos", primeira: "treino" } };

describe("etapas aplicáveis por caminho", () => {
  it("alimentação, treino e ambos", () => {
    expect(etapasAplicaveis(comida)).toEqual(["foco", "perfil", "objetivo", "rotina", "atividade", "alimentacao", "revisao", "inicio"]);
    expect(etapasAplicaveis(treino)).toEqual(["foco", "perfil", "objetivo", "rotina", "atividade", "treino", "revisao", "inicio"]);
    expect(etapasAplicaveis(ambos)).toEqual(["foco", "perfil", "objetivo", "rotina", "atividade", "treino", "alimentacao", "revisao", "inicio"]);
  });
  it("sem foco escolhido, só o caminho comum", () => {
    expect(etapasAplicaveis({})).toEqual(["foco", "perfil", "objetivo", "rotina", "atividade", "revisao", "inicio"]);
  });
  it("seguinte e anterior respeitam o caminho", () => {
    expect(etapaSeguinte(comida, "atividade")).toBe("alimentacao");
    expect(etapaSeguinte(treino, "atividade")).toBe("treino");
    expect(etapaSeguinte(ambos, "treino")).toBe("alimentacao");
    expect(etapaSeguinte(comida, "inicio")).toBe("inicio");
    expect(etapaAnterior(comida, "revisao")).toBe("alimentacao");
    expect(etapaAnterior(comida, "foco")).toBe("foco");
  });
  it("etapa fora do caminho não está disponível; nada além de foco antes de escolher o foco", () => {
    expect(etapaDisponivel(comida, "treino")).toBe(false);
    expect(etapaDisponivel(comida, "alimentacao")).toBe(true);
    expect(etapaDisponivel({}, "perfil")).toBe(false);
    expect(etapaDisponivel({}, "foco")).toBe(true);
  });
  it("revisão só depois de foco e objetivo", () => {
    expect(etapaDisponivel(comida, "revisao")).toBe(false);
    expect(etapaDisponivel({ ...comida, objetivo: { objetivo: "organizar" } }, "revisao")).toBe(true);
  });
  it("etapas que aceitam 'Agora não'", () => {
    expect([...ETAPAS_PULAVEIS]).toEqual(["perfil", "rotina", "atividade", "treino", "alimentacao"]);
  });
});

describe("aplicar respostas", () => {
  it("guarda a etapa sem mexer nas outras e não inventa valores", () => {
    const r = aplicarRespostas(comida, "perfil", { alturaCm: 172 });
    expect(r).toEqual({ foco: { area: "comida" }, perfil: { alturaCm: 172 } });
  });
  it("'Agora não' fica registrado como etapa vazia (pulada), diferente de não visitada", () => {
    const r = aplicarRespostas(comida, "rotina", {});
    expect(r.rotina).toEqual({});
    expect(r.atividade).toBeUndefined();
  });
  it("trocar a área remove as respostas da área que saiu do caminho", () => {
    const base: Rascunho = { ...ambos, treino: { diasSemana: ["seg"] }, alimentacao: { refeicoesPorDia: 4 } };
    expect(aplicarRespostas(base, "foco", { area: "comida" })).toEqual({ foco: { area: "comida" }, alimentacao: { refeicoesPorDia: 4 } });
    expect(aplicarRespostas(base, "foco", { area: "treino" })).toEqual({ foco: { area: "treino" }, treino: { diasSemana: ["seg"] } });
  });
  it("revisão e início não guardam respostas", () => {
    expect(aplicarRespostas(comida, "revisao", {})).toEqual(comida);
  });
  it("não altera o objeto original", () => {
    const original: Rascunho = { foco: { area: "ambos", primeira: "comida" }, treino: { minutosSessao: 30 } };
    const copia = structuredClone(original);
    aplicarRespostas(original, "foco", { area: "comida" });
    expect(original).toEqual(copia);
  });
});

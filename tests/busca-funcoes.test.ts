import { describe, expect, it } from "vitest";
import { buscarFuncoes, FUNCOES, funcoesDisponiveis, termoValido, type ContextoBusca } from "@/lib/busca-funcoes";

const proprio = { modo: "proprio" as const, admin: false };
const admin = { modo: "proprio" as const, admin: true };
const acompanhando = { modo: "acompanhamento" as const, admin: false };
const ids = (termo: string, ctx: ContextoBusca = proprio) => buscarFuncoes(termo, ctx).map((f) => f.id);

describe("busca de funções", () => {
  it("acha pelo título, sem acento e sem diferenciar maiúsculas", () => {
    expect(ids("peso")[0]).toBe("registrar-peso");
    expect(ids("AGUA")[0]).toBe("agua");
    expect(ids("exercício")[0]).toBe("exercicios");
  });
  it("acha por sinônimos e ignora palavras vazias", () => {
    expect(ids("quero me pesar")).toContain("registrar-peso");
    expect(ids("código de barras")[0]).toBe("barras");
    expect(ids("ozempic")).toEqual(["aplicacao"]);
    expect(ids("modo escuro")).toEqual(["conta"]);
    expect(ids("faltei")).toEqual(["falta"]);
  });
  it("aceita começo de palavra e exige todas as palavras", () => {
    expect(ids("rece")).toContain("receitas");
    expect(ids("foto prato")).toEqual(["comida-ia"]);
    expect(ids("xyzabc")).toEqual([]);
  });
  it("sem termo útil não devolve nada", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   de  o ")).toEqual([]);
  });
  it("esconde funções pessoais no acompanhamento e Alunos de quem não é administrador", () => {
    expect(ids("ozempic", acompanhando)).toEqual([]);
    expect(ids("passos", acompanhando)).toEqual([]);
    expect(ids("aluno", proprio)).toEqual([]);
    expect(ids("aluno", admin)).toEqual(["alunos"]);
    expect(funcoesDisponiveis({ modo: "acompanhamento", admin: true }).some((f) => f.id === "alunos")).toBe(false);
  });
  it("todas as funções têm destino interno e ids únicos", () => {
    expect(new Set(FUNCOES.map((f) => f.id)).size).toBe(FUNCOES.length);
    for (const f of FUNCOES) expect(f.href.startsWith("/")).toBe(true);
    for (const f of FUNCOES) expect(f.href.startsWith("//")).toBe(false);
  });
});

describe("termo da URL", () => {
  it("limpa, corta e recusa o que não é texto", () => {
    expect(termoValido("  frango \n grelhado ")).toBe("frango grelhado");
    expect(termoValido("x".repeat(100))).toHaveLength(60);
    expect(termoValido(["a", "b"])).toBe("");
    expect(termoValido(undefined)).toBe("");
  });
});

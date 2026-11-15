import { describe, expect, it } from "vitest";
import { arredondarCompra, diasDaSemana, gramasPorPorcao, ingredientesDaReceita, ingredientesDaSalva, listaDeCompras, textoQuantidade, type Ingrediente } from "@/lib/planejamento";

const ing = (alimentoId: string, gramas: number, extra: Partial<Ingrediente> = {}): Ingrediente => ({ tipo: "base", alimentoId, nome: alimentoId, grupo: "Cereais", gramas, ...extra });

describe("porções", () => {
  it("receita: proporção pelo rendimento", () => {
    const r = ingredientesDaReceita([ing("arroz", 400), ing("feijao", 300)], 4, 2);
    expect(r.map((i) => i.gramas)).toEqual([200, 150]);
    expect(ingredientesDaReceita([ing("arroz", 400)], 0, 2)).toEqual([]);
  });
  it("refeição salva: multiplica pelas vezes", () => {
    expect(ingredientesDaSalva([ing("pao", 50)], 3)[0].gramas).toBe(150);
  });
  it("gramas por porção da receita", () => {
    expect(gramasPorPorcao(1200, 4)).toBe(300);
    expect(gramasPorPorcao(0, 4)).toBeNull();
  });
});

describe("lista de compras", () => {
  it("soma o mesmo alimento de vários itens, arredonda para compra e ordena por grupo", () => {
    const l = listaDeCompras([
      { ingredientes: [ing("arroz", 120), ing("frango", 150, { grupo: "Carnes", nome: "Peito de frango" })] },
      { ingredientes: [ing("arroz", 121), ing("frango", 150, { grupo: "Carnes", nome: "Peito de frango" })] },
      { ingredientes: [ing("banana", 90, { grupo: "Frutas", nome: "Banana" })] },
    ]);
    expect(l).toEqual([
      { chave: "base:frango", nome: "Peito de frango", grupo: "Carnes", gramas: 300 },
      { chave: "base:arroz", nome: "arroz", grupo: "Cereais", gramas: 250 },
      { chave: "base:banana", nome: "Banana", grupo: "Frutas", gramas: 90 },
    ]);
  });
  it("alimento do usuário e da tabela com o mesmo id não se misturam; sem grupo vai para o fim; zero some", () => {
    const l = listaDeCompras([{ ingredientes: [ing("x", 10), ing("x", 10, { tipo: "usuario", grupo: null }), ing("y", 0)] }]);
    expect(l.map((i) => i.chave)).toEqual(["base:x", "usuario:x"]);
  });
  it("arredondamento amigável e texto", () => {
    expect([arredondarCompra(3), arredondarCompra(101), arredondarCompra(1001), arredondarCompra(0)]).toEqual([5, 110, 1050, 0]);
    expect(textoQuantidade(350)).toBe("350 g");
    expect(textoQuantidade(1250)).toBe("1,25 kg");
  });
});

describe("semana", () => {
  it("7 dias de segunda a domingo", () => {
    expect(diasDaSemana("2026-11-09")).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  });
});

import { dataPlanejavel, semanaDoPlanejamento } from "@/lib/planejamento";
describe("janela de semanas", () => {
  const HOJE = "2026-11-15"; // domingo; semana começa em 09/11
  it("normaliza para a segunda e respeita a janela", () => {
    expect(semanaDoPlanejamento(undefined, HOJE)).toBe("2026-11-09");
    expect(semanaDoPlanejamento("2026-11-19", HOJE)).toBe("2026-11-16");
    expect(semanaDoPlanejamento("2026-12-07", HOJE)).toBe("2026-12-07"); // +4 semanas
    expect(semanaDoPlanejamento("2026-12-14", HOJE)).toBe("2026-11-09"); // +5: fora
    expect(semanaDoPlanejamento("2026-09-14", HOJE)).toBe("2026-09-14"); // −8
    expect(semanaDoPlanejamento("2026-09-07", HOJE)).toBe("2026-11-09"); // −9: fora
    expect(semanaDoPlanejamento("lixo", HOJE)).toBe("2026-11-09");
  });
  it("datas planejáveis", () => {
    expect(dataPlanejavel("2026-12-13", HOJE)).toBe(true);
    expect(dataPlanejavel("2026-12-14", HOJE)).toBe(false);
    expect(dataPlanejavel("2026-09-13", HOJE)).toBe(false);
    expect(dataPlanejavel("2026-13-01", HOJE)).toBe(false);
  });
});

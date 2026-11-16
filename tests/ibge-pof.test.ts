import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ajustarAoLimite, converterValor, extrairItens, nomeDoItem } from "../scripts/importar-ibge-pof.mjs";

describe("importação da tabela do IBGE (POF 2008-2009)", () => {
  it("convenção da publicação: '-' é zero; vazio é desconhecido; texto estranho é recusado", () => {
    expect(converterValor("-")).toEqual({ valor: 0, marca: "-" });
    expect(converterValor("")).toEqual({ valor: null, marca: "vazio" });
    expect(converterValor("344.855")).toEqual({ valor: 344.86, marca: null });
    expect(() => converterValor("abc")).toThrow();
    expect(() => converterValor("-3")).toThrow();
  });

  it("nome legível a partir da descrição e do preparo", () => {
    expect(nomeDoItem("BOLO DE CENOURA", "NAO SE APLICA")).toBe("Bolo de cenoura");
    expect(nomeDoItem("MILHO (EM GRAO)", "COZIDO(A)")).toBe("Milho (em grao), cozido(a)");
  });

  it("gordura pura acima do limite só por arredondamento é ajustada e o original fica registrado", () => {
    expect(ajustarAoLimite(902, 900)).toEqual({ valor: 900, original: 902 });
    expect(ajustarAoLimite(100.43, 100)).toEqual({ valor: 100, original: 100.43 });
    expect(ajustarAoLimite(950, 900)).toBeNull();
    expect(ajustarAoLimite(null, 900)).toEqual({ valor: null, original: null });
    expect(ajustarAoLimite(450, 900)).toEqual({ valor: 450, original: null });
  });

  it("arquivo transcrito: 1.971 itens válidos, códigos únicos, com bolo de cenoura e rosquinhas e a referência de cada um", () => {
    const { itens, erros } = extrairItens(readFileSync("dados/ibge-pof/composicao.csv", "utf8"));
    expect(erros).toEqual([]);
    expect(itens).toHaveLength(1971);
    expect(new Set(itens.map((i) => i.codigo)).size).toBe(1971);
    expect(itens.every((i) => i.kcal !== null && i.kcal >= 0 && i.kcal <= 900)).toBe(true);
    const bolo = itens.find((i) => i.nome === "Bolo de cenoura");
    expect(bolo?.referencia).toBe("NDSR (Univ. de Minnesota, EUA): Cake, carrot, homemade, without nuts, regular");
    const rosquinha = itens.find((i) => i.nome === "Rosquinha doce");
    expect(rosquinha?.referencia).toBe("TACO: Biscoito, doce, maisena");
    expect(rosquinha?.marcacoes.sodio_mg).toBeUndefined();
    const azeite = itens.find((i) => i.nome === "Azeite de oliva");
    expect(azeite?.gordura_g).toBe(100);
    expect(azeite?.marcacoes.gordura_g).toEqual({ marca: "limite", fonte: "ibge", ref: "100.43" });
  });

  it("linha inválida é recusada com o motivo, sem gravar nada", () => {
    const cab = "codigo_alimento;descricao;codigo_preparo;preparo;ref_codigo;ref_descricao;kcal;proteina_g;gordura_g;carbo_g;fibra_g;sodio_mg;sodio_adicao_mg";
    const { itens, erros } = extrairItens(`${cab}\n1234567;X;99;NAO SE APLICA;42;Y;100;1;1;1;1;1;-\n1234568;Z;99;NAO SE APLICA;2;W;1200;1;1;1;1;1;-`);
    expect(itens).toEqual([]);
    expect(erros[0]).toMatch(/referência desconhecida/);
    expect(erros[1]).toMatch(/kcal fora da faixa/);
  });
});

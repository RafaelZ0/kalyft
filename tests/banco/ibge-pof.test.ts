// Fase 10A: alimentos da tabela de composição do IBGE (POF 2008-2009), importados no branch de teste.
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { perfis } from "@/lib/db/schema";
import { buscarAlimentos, citacaoDaFonte, obterAlimento } from "@/lib/dal/alimentos";
import { garantirPerfil } from "@/lib/dal/perfil";
import { calcularNutrientes } from "@/lib/nutricao";

const A = randomUUID();

beforeAll(async () => {
  await garantirPerfil(A);
});
afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A]));
});

describe("busca com a tabela do IBGE", () => {
  it("encontra bolo de cenoura e rosquinha, identificados como IBGE", async () => {
    const bolo = await buscarAlimentos(A, "bolo de cenoura");
    expect(bolo[0]).toMatchObject({ tipo: "base", nome: "Bolo de cenoura", fonte: "ibge" });
    const rosq = await buscarAlimentos(A, "rosquinha");
    expect(rosq.map((r) => r.nome)).toEqual(expect.arrayContaining(["Rosquinha doce", "Rosquinha salgada"]));
    expect(rosq.filter((r) => r.nome.startsWith("Rosquinha")).every((r) => r.fonte === "ibge")).toBe(true);
  });

  it("alimentos da TACO continuam aparecendo e identificados como TACO", async () => {
    const r = await buscarAlimentos(A, "bolo pronto chocolate");
    expect(r[0]).toMatchObject({ nome: "Bolo, pronto, chocolate", fonte: "taco" });
  });

  it("detalhe traz a referência, o sódio de adição separado e a citação do IBGE", async () => {
    const [b] = await buscarAlimentos(A, "bolo de cenoura");
    const d = await obterAlimento(A, "base", b.id);
    expect(d?.fonte).toBe("ibge");
    expect(d?.referencia).toBe("NDSR (Univ. de Minnesota, EUA): Cake, carrot, homemade, without nuts, regular");
    expect(d?.kcal).toBeGreaterThan(0);
    const [arroz] = await buscarAlimentos(A, "arroz polido parboilizado");
    const da = await obterAlimento(A, "base", arroz.id);
    expect(da?.sodioAdicaoMg).toBeGreaterThan(0);
    expect(await citacaoDaFonte("ibge")).toMatch(/tabelas de composição nutricional dos alimentos consumidos no Brasil/);
    expect(await citacaoDaFonte("taco")).toMatch(/TACO/);
  });

  it("registro calcula pelas gramas como qualquer alimento da base", async () => {
    const [b] = await buscarAlimentos(A, "bolo de cenoura");
    const d = (await obterAlimento(A, "base", b.id))!;
    const n = calcularNutrientes(d, 50)!;
    expect(n.kcal).toBeCloseTo(d.kcal! / 2, 2);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { neon, neonConfig, type NeonQueryPromise } from "@neondatabase/serverless";
import { protegerClienteAcompanhamento } from "@/lib/db/cliente-acompanhamento";
import { executarNoContexto } from "@/lib/acompanhamento/execucao";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text } from "drizzle-orm/pg-core";

const contexto = { userId: "aluno", titularId: "aluno", atorId: "admin", contextoId: "ctx", modo: "acompanhamento" as const, podeEditar: true, podeVerFotos: false, edicaoAte: new Date(), nome: "Aluno", admin: null };
const resultado = (valor: string) => ({ fields: [{ name: "valor", dataTypeID: 25 }], rows: [[valor]], command: "SELECT", rowCount: 1 });
afterEach(() => { neonConfig.fetchFunction = undefined; });

function preparar(negar = false) {
  const chamadas: Array<{ query?: string; queries?: Array<{ query: string; params: unknown[] }> }> = [];
  neonConfig.fetchFunction = vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    chamadas.push(body);
    if (negar) return new Response(JSON.stringify({ message: "A autorização de edição terminou.", code: "42501" }), { status: 400 });
    return Response.json(body.queries ? { results: body.queries.map((_: unknown, i: number) => resultado(String(i))) } : resultado("pessoal"));
  });
  return { cliente: protegerClienteAcompanhamento(neon<boolean, boolean>("postgresql://app:segredo@example.neon.tech/db")), chamadas };
}

describe("driver HTTP acompanhado", () => {
  it("mantém conta própria sem validação extra", async () => {
    const { cliente, chamadas } = preparar();
    expect(await cliente.query("select $1", ["valor"])).toEqual([{ valor: "pessoal" }]);
    expect(chamadas[0].queries).toBeUndefined();
  });
  it("preserva lazy queries e valida antes da execução, mantendo opções", async () => {
    const { cliente, chamadas } = preparar();
    await executarNoContexto(contexto, "hash", "salvar", async () => {
      const query = cliente.query("update alimento set nome=$1", ["novo"], { fullResults: true, arrayMode: true });
      expect(chamadas).toHaveLength(0);
      const resposta = await query;
      expect(resposta.rows).toEqual([["1"]]);
      expect(resposta.rowAsArray).toBe(true);
    });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].queries?.map((q) => q.query)).toEqual([expect.stringContaining("acompanhamento_validar"), "update alimento set nome=$1"]);
    expect(chamadas[0].queries?.[0].params).toEqual(["ctx", "admin", "aluno", "hash", "salvar"]);
  });
  it("agrupa batch com uma validação sem executar cada promise", async () => {
    const { cliente, chamadas } = preparar();
    await executarNoContexto(contexto, "hash", "salvar", async () => {
      const a = cliente.query("update a", [], { fullResults: true, arrayMode: false });
      const b = cliente.query("delete b", [], { fullResults: true, arrayMode: true });
      expect(chamadas).toHaveLength(0);
      const respostas = await cliente.transaction([a, b] as unknown as NeonQueryPromise<boolean, boolean>[], { fullResults: true });
      expect(respostas[0].rows).toEqual([{ valor: "1" }]);
      expect(respostas[1].rows).toEqual([["2"]]);
    });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].queries).toHaveLength(3);
  });
  it("repassa negação transacional sem tentar gravar fora da transação", async () => {
    const { cliente, chamadas } = preparar(true);
    await expect(executarNoContexto(contexto, "hash", "salvar", () => cliente.query("update a"))).rejects.toThrow("A autorização de edição terminou.");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].queries).toHaveLength(2);
  });
  it("preserva o mapeamento e a ordem de db.batch do Drizzle instalado", async () => {
    const { cliente, chamadas } = preparar();
    const tabela = pgTable("teste_driver", { valor: text("valor") });
    const db = drizzle(cliente);
    await executarNoContexto(contexto, "hash", "salvar", async () => {
      const resultados = await db.batch([
        db.insert(tabela).values({ valor: "novo" }).returning(),
        db.select().from(tabela),
      ]);
      expect(resultados).toEqual([[{ valor: "1" }], [{ valor: "2" }]]);
    });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].queries).toHaveLength(3);
  });
});

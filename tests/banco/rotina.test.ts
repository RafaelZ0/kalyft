// Fase 9A: minha rotina e retomar de hoje, contra o banco de teste.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createElement } from "react";
import { prerender } from "react-dom/static";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const sessao = { userId: A, admin: null };
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao, obterVinculoSessao: async () => "0".repeat(64) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); },
  usePathname: () => "/hoje",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { db } from "@/lib/db";
import { acessos, acompanhamentoEventos, alimentosUsuario, pausas, perfis, registrosAlimentares, rotinaOcultos } from "@/lib/db/schema";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { criarContexto, decidirAutorizacao, solicitarAutorizacao } from "@/lib/dal/acompanhamento";
import { pausasNoPeriodo, ultimaAtividade } from "@/lib/dal/pausas";
import { garantirPerfil } from "@/lib/dal/perfil";
import { criarRegistros } from "@/lib/dal/registros";
import { historicoDaRotina, listarOcultos, ocultosDaRotina } from "@/lib/dal/rotina";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { itensHabituais } from "@/lib/rotina";
import { marcarPausaAcao, ocultarDaRotinaAcao, reexibirNaRotinaAcao, registrarDaRotina } from "@/app/(app)/hoje/actions";
import PaginaHoje from "@/app/(app)/hoje/page";

const HOJE = hojeSaoPaulo();
let iogurte: string;
let alimentoDeB: string;

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  f.set("contextoId", "proprio");
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};
const nutr = { kcal: 120, proteinaG: 8, carboG: 10, gorduraG: 5, fibraG: 0 };

async function html(searchParams: Record<string, string> = {}): Promise<string> {
  const arvore = await PaginaHoje({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) } as never);
  const { prelude } = await prerender(createElement("div", null, arvore));
  return new Response(prelude).text();
}

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  iogurte = await criarAlimentoUsuario(A, { nome: "Iogurte natural da casa", marca: null, kcal: 60, proteinaG: 4, carboG: 5, gorduraG: 3, fibraG: 0, sodioMg: 50 });
  alimentoDeB = await criarAlimentoUsuario(B, { nome: "Alimento só do B", marca: null, kcal: 100, proteinaG: 1, carboG: 1, gorduraG: 1, fibraG: 0, sodioMg: 0 });
  // iogurte no café em 4 dias diferentes (com porções 150/170/170/200 → mediana 170), há 6 a 9 dias
  await criarRegistros(A, [6, 7, 8, 9].map((d, i) => ({
    data: somarDias(HOJE, -d), refeicao: "cafe" as const, tipo: "usuario" as const, alimentoId: iogurte, nome: "Iogurte natural da casa",
    gramas: [150, 170, 170, 200][i], medidaTexto: null, nutrientes: nutr,
  })));
}, 120_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

describe("minha rotina", () => {
  it("o hábito sai do histórico dos últimos 30 dias, com a porção mediana", async () => {
    const itens = itensHabituais(await historicoDaRotina(A, HOJE), "cafe", { hoje: HOJE, ocultos: await ocultosDaRotina(A) });
    expect(itens).toEqual([{ tipo: "usuario", alimentoId: iogurte, nome: "Iogurte natural da casa", gramas: 170, dias: 4 }]);
    expect(await historicoDaRotina(B, HOJE)).toEqual([]); // nada vaza entre usuários
  });

  it("registrar da rotina recalcula os nutrientes do banco (snapshot) e grava hoje", async () => {
    const r = await registrarDaRotina({}, form({ tipo: "usuario", alimentoId: iogurte, refeicao: "cafe", gramas: "250" }));
    expect(r.ok).toContain("registrado");
    const [reg] = await db.select().from(registrosAlimentares).where(and(eq(registrosAlimentares.userId, A), eq(registrosAlimentares.data, HOJE)));
    expect(reg.refeicao).toBe("cafe");
    expect(Number(reg.gramas)).toBe(250);
    expect(Number(reg.kcal)).toBe(150); // 60 kcal/100 g × 250 g, do cadastro (o histórico tinha 120 kcal por item)
    expect(Number(reg.proteinaG)).toBe(10);
    // depois de registrado hoje, some da rotina do café
    expect(itensHabituais(await historicoDaRotina(A, HOJE), "cafe", { hoje: HOJE })).toEqual([]);
  });

  it("recusa alimento de outra pessoa, porção inválida e refeição inexistente, sem gravar", async () => {
    const antes = (await db.select().from(registrosAlimentares).where(eq(registrosAlimentares.userId, A))).length;
    expect((await registrarDaRotina({}, form({ tipo: "usuario", alimentoId: alimentoDeB, refeicao: "cafe", gramas: "100" }))).erro).toBeDefined();
    expect((await registrarDaRotina({}, form({ tipo: "usuario", alimentoId: iogurte, refeicao: "cafe", gramas: "0" }))).erro).toBeDefined();
    expect((await registrarDaRotina({}, form({ tipo: "usuario", alimentoId: iogurte, refeicao: "cafe", gramas: "99999" }))).erro).toBeDefined();
    expect((await registrarDaRotina({}, form({ tipo: "usuario", alimentoId: iogurte, refeicao: "brunch", gramas: "100" }))).erro).toBeDefined();
    expect((await registrarDaRotina({}, form({ tipo: "usuario", alimentoId: "não-uuid", refeicao: "cafe", gramas: "100" }))).erro).toBeDefined();
    expect((await db.select().from(registrosAlimentares).where(eq(registrosAlimentares.userId, A))).length).toBe(antes);
  });

  it("ocultar esconde só naquela refeição; repetir não duplica; reexibir volta", async () => {
    await ocultarDaRotinaAcao(form({ tipo: "usuario", alimentoId: iogurte, refeicao: "cafe" }));
    await ocultarDaRotinaAcao(form({ tipo: "usuario", alimentoId: iogurte, refeicao: "cafe" }));
    const ocultos = await listarOcultos(A);
    expect(ocultos).toEqual([{ id: ocultos[0].id, refeicao: "cafe", nome: "Iogurte natural da casa" }]);
    expect(await listarOcultos(B)).toEqual([]);
    // ocultar alimento de outra pessoa: o banco recusa (chave composta), a action não quebra
    await ocultarDaRotinaAcao(form({ tipo: "usuario", alimentoId: alimentoDeB, refeicao: "cafe" }));
    expect(await listarOcultos(A)).toHaveLength(1);
    // B não consegue reexibir o item de A
    sessao.userId = B;
    await reexibirNaRotinaAcao(form({ id: ocultos[0].id }));
    sessao.userId = A;
    expect(await listarOcultos(A)).toHaveLength(1);
    await reexibirNaRotinaAcao(form({ id: ocultos[0].id }));
    expect(await listarOcultos(A)).toEqual([]);
  });

  it("o banco recusa oculto sem alimento ou com refeição inválida", async () => {
    await expect(db.insert(rotinaOcultos).values({ userId: A, refeicao: "cafe" })).rejects.toThrow();
    await expect(db.insert(rotinaOcultos).values({ userId: A, refeicao: "brunch", alimentoUsuarioId: iogurte })).rejects.toThrow();
  });

  it("apagar o alimento leva junto o item oculto", async () => {
    const temp = await criarAlimentoUsuario(A, { nome: "Temporário", marca: null, kcal: 10, proteinaG: 0, carboG: 0, gorduraG: 0, fibraG: 0, sodioMg: 0 });
    await ocultarDaRotinaAcao(form({ tipo: "usuario", alimentoId: temp, refeicao: "jantar" }));
    expect(await listarOcultos(A)).toHaveLength(1);
    await db.delete(alimentosUsuario).where(eq(alimentosUsuario.id, temp));
    expect(await listarOcultos(A)).toEqual([]);
  });
});

describe("retomar de hoje", () => {
  it("última atividade considera refeição e pesagem, só até hoje", async () => {
    expect(await ultimaAtividade(A, HOJE)).toBe(HOJE); // registrou da rotina hoje
    expect(await ultimaAtividade(B, HOJE)).toBeNull();
  });

  it("Hoje mostra o cartão de retomar depois da pausa e marcar pausa grava o período certo", async () => {
    await db.delete(registrosAlimentares).where(and(eq(registrosAlimentares.userId, A), eq(registrosAlimentares.data, HOJE)));
    expect(await ultimaAtividade(A, HOJE)).toBe(somarDias(HOJE, -6));
    const h = await html({ rotina: "cafe" });
    expect(h).toContain("Vamos retomar de onde você está");
    expect(h).toContain("como pausa");
    expect(h).toContain("Iogurte natural da casa"); // e a rotina aparece no café
    // o cliente não manda datas: a action recalcula a pausa no servidor
    const f = form({ inicio: "2000-01-01", fim: "2099-01-01" });
    await marcarPausaAcao(f);
    await marcarPausaAcao(f); // repetir não duplica
    const ps = await pausasNoPeriodo(A, "2000-01-01", HOJE);
    expect(ps).toEqual([{ inicio: somarDias(HOJE, -5), fim: somarDias(HOJE, -1) }]);
    expect(await html()).toContain("marcados como pausa");
    expect(await pausasNoPeriodo(B, "2000-01-01", HOJE)).toEqual([]);
  });

  it("sem pausa (conta nova), marcar não grava nada", async () => {
    sessao.userId = B;
    await marcarPausaAcao(form({}));
    sessao.userId = A;
    expect(await db.select().from(pausas).where(eq(pausas.userId, B))).toEqual([]);
  });

  it("o banco recusa pausa invertida ou maior que 90 dias", async () => {
    await expect(db.insert(pausas).values({ userId: A, inicio: "2026-05-10", fim: "2026-05-01" })).rejects.toThrow();
    await expect(db.insert(pausas).values({ userId: A, inicio: "2026-01-01", fim: "2026-06-01" })).rejects.toThrow();
  });
});

describe("acompanhamento nas tabelas novas", () => {
  it("escrita de administrador autorizado é auditada; sem autorização é recusada", async () => {
    const admin = { userId: randomUUID(), __admin: true } as const;
    const emailsAntes = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "admin-9a@teste.invalid";
    await db.insert(perfis).values({ userId: admin.userId });
    await db.insert(acessos).values([
      { userId: admin.userId, email: "admin-9a@teste.invalid", status: "aprovado" },
      { userId: A, email: "a-9a@teste.invalid", status: "aprovado" },
    ]).onConflictDoNothing();
    const hash = "c".repeat(64);
    const ctx = await criarContexto(admin, A, hash);
    const validar = sql`select acompanhamento_validar(${ctx.id}::uuid, ${admin.userId}::uuid, ${A}::uuid, ${hash}, 'edicao')`;
    // sem autorização de edição: recusa
    await expect(db.batch([db.execute(validar), db.insert(pausas).values({ userId: A, inicio: "2026-01-01", fim: "2026-01-03" })])).rejects.toThrow();
    const pedido = await solicitarAutorizacao(admin, A, "edicao");
    await decidirAutorizacao(A, pedido, "aceitar", new Date(Date.now() + 60_000));
    await db.batch([db.execute(validar), db.insert(pausas).values({ userId: A, inicio: "2026-01-01", fim: "2026-01-03" })]);
    const eventos = await db.select().from(acompanhamentoEventos).where(eq(acompanhamentoEventos.alunoId, A));
    expect(eventos.some((e) => e.recurso === "pausas" && e.operacao === "INSERT" && e.atorId === admin.userId)).toBe(true);
    await db.delete(perfis).where(eq(perfis.userId, admin.userId));
    await db.delete(acessos).where(inArray(acessos.userId, [admin.userId, A]));
    process.env.ADMIN_EMAILS = emailsAntes;
  });
});

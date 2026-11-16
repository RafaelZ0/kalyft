// Fase 11B (2B): telas e Actions da jornada inicial, ponta a ponta no banco de teste.
const cookieAcompanhamento = { valor: null as string | null };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nome: string) => (nome === "kalyft_acompanhamento" && cookieAcompanhamento.valor ? { value: cookieAcompanhamento.valor } : undefined) }),
}));
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { createElement } from "react";
import { prerender } from "react-dom/static";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const ADMIN = randomUUID();
const sessao = { userId: A, admin: null as null | { userId: string; __admin: true } };
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao, obterVinculoSessao: async () => "d".repeat(64) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); },
  notFound: () => { throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); },
  usePathname: () => "/comecar",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

import { db } from "@/lib/db";
import { acessos, perfis, pesagens } from "@/lib/db/schema";
import { criarContexto } from "@/lib/dal/acompanhamento";
import { obterJornada } from "@/lib/dal/jornada";
import { garantirPerfil, obterPerfil } from "@/lib/dal/perfil";
import { hojeSaoPaulo } from "@/lib/datas";
import { adiarJornadaAcao, finalizarJornadaAcao, iniciarJornadaAcao, salvarEtapaAcao } from "@/app/(app)/comecar/actions";
import PaginaComecar from "@/app/(app)/comecar/page";
import PaginaHoje from "@/app/(app)/hoje/page";

const HOJE = hojeSaoPaulo();

async function html(Pagina: (p: never) => Promise<React.ReactNode>, sp: Record<string, string> = {}): Promise<string> {
  const arvore = await Pagina({ searchParams: Promise.resolve(sp), params: Promise.resolve({}) } as never);
  const { prelude } = await prerender(createElement("div", null, arvore));
  return (await new Response(prelude).text()).replaceAll("<!-- -->", "");
}
const destino = async (p: Promise<unknown>) => {
  try {
    return { estado: (await p) as { erro?: string; erros?: Record<string, string>; conflito?: boolean }, url: null as string | null };
  } catch (e) {
    const d = (e as { digest?: string }).digest;
    if (!d?.startsWith("NEXT_REDIRECT")) throw e;
    return { estado: null, url: d.split(";").at(-1)! };
  }
};
const form = (campos: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const revisaoAtual = async () => (await obterJornada(A))!.revisao;
const salvar = async (etapa: string, campos: Record<string, string | string[]>) =>
  destino(salvarEtapaAcao({}, form({ etapa, revisao: String(await revisaoAtual()), ...campos })));

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(ADMIN);
  await db.update(perfis).set({ nome: "Ana Souza", alturaCm: 165 }).where(eq(perfis.userId, A));
});
afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, ADMIN]));
  await db.delete(acessos).where(inArray(acessos.userId, [A, ADMIN]));
});

describe("convite e início", () => {
  it("Hoje convida quem ainda não começou; a página explica sem obrigar", async () => {
    expect(await html(PaginaHoje)).toContain("Monte seu começo com o Kalu");
    const h = await html(PaginaComecar);
    expect(h).toContain("Vamos montar seu começo?");
    expect(h).toContain("Nada é aplicado ao seu perfil antes da revisão final.");
  });

  it("'Agora não' adia: o convite some do Hoje; começar depois retoma", async () => {
    expect((await destino(adiarJornadaAcao())).url).toBe("/hoje");
    expect((await obterJornada(A))?.estado).toBe("adiada");
    expect(await html(PaginaHoje)).not.toContain("Monte seu começo com o Kalu");
    expect((await destino(iniciarJornadaAcao())).url).toBe("/comecar");
    expect((await obterJornada(A))?.estado).toBe("em_andamento");
    expect(await html(PaginaHoje)).toContain("Continue seu começo");
  });
});

describe("percurso pelas etapas", () => {
  it("foco: escolha obrigatória; 'os dois' pede a primeira área", async () => {
    expect(await html(PaginaComecar)).toContain("Por onde quer começar?");
    const r1 = await salvar("foco", {});
    expect(r1.estado?.erros).toHaveProperty("area");
    const r2 = await salvar("foco", { area: "ambos" });
    expect(r2.estado?.erros).toHaveProperty("primeira");
    expect((await salvar("foco", { area: "comida" })).url).toBe("/comecar");
  });

  it("perfil: erro por campo sem perder nada; depois salva e avança", async () => {
    expect(await html(PaginaComecar)).toContain("Vamos conhecer seu ponto de partida.");
    const r = await salvar("perfil", { alturaCm: "90", pesoKg: "80" });
    expect(r.estado?.erros).toHaveProperty("alturaCm");
    expect((await salvar("perfil", { nome: "Ana", alturaCm: "170", pesoKg: "79,5", dataPesagem: HOJE })).url).toBe("/comecar");
    expect((await obterJornada(A))?.rascunho.perfil).toEqual({ nome: "Ana", alturaCm: 170, pesoKg: 79.5, dataPesagem: HOJE });
  });

  it("voltar mostra as respostas guardadas; não dá para pular para depois do ponto alcançado", async () => {
    const h = await html(PaginaComecar, { etapa: "perfil" });
    expect(h).toContain('value="79,5"');
    expect(await html(PaginaComecar, { etapa: "revisao" })).toContain("O que você quer construir daqui pra frente?");
    expect(await html(PaginaComecar, { etapa: "treino" })).toContain("O que você quer construir daqui pra frente?");
  });

  it("objetivo, 'Agora não' na rotina, atividade e alimentação", async () => {
    expect((await salvar("objetivo", { objetivo: "manter" })).url).toBe("/comecar");
    expect((await salvar("rotina", { trabalho: "sentado", pular: "1" })).url).toBe("/comecar");
    expect((await obterJornada(A))?.rascunho.rotina).toEqual({});
    expect((await salvar("atividade", { exercicio: "regular", diasPorSemana: "3", tipos: ["caminhada"], nivelDeclarado: "leve" })).url).toBe("/comecar");
    expect((await salvar("alimentacao", { refeicoesPorDia: "4", alergia: "sim" })).url).toBe("/comecar");
  });

  it("aba antiga (revisão desatualizada) recebe conflito e nada é sobrescrito", async () => {
    const r = await destino(salvarEtapaAcao({}, form({ etapa: "rotina", revisao: "0", trabalho: "fisico" })));
    expect(r.estado?.conflito).toBe(true);
    expect((await obterJornada(A))?.rascunho.rotina).toEqual({});
  });
});

describe("revisão e conclusão", () => {
  it("revisão mostra respostas e o que vai para a conta, com o valor atual", async () => {
    const h = await html(PaginaComecar);
    expect(h).toContain("O que vai para a sua conta");
    expect(h).toContain("Altura: 170 cm");
    expect(h).toContain("Hoje está 165 cm. Marque para trocar.");
    expect(h).toContain("Nível de atividade: Leve");
    expect(h).toContain("Registrar pesagem: 79,5 kg");
    expect(h).toContain("Nome de preferência: Ana");
    expect(h).toContain("Metas de calorias e o plano de treino não são criados aqui");
  });

  it("confirmar aplica só o marcado, registra a pesagem e mostra o primeiro marco", async () => {
    const rev = await revisaoAtual();
    const r = await destino(
      finalizarJornadaAcao({}, form({ revisao: String(rev), aplicar: ["nivelAtividade"], visto_nivelAtividade: "", pesagem: "registrar" })),
    );
    expect(r.url).toBe("/comecar");
    expect(await obterPerfil(A)).toMatchObject({ nome: "Ana Souza", alturaCm: 165, nivelAtividade: "leve" });
    const [p] = await db.select().from(pesagens).where(eq(pesagens.userId, A));
    expect(p).toMatchObject({ data: HOJE, pesoKg: 79.5 });
    const h = await html(PaginaComecar);
    expect(h).toContain("Caminho revisado");
    expect(h).toContain("Conhecer o registro de comida");
    expect(await html(PaginaHoje)).not.toContain("Continue seu começo");
  });

  it("depois de concluída, salvar etapa não altera nada", async () => {
    const antes = (await obterJornada(A))!;
    const r = await destino(salvarEtapaAcao({}, form({ etapa: "rotina", revisao: String(antes.revisao), trabalho: "fisico" })));
    expect(r.url).toBe("/comecar");
    expect((await obterJornada(A))?.rascunho.rotina).toEqual({});
  });
});

describe("acompanhamento de aluno", () => {
  it("no contexto de um aluno, a jornada é recusada (conta própria apenas)", async () => {
    process.env.ADMIN_EMAILS = "admin-11b@teste.invalid";
    await db.insert(acessos).values([
      { userId: ADMIN, email: "admin-11b@teste.invalid", status: "aprovado" },
      { userId: A, email: "a-11b@teste.invalid", status: "aprovado" },
    ]).onConflictDoNothing();
    const admin = { userId: ADMIN, __admin: true } as const;
    const ctx = await criarContexto(admin, A, "d".repeat(64));
    sessao.userId = ADMIN;
    sessao.admin = admin;
    cookieAcompanhamento.valor = ctx.id;
    try {
      expect((await destino(salvarEtapaAcao({}, form({ etapa: "foco", revisao: "0", area: "treino" })))).url).toBe("/hoje?acompanhamento=pessoal");
      expect((await destino(iniciarJornadaAcao())).url).toBe("/hoje?acompanhamento=pessoal");
      expect((await destino(html(PaginaComecar))).url).toBe("/hoje?acompanhamento=pessoal");
      expect(await obterJornada(ADMIN)).toBeNull();
    } finally {
      cookieAcompanhamento.valor = null;
      sessao.userId = A;
      sessao.admin = null;
    }
  });
});

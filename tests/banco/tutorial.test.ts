// Fase 11C (2C): passeio pelo app nas telas reais — estado no servidor, roteiro e telas.
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
const B = randomUUID();
const ADMIN = randomUUID();
const sessao = { userId: A, admin: null as null | { userId: string; __admin: true } };
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao, obterVinculoSessao: async () => "e".repeat(64) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); },
  notFound: () => { throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); },
  usePathname: () => "/hoje",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

import { db } from "@/lib/db";
import { acessos, jornadasIniciais, perfis } from "@/lib/db/schema";
import { criarContexto } from "@/lib/dal/acompanhamento";
import { atualizarTutorial, finalizarJornada, iniciarJornada, obterJornada, obterTutorial, salvarEtapaJornada } from "@/lib/dal/jornada";
import { garantirPerfil } from "@/lib/dal/perfil";
import { concluirTutorialAcao, iniciarTutorialAcao, irParaPassoAcao, pularTutorialAcao } from "@/app/(app)/tutorial-actions";
import PaginaComecar from "@/app/(app)/comecar/page";
import PaginaHoje from "@/app/(app)/hoje/page";
import PaginaProgresso from "@/app/(app)/progresso/page";
import PaginaTreino from "@/app/(app)/treino/page";
import PaginaComida from "@/app/(app)/comida/page";

async function html(Pagina: (p: never) => Promise<React.ReactNode>): Promise<string> {
  const arvore = await Pagina({ searchParams: Promise.resolve({}), params: Promise.resolve({}) } as never);
  const { prelude } = await prerender(createElement("div", null, arvore));
  return (await new Response(prelude).text()).replaceAll("<!-- -->", "");
}
const destino = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    const d = (e as { digest?: string }).digest;
    if (!d?.startsWith("NEXT_REDIRECT")) throw e;
    return d.split(";").at(-1)!;
  }
};
const passo = (id: string) => {
  const f = new FormData();
  f.set("passo", id);
  return f;
};

beforeAll(async () => {
  for (const u of [A, B, ADMIN]) await garantirPerfil(u);
});
afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B, ADMIN]));
  await db.delete(acessos).where(inArray(acessos.userId, [A, B, ADMIN]));
});

describe("estado do passeio", () => {
  it("sem jornada: não iniciado; iniciar cria a linha adiada (sem mexer no rascunho) e leva ao Hoje", async () => {
    expect(await obterTutorial(A)).toEqual({ tutorial: { estado: "nao_iniciado" }, area: undefined });
    expect(await destino(iniciarTutorialAcao())).toBe("/hoje");
    const j = await obterJornada(A);
    expect(j).toMatchObject({ estado: "adiada", rascunho: {}, tutorial: { estado: "em_andamento", passo: "hoje" } });
  });

  it("ir para um passo do roteiro; passo inválido é ignorado", async () => {
    expect(await destino(irParaPassoAcao(passo("treino")))).toBe("/treino");
    expect((await obterTutorial(A)).tutorial).toEqual({ estado: "em_andamento", passo: "treino" });
    expect(await destino(irParaPassoAcao(passo("ajuda")))).toBeNull();
    expect((await obterTutorial(A)).tutorial).toEqual({ estado: "em_andamento", passo: "treino" });
  });

  it("roteiro de quem escolheu só alimentação não inclui o treino", async () => {
    await iniciarJornada(B);
    expect((await salvarEtapaJornada(B, { versao: 1, revisaoEsperada: 0, etapa: "foco", respostas: { area: "comida" } })).status).toBe("salvo");
    sessao.userId = B;
    try {
      await destino(iniciarTutorialAcao());
      expect(await destino(irParaPassoAcao(passo("treino")))).toBeNull();
      expect((await obterTutorial(B)).tutorial.passo).toBe("hoje");
      expect(await destino(irParaPassoAcao(passo("comida")))).toBe("/comida");
    } finally {
      sessao.userId = A;
    }
  });

  it("pular e concluir ficam guardados; estado inválido é recusado", async () => {
    await pularTutorialAcao();
    expect((await obterTutorial(A)).tutorial).toEqual({ estado: "pulado" });
    await concluirTutorialAcao();
    expect((await obterTutorial(A)).tutorial).toEqual({ estado: "concluido" });
    expect(await atualizarTutorial(A, { estado: "pulado", passo: "hoje" } as never)).toBe(false);
    expect(await atualizarTutorial(A, { estado: "assistido" } as never)).toBe(false);
  });

  it("isolamento: o passeio de B não muda o de A", async () => {
    expect((await obterTutorial(A)).tutorial).toEqual({ estado: "concluido" });
    expect((await obterTutorial(B)).tutorial).toEqual({ estado: "em_andamento", passo: "comida" });
  });
});

describe("telas", () => {
  it("marcações estáveis nas telas reais (sem procurar por texto)", async () => {
    expect(await html(PaginaHoje)).toContain('data-tour="hoje-refeicoes"');
    expect(await html(PaginaProgresso)).toContain('data-tour="progresso-peso"');
    expect(await html(PaginaTreino)).toContain('data-tour="treino"');
    expect(await html(PaginaComida)).toContain('data-tour="comida-adicionar"');
  });

  it("fim do cadastro oferece o passeio só se ainda não foi feito nem pulado", async () => {
    const C = randomUUID();
    await garantirPerfil(C);
    sessao.userId = C;
    try {
      await iniciarJornada(C);
      let rev = 0;
      for (const [etapa, respostas] of [["foco", { area: "treino" }], ["objetivo", { objetivo: "forca" }]] as const) {
        const r = await salvarEtapaJornada(C, { versao: 1, revisaoEsperada: rev, etapa, respostas });
        if (r.status !== "salvo") throw new Error(JSON.stringify(r));
        rev = r.revisao;
      }
      expect((await finalizarJornada(C, { versao: 1, revisaoEsperada: rev, aplicar: [], vistos: {}, pesagem: "nenhuma", pesoVisto: null })).status).toBe("concluida");
      expect(await html(PaginaComecar)).toContain("Quer conhecer o app?");
      await pularTutorialAcao();
      const h = await html(PaginaComecar);
      expect(h).toContain("Caminho revisado");
      expect(h).not.toContain("Quer conhecer o app?");
      const [linha] = await db.select().from(jornadasIniciais).where(eq(jornadasIniciais.userId, C));
      expect(linha.estado).toBe("concluida");
    } finally {
      sessao.userId = A;
      await db.delete(perfis).where(eq(perfis.userId, C));
    }
  });
});

describe("acompanhamento de aluno", () => {
  it("o passeio é só da conta própria", async () => {
    process.env.ADMIN_EMAILS = "admin-11c@teste.invalid";
    await db.insert(acessos).values([
      { userId: ADMIN, email: "admin-11c@teste.invalid", status: "aprovado" },
      { userId: A, email: "a-11c@teste.invalid", status: "aprovado" },
    ]).onConflictDoNothing();
    const admin = { userId: ADMIN, __admin: true } as const;
    const ctx = await criarContexto(admin, A, "e".repeat(64));
    sessao.userId = ADMIN;
    sessao.admin = admin;
    cookieAcompanhamento.valor = ctx.id;
    try {
      expect(await destino(iniciarTutorialAcao())).toBe("/hoje?acompanhamento=pessoal");
      expect(await destino(pularTutorialAcao())).toBe("/hoje?acompanhamento=pessoal");
      expect((await obterTutorial(A)).tutorial).toEqual({ estado: "concluido" });
      expect(await obterJornada(ADMIN)).toBeNull();
    } finally {
      cookieAcompanhamento.valor = null;
      sessao.userId = A;
      sessao.admin = null;
    }
  });
});

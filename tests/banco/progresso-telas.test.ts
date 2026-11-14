// Renderiza as telas novas do Progresso e da busca com dados reais do banco de teste (usuário fictício),
// para pegar erro de consulta ou de renderização antes de publicar.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { createElement } from "react";
import { prerender } from "react-dom/static";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const sessao = { userId: A, admin: null };
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao, obterVinculoSessao: async () => "0".repeat(64) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); },
  usePathname: () => "/progresso",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { db } from "@/lib/db";
import { perfis } from "@/lib/db/schema";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { salvarPesagem } from "@/lib/dal/corpo";
import { garantirPerfil } from "@/lib/dal/perfil";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import PaginaProgresso from "@/app/(app)/progresso/page";
import PaginaPesagem from "@/app/(app)/progresso/pesagem/page";
import PaginaAplicacao from "@/app/(app)/progresso/aplicacao/page";
import PaginaBuscar from "@/app/(app)/buscar/page";

const HOJE = hojeSaoPaulo();

async function html(componente: (p: never) => Promise<React.ReactNode>, searchParams: Record<string, string> = {}): Promise<string> {
  const arvore = await componente({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) } as never);
  const { prelude } = await prerender(createElement("div", null, arvore));
  return new Response(prelude).text();
}

beforeAll(async () => {
  await garantirPerfil(A);
  for (const [dias, peso] of [[40, 92], [30, 91.4], [14, 90.6], [3, 89.9], [0, 89.7]] as const) {
    await salvarPesagem(A, somarDias(HOJE, -dias), { pesoKg: peso, massaMagraKg: dias === 0 ? 60 : null, cinturaCm: null });
  }
  await criarAlimentoUsuario(A, { nome: "Panqueca de aveia da casa", marca: null, kcal: 210, proteinaG: 12, carboG: 25, gorduraG: 6, fibraG: 3, sodioMg: 100 });
}, 120_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A]));
});

describe("tela Progresso", () => {
  it("mostra resumo, atalhos e a aba de peso", async () => {
    const h = await html(PaginaProgresso);
    expect(h).toContain("Seu peso");
    expect(h).toContain("89,7 kg");
    expect(h).toContain("Em 30 dias");
    expect(h).toContain("Registrar peso");
    expect(h).toContain("Resumo da semana");
    expect(h).toContain("Peso e tendência");
    expect(h).toContain('href="/progresso/pesagem"');
  });
  it.each(["calorias", "deficit", "proteina", "treinos", "composicao"])("abre a aba %s sem erro", async (aba) => {
    const h = await html(PaginaProgresso, { aba, periodo: "3m" });
    expect(h).toContain('aria-current="true"');
    expect(h).not.toContain("Peso e tendência no período");
  });
  it("aba ou período inválidos voltam ao padrão", async () => {
    const h = await html(PaginaProgresso, { aba: "<script>", periodo: "x" });
    expect(h).toContain("Peso e tendência");
    expect(h).not.toContain("<script>");
  });
});

describe("páginas de pesagem e aplicação", () => {
  it("pesagem mostra o formulário com o peso de hoje e o histórico", async () => {
    const h = await html(PaginaPesagem);
    expect(h).toContain("Histórico");
    expect(h).toContain("89,7");
    expect(h).toContain("Apagar");
  });
  it("aplicação abre na conta própria", async () => {
    const h = await html(PaginaAplicacao);
    expect(h).toContain("Lembrete");
    expect(h).toContain("Sem lembrete");
  });
});

describe("busca", () => {
  it("sem termo mostra todas as funções", async () => {
    const h = await html(PaginaBuscar);
    expect(h).toContain("Todas as funções");
    expect(h).toContain("Código de barras");
    expect(h).not.toContain("Alunos"); // não é administrador
  });
  it("acha função e alimento do próprio usuário", async () => {
    const h = await html(PaginaBuscar, { q: "panqueca" });
    expect(h).toContain("Panqueca de aveia da casa");
    const f = await html(PaginaBuscar, { q: "peso" });
    expect(f).toContain("Registrar peso");
  });
  it("termo sem resultado explica o que fazer", async () => {
    const h = await html(PaginaBuscar, { q: "zzqqxx" });
    expect(h).toContain("Nada encontrado");
  });
});

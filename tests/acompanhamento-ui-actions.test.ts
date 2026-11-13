import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  exigirContaPropria: vi.fn(), exigirContextoDados: vi.fn(), exigirAdmin: vi.fn(),
  decidirAutorizacao: vi.fn(), revogarAutorizacao: vi.fn(), solicitarAutorizacao: vi.fn(),
}));
vi.mock("@/lib/auth/acompanhamento", () => ({ ...fake }));
vi.mock("@/lib/auth/sessao", () => ({ exigirAdmin: fake.exigirAdmin }));
vi.mock("@/lib/dal/acompanhamento", () => ({ ...fake }));
vi.mock("next/cache", () => ({ revalidatePath() {} }));
vi.mock("next/navigation", () => ({ unstable_rethrow() {} }));

import { responderPedido, revogarAcesso, solicitarAcesso } from "@/app/(app)/ajustes/acompanhamento/actions";

const pedido = "11111111-1111-4111-8111-111111111111";
function dados(valores: Record<string, string>) {
  const form = new FormData();
  for (const [chave, valor] of Object.entries(valores)) form.set(chave, valor);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  fake.exigirContaPropria.mockResolvedValue({ userId: "aluno-real", titularId: "aluno-real", contextoId: "proprio", modo: "proprio" });
  fake.exigirContextoDados.mockResolvedValue({ contextoId: "ctx-atual", titularId: "aluno", modo: "acompanhamento" });
  fake.exigirAdmin.mockResolvedValue({ userId: "admin-real", __admin: true });
  fake.decidirAutorizacao.mockImplementation(async (aluno, id, decisao, fim) => aluno === "aluno-real" && id === pedido && decisao === "aceitar" && fim?.toISOString() === "2099-02-20T21:30:00.000Z");
  fake.revogarAutorizacao.mockResolvedValue(false);
});

describe("decisões pessoais de acompanhamento", () => {
  it("usa o aluno autenticado e converte o prazo livre de São Paulo", async () => {
    expect(await responderPedido({}, dados({ pedidoId: pedido, decisao: "aceitar", tipo: "edicao", prazo: "2099-02-20T18:30" }))).toEqual({ ok: true });
  });
  it("rejeita prazo passado ou impossível antes de aceitar", async () => {
    for (const prazo of ["2020-01-01T10:00", "2099-02-30T10:00", ""]) {
      expect(await responderPedido({}, dados({ pedidoId: pedido, decisao: "aceitar", tipo: "edicao", prazo }))).toHaveProperty("erro");
    }
  });
  it("não informa sucesso ao revogar um pedido alheio", async () => {
    expect(await revogarAcesso({}, dados({ pedidoId: pedido }))).toHaveProperty("erro");
  });
  it("recusa solicitação de uma aba que acompanha outra conta", async () => {
    expect(await solicitarAcesso({}, dados({ contextoId: "ctx-antigo", tipo: "fotos" }))).toEqual({ erro: "A conta acompanhada mudou. Atualize a página antes de continuar." });
  });
});

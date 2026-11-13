import { describe, expect, it, vi } from "vitest";

// Exercise the public actions, not the visibility of their buttons. An invalid
// rendered context must be rejected before even invalid business data is parsed.
vi.mock("@/lib/auth/sessao", () => ({
  exigirUsuario: async () => ({ userId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", admin: null }),
  exigirAdmin: async () => ({ userId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", __admin: true }),
}));
vi.mock("@/lib/auth/acompanhamento", () => ({
  exigirContextoDados: async () => ({ userId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", admin: null }),
  exigirContaPropria: async () => { throw new Error("Conta pessoal necessária"); },
  executarAcaoAcompanhada: async () => { throw new Error("A conta acompanhada mudou"); },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { adicionar, editarRegistro, salvarAlimento, favoritar } from "@/app/(app)/comida/actions";
import { adicionarAguaLivre } from "@/app/(app)/comida/agua";
import { salvarPlano, salvarSerieDoDia } from "@/app/(app)/treino/actions";
import { salvarPesagem } from "@/app/(app)/progresso/actions";
import { salvarMetas } from "@/app/(app)/ajustes/actions";

describe("ações públicas recusam contexto antigo antes de alterar dados", () => {
  const casos = [
    ["adicionar comida", () => adicionar({}, new FormData())],
    ["editar registro", () => editarRegistro({}, new FormData())],
    ["cadastrar alimento", () => salvarAlimento({}, new FormData())],
    ["favoritar", () => favoritar(new FormData())],
    ["água", () => adicionarAguaLivre({}, new FormData())],
    ["plano", () => salvarPlano({}, new FormData())],
    ["série", () => salvarSerieDoDia({} as Parameters<typeof salvarSerieDoDia>[0])],
    ["pesagem", () => salvarPesagem({}, new FormData())],
    ["metas", () => salvarMetas({}, new FormData())],
  ] as const;
  for (const [nome, chamar] of casos) {
    it(nome, async () => { await expect(chamar()).rejects.toThrow("A conta acompanhada mudou"); });
  }
});

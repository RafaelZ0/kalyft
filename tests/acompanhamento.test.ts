import { describe, expect, it } from "vitest";
import { concessaoAtiva, contextoConfere } from "@/lib/acompanhamento/regras";
import { converterPrazoSaoPaulo } from "@/lib/validacao/acompanhamento";

describe("concessões de acompanhamento", () => {
  const agora = new Date("2026-11-14T15:00:00Z");
  it("encerra edição exatamente no prazo e exige prazo", () => {
    expect(concessaoAtiva("edicao", { estado: "aceita", expiraEm: agora }, agora)).toBe(false);
    expect(concessaoAtiva("edicao", { estado: "aceita", expiraEm: null }, agora)).toBe(false);
    expect(concessaoAtiva("edicao", { estado: "aceita", expiraEm: new Date("2026-11-14T15:01:00Z") }, agora)).toBe(true);
  });
  it.each(["pendente", "recusada", "revogada"] as const)("%s nunca concede acesso", (estado) => {
    expect(concessaoAtiva("fotos", { estado, expiraEm: null }, agora)).toBe(false);
  });
  it("fotos têm concessão independente e podem valer até revogação", () => {
    expect(concessaoAtiva("fotos", null, agora)).toBe(false);
    expect(concessaoAtiva("fotos", { estado: "aceita", expiraEm: null }, agora)).toBe(true);
  });
  it("não confunde formulários entre contas nem aceita marcador ausente", () => {
    expect(contextoConfere("proprio", "ctx-aluno")).toBe(false);
    expect(contextoConfere("ctx-a", "ctx-b")).toBe(false);
    expect(contextoConfere("", "")).toBe(false);
    expect(contextoConfere("proprio", "proprio")).toBe(true);
  });
});

describe("prazo em São Paulo", () => {
  it("converte horário local sem depender do fuso do host", () => {
    expect(converterPrazoSaoPaulo("2026-11-14T12:30", new Date("2026-11-14T15:00:00Z"))?.toISOString()).toBe("2026-11-14T15:30:00.000Z");
  });
  it.each(["2026-02-30T12:30", "2026-11-14T25:30", "2026-11-14T12:00", "", "2026-11-14T12:30Z"])("recusa data inválida ou não futura: %s", (data) => {
    expect(converterPrazoSaoPaulo(data, new Date("2026-11-14T15:00:00Z"))).toBeNull();
  });
});

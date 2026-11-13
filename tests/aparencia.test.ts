import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { normalizarAparencia, resolverTema, SCRIPT_APARENCIA } from "@/lib/aparencia";

describe("aparência por dispositivo", () => {
  it("usa sistema para preferência ausente, corrompida ou desconhecida", () => {
    for (const valor of [null, undefined, "", "azul", {}, "dark"]) expect(normalizarAparencia(valor)).toBe("sistema");
    expect(normalizarAparencia("claro")).toBe("claro");
    expect(normalizarAparencia("escuro")).toBe("escuro");
  });
  it("acompanha o telefone apenas na opção Sistema", () => {
    expect(resolverTema("sistema", true)).toBe("escuro");
    expect(resolverTema("sistema", false)).toBe("claro");
    expect(resolverTema("claro", true)).toBe("claro");
    expect(resolverTema("escuro", false)).toBe("escuro");
  });
  it("inicializa antes da hidratação e tolera armazenamento bloqueado", () => {
    for (const [salvo, esperado] of [["escuro", "escuro"], ["claro", "claro"], ["invalido", "sistema"]]) {
      const document = { documentElement: { dataset: {} } };
      runInNewContext(SCRIPT_APARENCIA, { document, localStorage: { getItem: () => salvo } });
      expect(document.documentElement.dataset).toEqual({ aparencia: esperado });
    }
    const document = { documentElement: { dataset: {} } };
    runInNewContext(SCRIPT_APARENCIA, { document, localStorage: { getItem() { throw Error("bloqueado"); } } });
    expect(document.documentElement.dataset).toEqual({ aparencia: "sistema" });
  });
});

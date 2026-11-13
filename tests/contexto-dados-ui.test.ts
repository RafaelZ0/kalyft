import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ContextoDadosProvider, FormDados, type ContextoDadosPublico } from "@/components/contexto-dados";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

const contexto: ContextoDadosPublico = {
  contextoId: "contexto-aluno", modo: "acompanhamento", podeEditar: false,
  podeVerFotos: false, edicaoAte: null,
};

function renderizar(valor: ContextoDadosPublico, method?: "get") {
  return renderToStaticMarkup(createElement(ContextoDadosProvider, { contexto: valor },
    createElement(FormDados, { method, className: "space-y-4" }, createElement("button", { type: "submit" }, "Salvar")),
  ));
}

describe("formulários no contexto acompanhado", () => {
  it("envia o contexto renderizado e impede edição em leitura", () => {
    const html = renderizar(contexto);
    expect(html).toContain('name="contextoId" value="contexto-aluno"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("Somente leitura");
    expect(html).toContain('class="space-y-4"');
  });

  it("mantém a conta própria e a edição autorizada utilizáveis", () => {
    expect(renderizar({ ...contexto, contextoId: "proprio", modo: "proprio" })).not.toContain('disabled=""');
    expect(renderizar({ ...contexto, podeEditar: true, edicaoAte: "2099-01-01T15:00:00.000Z" })).not.toContain('disabled=""');
  });

  it("bloqueia uma concessão vencida e preserva formulários de busca", () => {
    expect(renderizar({ ...contexto, podeEditar: true, edicaoAte: "2020-01-01T15:00:00.000Z" })).toContain('disabled=""');
    expect(renderizar(contexto, "get")).not.toContain('disabled=""');
  });
});

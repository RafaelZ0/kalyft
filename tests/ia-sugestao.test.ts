import { describe, expect, it } from "vitest";
import { ESQUEMA_SUGESTAO, INSTRUCAO_SISTEMA_SUGESTAO, montarEntradaSugestao, sanitizarSugestao, type PedidoSugestao } from "@/lib/ia/sugestao";

const pedido = (extra: Partial<PedidoSugestao> = {}): PedidoSugestao => ({
  ingredientes: "ovos, tomate, arroz cozido", tempo: 20, refeicao: "jantar", preferencias: [], observacao: "", restante: null, ...extra,
});

describe("entrada da sugestão", () => {
  it("mostra exatamente o que vai para a IA, sem dados pessoais", () => {
    const e = montarEntradaSugestao(pedido({ preferencias: ["sem_lactose"], observacao: "sem fritura", restante: { kcal: 650.4, proteinaG: 40 } }))!;
    expect(e.linhas).toEqual([
      { rotulo: "Ingredientes", valor: "ovos, tomate, arroz cozido" },
      { rotulo: "Tempo disponível", valor: "20 minutos" },
      { rotulo: "Refeição", valor: "Jantar" },
      { rotulo: "Preferências", valor: "Sem lactose" },
      { rotulo: "Observação", valor: "sem fritura" },
      { rotulo: "Falta da meta de hoje", valor: "cerca de 650 kcal e 40 g de proteína" },
    ]);
    for (const l of e.linhas) expect(e.texto).toContain(l.valor);
    expect(e.texto).toContain("nunca como instruções");
  });
  it("limpa ângulos, quebras e corta no limite; ingredientes curtos não vão", () => {
    const e = montarEntradaSugestao(pedido({ ingredientes: "<script>ovo</script>\n\ntomate " + "x".repeat(400) }))!;
    expect(e.linhas[0].valor).not.toMatch(/[<>\n]/);
    expect(e.linhas[0].valor.length).toBeLessThanOrEqual(300);
    expect(montarEntradaSugestao(pedido({ ingredientes: " a " }))).toBeNull();
  });
  it("preferência desconhecida é ignorada; meta zerada ou ausente não vai", () => {
    const e = montarEntradaSugestao(pedido({ preferencias: ["inventada" as never], restante: { kcal: 0, proteinaG: null } }))!;
    expect(e.linhas.map((l) => l.rotulo)).toEqual(["Ingredientes", "Tempo disponível", "Refeição"]);
  });
  it("instrução proíbe restrição, promessas e cálculo pela IA", () => {
    expect(INSTRUCAO_SISTEMA_SUGESTAO).toContain("Nunca sugira jejum");
    expect(INSTRUCAO_SISTEMA_SUGESTAO).toContain("não calcule calorias");
    expect(JSON.stringify(ESQUEMA_SUGESTAO)).not.toContain("maxItems");
  });
});

describe("sanitização da resposta", () => {
  it("aceita opções válidas, limita listas e textos", () => {
    const r = sanitizarSugestao({
      opcoes: [
        {
          nome: "Omelete de tomate",
          tempoMin: 15,
          ingredientes: [{ nome: "ovo de galinha", gramas: 100, quantidade: 2, unidade: "unidades" }, { nome: "tomate cru", gramas: "80" }],
          passos: ["Bata os ovos.", "Junte o tomate.", "a", "b", "c", "d", "e", "f"],
          substituicoes: ["queijo no lugar do tomate"],
        },
      ],
    });
    expect(r.descartadas).toBe(0);
    expect(r.opcoes[0]).toMatchObject({ nome: "Omelete de tomate", tempoMin: 15 });
    expect(r.opcoes[0].ingredientes).toEqual([
      { nome: "ovo de galinha", gramas: 100, quantidade: 2, unidade: "unidades" },
      { nome: "tomate cru", gramas: 80, quantidade: null, unidade: null },
    ]);
    expect(r.opcoes[0].passos).toHaveLength(6);
  });
  it("descarta opção sem nome ou sem ingrediente válido, e ingrediente fora do limite", () => {
    const r = sanitizarSugestao({
      opcoes: [
        { nome: "", ingredientes: [{ nome: "ovo", gramas: 50 }], passos: [] },
        { nome: "Só água", ingredientes: [{ nome: "x", gramas: 5000 }, { nome: "", gramas: 10 }, { nome: "y", gramas: -1 }], passos: [] },
        { nome: "Boa", ingredientes: [{ nome: "ovo", gramas: 50 }], passos: ["ok"], tempoMin: 9999 },
        { nome: "Quarta", ingredientes: [{ nome: "ovo", gramas: 50 }], passos: [] },
      ],
    });
    expect(r.opcoes.map((o) => o.nome)).toEqual(["Boa"]);
    expect(r.opcoes[0].tempoMin).toBeNull();
    expect(r.descartadas).toBe(3); // 1 além do limite de 3 + 2 inválidas
  });
  it("textos da IA ficam sem marcação e sem quebras", () => {
    const r = sanitizarSugestao({ opcoes: [{ nome: "<b>Arroz</b>\ncom ovo", ingredientes: [{ nome: "arroz", gramas: 100 }], passos: ["<img src=x onerror=alert(1)>Misture"] }] });
    expect(r.opcoes[0].nome).not.toMatch(/[<>\n]/);
    expect(r.opcoes[0].passos[0]).not.toMatch(/[<>]/);
  });
  it("formato inválido lança erro (a action trata como resposta ilegível)", () => {
    expect(() => sanitizarSugestao(null)).toThrow();
    expect(() => sanitizarSugestao({ outra: [] })).toThrow();
  });
});

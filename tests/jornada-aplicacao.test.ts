import { describe, expect, it } from "vitest";
import { planoDeAplicacao, preferenciasDoRascunho } from "@/lib/jornada-aplicacao";

const vazio = { nome: null, dataNascimento: null, sexo: null, alturaCm: null, nivelAtividade: null };

describe("plano de aplicação da revisão", () => {
  it("só propõe o que foi informado; vazio nunca apaga o que existe", () => {
    const p = planoDeAplicacao({ perfil: { alturaCm: 172 } }, { ...vazio, nome: "Ana" }, null);
    expect(p.perfil).toEqual([{ campo: "alturaCm", atual: null, novo: 172, padrao: true }]);
    expect(p.pesagem).toEqual({ tipo: "nenhuma" });
  });

  it("valor igual ao atual não vira mudança; valor diferente começa desmarcado", () => {
    const p = planoDeAplicacao(
      { perfil: { nome: "Ana", alturaCm: 170 }, atividade: { nivelDeclarado: "leve" } },
      { ...vazio, nome: "Ana", alturaCm: 165, nivelAtividade: null },
      null,
    );
    expect(p.perfil).toEqual([
      { campo: "alturaCm", atual: 165, novo: 170, padrao: false },
      { campo: "nivelAtividade", atual: null, novo: "leve", padrao: true },
    ]);
  });

  it("sexo 'prefiro informar depois' não altera nada", () => {
    expect(planoDeAplicacao({ perfil: { sexo: "depois" } }, vazio, null).perfil).toEqual([]);
    expect(planoDeAplicacao({ perfil: { sexo: "feminino" } }, vazio, null).perfil).toEqual([
      { campo: "sexo", atual: null, novo: "feminino", padrao: true },
    ]);
  });

  it("pesagem só com peso E data; sem data, fica pendente e não cria medição", () => {
    expect(planoDeAplicacao({ perfil: { pesoKg: 80 } }, vazio, null).pesagem).toEqual({ tipo: "sem_data", pesoKg: 80 });
    expect(planoDeAplicacao({ perfil: { pesoKg: 80, dataPesagem: "2026-11-10" } }, vazio, null).pesagem).toEqual({
      tipo: "nova", data: "2026-11-10", pesoKg: 80,
    });
  });

  it("pesagem existente na data pede decisão; massa magra maior que o novo peso impede substituir", () => {
    const r = { perfil: { pesoKg: 80, dataPesagem: "2026-11-10" } };
    expect(planoDeAplicacao(r, vazio, { pesoKg: 82, massaMagraKg: 60 }).pesagem).toEqual({
      tipo: "existente", data: "2026-11-10", pesoKg: 80, pesoAtualKg: 82, podeSubstituir: true,
    });
    expect(planoDeAplicacao(r, vazio, { pesoKg: 80, massaMagraKg: null }).pesagem).toEqual({ tipo: "igual", data: "2026-11-10", pesoKg: 80 });
    expect(planoDeAplicacao(r, vazio, { pesoKg: 90, massaMagraKg: 85 }).pesagem).toMatchObject({ tipo: "existente", podeSubstituir: false });
  });
});

describe("preferências guardadas na conclusão", () => {
  it("guarda as escolhas estruturadas, sem repetir perfil/pesagem nem o nível (que vai ao perfil)", () => {
    const pref = preferenciasDoRascunho({
      foco: { area: "ambos", primeira: "treino" },
      perfil: { alturaCm: 170, pesoKg: 80 },
      objetivo: { objetivo: "massa", pesoReferenciaKg: 75 },
      rotina: { trabalho: "sentado" },
      atividade: { exercicio: "regular", diasPorSemana: 3, nivelDeclarado: "leve" },
      treino: { diasSemana: ["seg"] },
      alimentacao: {},
    });
    expect(pref).toEqual({
      foco: { area: "ambos", primeira: "treino" },
      objetivo: { objetivo: "massa", pesoReferenciaKg: 75 },
      rotina: { trabalho: "sentado" },
      atividade: { exercicio: "regular", diasPorSemana: 3 },
      treino: { diasSemana: ["seg"] },
      alimentacao: {},
    });
  });
});

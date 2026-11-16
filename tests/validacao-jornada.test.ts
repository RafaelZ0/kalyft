import { describe, expect, it } from "vitest";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { rascunhoSchema, salvarEtapaSchema, validarRespostas } from "@/lib/validacao/jornada";

const ok = (etapa: string, respostas: unknown) => {
  const r = validarRespostas(etapa, respostas);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.respostas;
};
const erros = (etapa: string, respostas: unknown) => {
  const r = validarRespostas(etapa, respostas);
  if (r.ok) throw new Error("deveria falhar");
  return r.erros;
};
const HOJE = hojeSaoPaulo();

describe("foco", () => {
  it("área obrigatória; 'ambos' exige a primeira área; fora de 'ambos' a primeira não vale", () => {
    expect(ok("foco", { area: "comida" })).toEqual({ area: "comida" });
    expect(ok("foco", { area: "ambos", primeira: "treino" })).toEqual({ area: "ambos", primeira: "treino" });
    expect(erros("foco", {})).toHaveProperty("area");
    expect(erros("foco", { area: "ambos" })).toHaveProperty("primeira");
    expect(erros("foco", { area: "comida", primeira: "treino" })).toHaveProperty("primeira");
    expect(erros("foco", { area: "dieta" })).toHaveProperty("area");
  });
});

describe("perfil", () => {
  it("tudo opcional; vazio é ausência, nunca zero", () => {
    expect(ok("perfil", {})).toEqual({});
    expect(ok("perfil", { nome: "  ", alturaCm: "", pesoKg: "" })).toEqual({});
  });
  it("aceita vírgula e converte para número", () => {
    expect(ok("perfil", { alturaCm: "172", pesoKg: "78,5", dataPesagem: HOJE })).toEqual({ alturaCm: 172, pesoKg: 78.5, dataPesagem: HOJE });
  });
  it("limites, datas e sexo", () => {
    expect(erros("perfil", { alturaCm: "90" })).toHaveProperty("alturaCm");
    expect(erros("perfil", { pesoKg: "401" })).toHaveProperty("pesoKg");
    expect(erros("perfil", { pesoKg: "78,55" })).toHaveProperty("pesoKg");
    expect(erros("perfil", { nascimento: somarDias(HOJE, 1) })).toHaveProperty("nascimento");
    expect(erros("perfil", { nascimento: "1899-12-31" })).toHaveProperty("nascimento");
    expect(erros("perfil", { pesoKg: "80", dataPesagem: somarDias(HOJE, 1) })).toHaveProperty("dataPesagem");
    expect(erros("perfil", { sexo: "outro" })).toHaveProperty("sexo");
    expect(ok("perfil", { sexo: "depois" })).toEqual({ sexo: "depois" });
    expect(erros("perfil", { nome: "x".repeat(81) })).toHaveProperty("nome");
  });
  it("data da pesagem sem o peso não cria medição", () => {
    expect(erros("perfil", { dataPesagem: HOJE })).toHaveProperty("pesoKg");
  });
});

describe("objetivo", () => {
  it("objetivo obrigatório; peso de referência só para reduzir, manter ou ganhar massa", () => {
    expect(ok("objetivo", { objetivo: "reduzir", pesoReferenciaKg: "75" })).toEqual({ objetivo: "reduzir", pesoReferenciaKg: 75 });
    expect(ok("objetivo", { objetivo: "organizar" })).toEqual({ objetivo: "organizar" });
    expect(erros("objetivo", {})).toHaveProperty("objetivo");
    expect(erros("objetivo", { objetivo: "forca", pesoReferenciaKg: "80" })).toHaveProperty("pesoReferenciaKg");
  });
});

describe("rotina e atividade", () => {
  it("rotina opcional, só opções conhecidas", () => {
    expect(ok("rotina", { trabalho: "sentado", deslocamento: "bicicleta" })).toEqual({ trabalho: "sentado", deslocamento: "bicicleta" });
    expect(erros("rotina", { trabalho: "deitado" })).toHaveProperty("trabalho");
  });
  it("quem já pratica ou está voltando informa os dias; quem não pratica não tem dias", () => {
    expect(ok("atividade", { exercicio: "regular", diasPorSemana: "3", minutos: "40", tipos: ["musculacao", "corrida"] })).toEqual({
      exercicio: "regular", diasPorSemana: 3, minutos: 40, tipos: ["musculacao", "corrida"],
    });
    expect(erros("atividade", { exercicio: "voltando" })).toHaveProperty("diasPorSemana");
    expect(erros("atividade", { exercicio: "nenhum", diasPorSemana: "2" })).toHaveProperty("diasPorSemana");
    expect(erros("atividade", { exercicio: "regular", diasPorSemana: "8" })).toHaveProperty("diasPorSemana");
    expect(erros("atividade", { exercicio: "regular", diasPorSemana: "2,5" })).toHaveProperty("diasPorSemana");
    expect(erros("atividade", { exercicio: "regular", diasPorSemana: "3", tipos: ["natacao"] })).toHaveProperty("tipos");
    expect(erros("atividade", { exercicio: "regular", diasPorSemana: "3", tipos: ["corrida", "corrida"] })).toHaveProperty("tipos");
    expect(ok("atividade", { nivelDeclarado: "moderado" })).toEqual({ nivelDeclarado: "moderado" });
    expect(ok("atividade", {})).toEqual({});
  });
});

describe("treino e alimentação", () => {
  it("treino: disponibilidade é intenção, com limites", () => {
    expect(ok("treino", { metodo: "ajuda", diasSemana: ["seg", "qua"], minutosSessao: "30", equipamentos: ["halteres"] })).toEqual({
      metodo: "ajuda", diasSemana: ["seg", "qua"], minutosSessao: 30, equipamentos: ["halteres"],
    });
    expect(erros("treino", { minutosSessao: "5" })).toHaveProperty("minutosSessao");
    expect(erros("treino", { diasSemana: ["feriado"] })).toHaveProperty("diasSemana");
    expect(erros("treino", { limitacao: "joelho operado em 2020" })).toHaveProperty("limitacao");
  });
  it("alimentação: alergia é diferente de preferência; zero minutos de preparo é válido", () => {
    expect(ok("alimentacao", { alergia: "sim", preferencia: "vegana", refeicoesPorDia: "4", minutosPreparo: "0" })).toEqual({
      alergia: "sim", preferencia: "vegana", refeicoesPorDia: 4, minutosPreparo: 0,
    });
    expect(erros("alimentacao", { refeicoesPorDia: "0" })).toHaveProperty("refeicoesPorDia");
    expect(erros("alimentacao", { restricao: "amendoim" })).toHaveProperty("restricao");
  });
});

describe("contrato de entrada", () => {
  it("campos desconhecidos são recusados (sem texto livre extra)", () => {
    expect(erros("perfil", { alturaCm: "170", observacao: "diabetes" })).toHaveProperty("_");
    expect(erros("revisao", { qualquer: 1 })).toHaveProperty("_");
  });
  it("revisão e início não recebem respostas", () => {
    expect(ok("revisao", {})).toEqual({});
    expect(ok("inicio", {})).toEqual({});
  });
  it("etapa desconhecida é recusada", () => {
    expect(erros("cartao", {})).toHaveProperty("etapa");
  });
  it("salvar exige versão, revisão esperada inteira e etapa", () => {
    expect(salvarEtapaSchema.safeParse({ versao: 1, revisaoEsperada: 0, etapa: "foco", respostas: {} }).success).toBe(true);
    expect(salvarEtapaSchema.safeParse({ versao: 1, revisaoEsperada: -1, etapa: "foco", respostas: {} }).success).toBe(false);
    expect(salvarEtapaSchema.safeParse({ versao: 1, revisaoEsperada: 0.5, etapa: "foco", respostas: {} }).success).toBe(false);
    expect(salvarEtapaSchema.safeParse({ versao: 1, revisaoEsperada: 0, etapa: "foco", respostas: {}, userId: "x" }).success).toBe(false);
  });
  it("rascunho guardado também é estrito (números, sem campos extras)", () => {
    expect(rascunhoSchema.safeParse({ foco: { area: "comida" }, perfil: { alturaCm: 172 } }).success).toBe(true);
    expect(rascunhoSchema.safeParse({ perfil: { alturaCm: "172" } }).success).toBe(false);
    expect(rascunhoSchema.safeParse({ perfil: { alergiaDetalhada: "x" } }).success).toBe(false);
    expect(rascunhoSchema.safeParse({ extra: {} }).success).toBe(false);
  });
});

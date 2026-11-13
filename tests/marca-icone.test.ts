import { describe, expect, it } from "vitest";
import { desenharIcone } from "@/lib/icone";

describe("ícones instaláveis da marca", () => {
  it.each([32, 192, 512])("renderiza PNG válido de %i pixels", async (tamanho) => {
    const resposta = desenharIcone(tamanho);
    const dados = Buffer.from(await resposta.arrayBuffer());
    expect(dados.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(dados.readUInt32BE(16)).toBe(tamanho);
    expect(dados.readUInt32BE(20)).toBe(tamanho);
  });
});

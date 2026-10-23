import { describe, expect, it } from "vitest";
import { LIMITES_FOTO_CORPO, limparJpeg, validarFotoCorpo } from "@/lib/foto-corpo";

const u8 = (...n: number[]) => Uint8Array.from(n);
const concat = (...p: Uint8Array[]) => {
  const o = new Uint8Array(p.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const x of p) {
    o.set(x, i);
    i += x.length;
  }
  return o;
};
const texto = (s: string) => new TextEncoder().encode(s);
const segmento = (marcador: number, dados: Uint8Array) => concat(u8(0xff, marcador, (dados.length + 2) >> 8, (dados.length + 2) & 0xff), dados);
const sof = (largura: number, altura: number) => segmento(0xc0, concat(u8(8, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 1, 1, 0x11, 0)));
const sos = segmento(0xda, u8(1, 1, 0, 0, 63, 0));
const dadosImagem = (n: number) => concat(Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) & 0x7f)); // sem 0xFF
const FIM = u8(0xff, 0xd9);

/** Monta um JPEG sintético com os segmentos dados (EXIF, XMP, comentário...). */
function jpeg(opcoes: { largura?: number; altura?: number; extras?: Uint8Array[]; dados?: number } = {}) {
  const jfif = segmento(0xe0, texto("JFIF\0\x01\x01\0\0\x01\0\x01\0\0"));
  return concat(u8(0xff, 0xd8), jfif, ...(opcoes.extras ?? []), sof(opcoes.largura ?? 1080, opcoes.altura ?? 1440), sos, dadosImagem(opcoes.dados ?? 4000), FIM);
}
const tem = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));

describe("limpeza de metadados do JPEG", () => {
  it("remove EXIF (com GPS), XMP, ICC e comentários, e mantém a imagem", () => {
    const exif = segmento(0xe1, texto("Exif\0\0II*\0GPSLatitude -23.55 GPSLongitude -46.63 Apple iPhone 15"));
    const xmp = segmento(0xe1, texto("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>autor Fulano</x:xmpmeta>"));
    const icc = segmento(0xe2, texto("ICC_PROFILE\0perfil de cor"));
    const com = segmento(0xfe, texto("comentario secreto do aparelho"));
    const original = jpeg({ extras: [exif, xmp, icc, com] });
    expect(tem(original, "GPSLatitude")).toBe(true);
    const r = limparJpeg(original)!;
    expect(r).not.toBeNull();
    for (const proibido of ["Exif", "GPSLatitude", "iPhone", "xmpmeta", "ICC_PROFILE", "comentario secreto"]) expect(tem(r.bytes, proibido)).toBe(false);
    expect(r.largura).toBe(1080);
    expect(r.altura).toBe(1440);
    expect(r.bytes.length).toBeLessThan(original.length);
    expect(r.bytes[0]).toBe(0xff);
    expect(r.bytes[1]).toBe(0xd8);
    expect(r.bytes.at(-2)).toBe(0xff);
    expect(r.bytes.at(-1)).toBe(0xd9);
    expect(tem(r.bytes, "JFIF")).toBe(true); // o cabeçalho JFIF fica
  });
  it("os dados da imagem ficam idênticos (o JPEG limpo ainda é o mesmo quadro)", () => {
    const original = jpeg({ dados: 3000, extras: [segmento(0xe1, texto("Exif\0\0lixo"))] });
    const r = limparJpeg(original)!;
    const semExtras = limparJpeg(jpeg({ dados: 3000 }))!;
    expect(Buffer.from(r.bytes).equals(Buffer.from(semExtras.bytes))).toBe(true);
  });
  it.each([
    ["texto qualquer", texto("isto não é uma imagem de jeito nenhum")],
    ["PNG", u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)],
    ["PDF", texto("%PDF-1.4 conteudo qualquer")],
    ["vazio", new Uint8Array(0)],
    ["só o começo", u8(0xff, 0xd8)],
    ["sem fim (truncado)", jpeg().subarray(0, 600)],
    ["segmento maior que o arquivo", concat(u8(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff), texto("curto"))],
    ["sem quadro (SOF)", concat(u8(0xff, 0xd8), sos, dadosImagem(100), FIM)],
    ["script disfarçado", concat(u8(0xff, 0xd8), texto("<script>alert(1)</script>"))],
  ])("recusa %s", (_, b) => {
    expect(limparJpeg(b)).toBeNull();
  });
});

describe("validação da foto do corpo", () => {
  it("aceita um JPEG do tamanho esperado", () => {
    const r = validarFotoCorpo(jpeg({ dados: 20000 }));
    expect(r.ok).toBe(true);
  });
  it("recusa muito pequeno, muito grande e dimensões fora do limite", () => {
    expect(validarFotoCorpo(jpeg({ dados: 10 })).ok).toBe(false);
    const grande = validarFotoCorpo(jpeg({ dados: LIMITES_FOTO_CORPO.bytesMax + 5000 }));
    expect(grande).toMatchObject({ ok: false });
    expect(validarFotoCorpo(jpeg({ largura: 100, altura: 100, dados: 5000 })).ok).toBe(false);
    expect(validarFotoCorpo(jpeg({ largura: 9000, altura: 1200, dados: 5000 })).ok).toBe(false);
    expect(validarFotoCorpo(new Uint8Array(LIMITES_FOTO_CORPO.bytesMax * 3))).toMatchObject({ ok: false, erro: "A foto é grande demais." });
  });
  it("o tamanho conta depois de tirar os metadados (EXIF grande não reprova a foto)", () => {
    const exifGrande = segmento(0xe1, concat(texto("Exif\0\0"), new Uint8Array(30000).fill(65)));
    const r = validarFotoCorpo(jpeg({ dados: LIMITES_FOTO_CORPO.bytesMax - 2000, extras: [exifGrande] }));
    expect(r.ok).toBe(true);
  });
});

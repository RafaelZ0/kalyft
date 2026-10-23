// Fotos de progresso do corpo (funções puras). É o dado mais sensível do app: a foto fica só no banco, do
// próprio usuário, nunca vai para a IA e é servida só por uma rota que confere a sessão. Antes de gravar, o
// servidor refaz a limpeza dos metadados (EXIF, localização, câmera) mesmo que o navegador já tenha feito.

export const POSICOES = ["frente", "lado", "costas"] as const;
export type Posicao = (typeof POSICOES)[number];
export const ROTULOS_POSICAO: Record<Posicao, string> = { frente: "Frente", lado: "Lado", costas: "Costas" };

export const LIMITES_FOTO_CORPO = {
  /** Máximo de fotos por pessoa (≈ 15 MB no banco). */
  maximo: 60,
  /** Tamanho máximo do JPEG já reduzido (o navegador gera algo entre 150 e 300 KB). */
  bytesMax: 500 * 1024,
  bytesMin: 1024,
  ladoMin: 200,
  ladoMax: 4000,
  notaMax: 200,
} as const;

export type JpegLimpo = { bytes: Uint8Array; largura: number; altura: number };

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * Valida a estrutura de um JPEG e devolve uma cópia SEM os segmentos de metadados: APP1 a APP15 (EXIF, XMP,
 * ICC, etc.) e comentários (COM). Mantém o APP0 (JFIF) e tudo que é necessário para exibir a imagem.
 * Devolve null se o arquivo não for um JPEG íntegro (começo, segmentos, quadro e fim).
 */
export function limparJpeg(entrada: Uint8Array): JpegLimpo | null {
  const b = entrada;
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const partes: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let largura = 0;
  let altura = 0;
  let achouQuadro = false;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff) i++; // bytes de preenchimento antes do marcador
    const m = b[i];
    i++;
    if (m === undefined) return null;
    if (m === 0xd9) return null; // fim da imagem antes de qualquer dado
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue; // marcadores sem tamanho
    if (i + 2 > b.length) return null;
    const tam = (b[i] << 8) | b[i + 1];
    if (tam < 2 || i + tam > b.length) return null;
    const segmento = b.subarray(i - 2, i + tam); // inclui FF e o marcador
    if (SOF.has(m)) {
      if (tam < 8) return null;
      altura = (b[i + 3] << 8) | b[i + 4];
      largura = (b[i + 5] << 8) | b[i + 6];
      achouQuadro = true;
    }
    const metadado = (m >= 0xe1 && m <= 0xef) || m === 0xfe;
    if (!metadado) partes.push(segmento);
    i += tam;
    if (m === 0xda) {
      // Início dos dados da imagem: o resto (dados comprimidos até o fim) é copiado como está.
      if (!achouQuadro) return null;
      const resto = b.subarray(i);
      if (resto.length < 2 || resto[resto.length - 2] !== 0xff || resto[resto.length - 1] !== 0xd9) return null;
      partes.push(resto);
      const total = partes.reduce((s, p) => s + p.length, 0);
      const saida = new Uint8Array(total);
      let o = 0;
      for (const p of partes) {
        saida.set(p, o);
        o += p.length;
      }
      return { bytes: saida, largura, altura };
    }
  }
  return null;
}

export type ResultadoValidacao = { ok: true; jpeg: JpegLimpo } | { ok: false; erro: string };

/** Valida o arquivo recebido: JPEG íntegro, sem metadados, com tamanho e dimensões razoáveis. */
export function validarFotoCorpo(entrada: Uint8Array): ResultadoValidacao {
  if (entrada.length > LIMITES_FOTO_CORPO.bytesMax * 2) return { ok: false, erro: "A foto é grande demais." };
  const j = limparJpeg(entrada);
  if (!j) return { ok: false, erro: "Use uma foto em JPEG. O app converte a imagem automaticamente; tente escolher a foto de novo." };
  if (j.bytes.length < LIMITES_FOTO_CORPO.bytesMin) return { ok: false, erro: "A foto está vazia ou pequena demais." };
  if (j.bytes.length > LIMITES_FOTO_CORPO.bytesMax) return { ok: false, erro: "A foto passou de 500 KB mesmo reduzida. Escolha outra." };
  const { largura, altura } = j;
  const { ladoMin, ladoMax } = LIMITES_FOTO_CORPO;
  if (Math.min(largura, altura) < ladoMin || Math.max(largura, altura) > ladoMax) return { ok: false, erro: "As dimensões da foto estão fora do aceitável." };
  return { ok: true, jpeg: j };
}

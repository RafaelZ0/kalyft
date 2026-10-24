import { ImageResponse } from "next/og";
import { AnilhaK, DIAMETRO_BASE } from "@/lib/marca";

const FUNDO = "#121314";

/**
 * Ícone do app em PNG, gerado do mesmo desenho 3D da marca (lib/marca.tsx).
 * `margem` reduz a anilha para a área segura dos ícones "maskable".
 * Em tamanhos pequenos (favicon) usa a versão simples, sem entalhes.
 */
export function desenharIcone(tamanho: number, margem = 0.22): ImageResponse {
  const escala = (1 - margem * 2) / DIAMETRO_BASE;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: FUNDO }}>
        <svg width={tamanho} height={tamanho} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <g transform={`translate(256 256) scale(${escala}) translate(-256 -256)`}>
            {AnilhaK({ id: "ic", simples: tamanho <= 64 })}
          </g>
        </svg>
      </div>
    ),
    { width: tamanho, height: tamanho },
  );
}

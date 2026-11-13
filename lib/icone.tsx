import { ImageResponse } from "next/og";
import { SIMBOLO_K } from "@/lib/marca-desenho";

/** Fundo integral para recortes de instalação; a margem mantém o símbolo na área segura. */
export function desenharIcone(tamanho: number, margem = 0.22): ImageResponse {
  const escala = 512 * (1 - margem * 2) / 400;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#C83C32" }}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <g fill="#FFFFFF" transform={`translate(256 256) scale(${escala}) translate(-200 -180)`}>{SIMBOLO_K.map((d) => <path key={d} d={d} />)}</g>
      </svg>
    </div>,
    { width: tamanho, height: tamanho },
  );
}

// Marca Kalyft em 3D: uma anilha vermelha com aro dourado e um "K" em relevo. Tudo é desenhado em SVG
// (gradientes, sombras e brilho), então fica nítido em qualquer tamanho e não depende de arquivo de imagem.
// O mesmo desenho serve para a tela (componente) e para os ícones PNG (lib/icone.tsx).

/** Proporção do diâmetro da anilha em relação ao quadro (usada para calcular a margem dos ícones). */
export const DIAMETRO_BASE = 408 / 512;

const K = "M178 140H228V232L300 140H358L278 244L364 372H304L246 280L228 302V372H178Z";

/** Anilha 3D. `simples` tira entalhes e relevo fino, para tamanhos muito pequenos (favicon). */
export function AnilhaK({ id = "k", simples = false }: { id?: string; simples?: boolean }) {
  const g = (n: string) => `${id}-${n}`;
  const ref = (n: string) => `url(#${g(n)})`;
  return (
    <g>
      <defs>
        <linearGradient id={g("aro-fora")} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#4a4d51" />
          <stop offset="1" stopColor="#09090a" />
        </linearGradient>
        <linearGradient id={g("ouro")} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#f2d25c" />
          <stop offset="1" stopColor="#a67812" />
        </linearGradient>
        <linearGradient id={g("ouro-dentro")} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#8a6410" />
          <stop offset="1" stopColor="#fbe7a0" />
        </linearGradient>
        <radialGradient id={g("rosto")} cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#f5675a" />
          <stop offset="0.5" stopColor="#d93a2e" />
          <stop offset="1" stopColor="#8a1d15" />
        </radialGradient>
        <linearGradient id={g("brilho")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g("letra")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dcd5c8" />
        </linearGradient>
        <linearGradient id={g("entalhe")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a120c" />
          <stop offset="1" stopColor="#ab2b21" />
        </linearGradient>
        <filter id={g("desfoque")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={g("desfoque-letra")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <circle cx="256" cy="272" r="204" fill="#000" opacity="0.6" filter={ref("desfoque")} />
      <circle cx="256" cy="256" r="204" fill={ref("aro-fora")} />
      <circle cx="256" cy="256" r="196" fill={ref("ouro")} />
      <circle cx="256" cy="256" r="170" fill={ref("ouro-dentro")} />
      <circle cx="256" cy="256" r="165" fill={ref("rosto")} />
      <circle cx="256" cy="256" r="165" fill={ref("brilho")} />

      {simples ? null : (
        <g>
          <circle cx="256" cy="258" r="134" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" />
          <circle cx="256" cy="256" r="134" fill="none" stroke="#3a0905" strokeOpacity="0.55" strokeWidth="3" />
          {[108, 362].map((x) => (
            <g key={x}>
              <rect x={x} y="246" width="42" height="26" rx="5" fill="#fff" opacity="0.25" />
              <rect x={x} y="243" width="42" height="26" rx="5" fill={ref("entalhe")} />
            </g>
          ))}
        </g>
      )}

      <g transform="translate(-15 0)">
        <path d={K} transform="translate(0 8)" fill="#000" opacity="0.4" filter={ref("desfoque-letra")} />
        {[5, 3].map((d, i) => (
          <path key={d} d={K} transform={`translate(${d * 0.3} ${d})`} fill={["#a8a297", "#c2bcb0"][i]} />
        ))}
        <path d={K} fill={ref("letra")} />
        {/* fenda que corta a haste do K, alinhada com os entalhes da anilha */}
        <rect x="150" y="253" width="96" height="10" fill="#cf3529" />
        <rect x="150" y="263" width="96" height="2" fill="#fff" opacity="0.2" />
      </g>
    </g>
  );
}

/** Ícone para a tela. */
export function IconeKalyft({ tamanho = 40, simples = false, id }: { tamanho?: number; simples?: boolean; id?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 512 512" role="img" aria-label="Kalyft" xmlns="http://www.w3.org/2000/svg">
      <AnilhaK id={id ?? `k${tamanho}${simples ? "s" : ""}`} simples={simples} />
    </svg>
  );
}

/** Logotipo escrito, pesado e chapado, (estilo em globals.css, classe `logotipo`). */
export function Logotipo({ className = "" }: { className?: string }) {
  return (
    <span className={`logotipo ${className}`} aria-label="Kalyft">
      <span aria-hidden="true">Kaly</span>
      <span aria-hidden="true" className="logotipo-ft">ft</span>
    </span>
  );
}

import { NOME_KALYFT, SIMBOLO_K } from "./marca-desenho";

export function SimboloK() {
  return <>{SIMBOLO_K.map((d) => <path key={d} d={d} />)}</>;
}

export function IconeKalyft({ tamanho = 40, className = "" }: { tamanho?: number; simples?: boolean; id?: string; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 400 400" role="img" aria-label="Kalyft" className={`brand-symbol ${className}`} xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0 20)" fill="currentColor"><SimboloK /></g>
    </svg>
  );
}

export function Logotipo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1160 360" role="img" aria-label="Kalyft" className={`brand-logo ${className}`} xmlns="http://www.w3.org/2000/svg">
      <g className="brand-mark"><SimboloK /></g>
      <g transform="translate(466 85) scale(1.24)" fill="currentColor" fillRule="evenodd">{NOME_KALYFT.map((d) => <path key={d} d={d} />)}</g>
    </svg>
  );
}

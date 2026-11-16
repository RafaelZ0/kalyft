import { Check } from "lucide-react";
import type { Etapa } from "@/lib/jornada";
import { CAPITULOS } from "@/lib/jornada-textos";

/**
 * Trilha dos capítulos: círculos ligados SÓ pelos espaços entre eles. Capítulo atual destacado; os anteriores
 * aparecem concluídos. "Plano" some quando não há treino nem alimentação no caminho (antes de escolher o foco).
 */
export function Trilha({ etapa, aplicaveis }: { etapa: Etapa; aplicaveis: Etapa[] }) {
  const capitulos = CAPITULOS.filter((c) => c.etapas.some((e) => aplicaveis.includes(e)));
  const atual = capitulos.findIndex((c) => (c.etapas as readonly Etapa[]).includes(etapa));
  return (
    <nav aria-label="Etapas do seu começo">
      <ol className="flex items-start">
        {capitulos.map((c, i) => {
          const feito = i < atual;
          const agora = i === atual;
          return (
            <li key={c.id} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <div className="flex w-full items-center">
                <span aria-hidden="true" className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= atual ? "bg-marca" : "bg-linha"}`} />
                <span
                  aria-current={agora ? "step" : undefined}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    feito ? "border-marca bg-marca text-sobre-destaque" : agora ? "border-marca text-marca" : "border-linha text-suave"
                  }`}
                >
                  {feito ? <Check size={16} aria-hidden="true" /> : i + 1}
                  <span className="sr-only">{feito ? " (concluído)" : agora ? " (atual)" : ""}</span>
                </span>
                <span aria-hidden="true" className={`h-0.5 flex-1 ${i === capitulos.length - 1 ? "bg-transparent" : i < atual ? "bg-marca" : "bg-linha"}`} />
              </div>
              <span className={`text-[11px] font-semibold ${agora ? "text-texto" : "text-suave"}`}>{c.rotulo}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

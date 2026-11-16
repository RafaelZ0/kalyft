import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Kalu } from "@/components/kalu";
import { adiarJornadaAcao } from "../comecar/actions";

/** Convite para a jornada inicial no Hoje. Dispensável ("Agora não" adia; retomável em Conta). Não bloqueia nada. */
export function ConviteJornada({ continuar }: { continuar: boolean }) {
  return (
    <section aria-labelledby="convite-jornada" className="app-card space-y-4">
      <div className="flex items-center gap-3">
        <Kalu pose="acolher" tamanho="pequeno" />
        <div>
          <h2 id="convite-jornada" className="section-heading">{continuar ? "Continue seu começo" : "Monte seu começo com o Kalu"}</h2>
          <p className="text-sm text-suave">{continuar ? "Suas respostas estão guardadas. Siga de onde parou." : "Alguns passos curtos para o app caber na sua rotina."}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/comecar" className="action-primary">{continuar ? "Continuar" : "Começar"}<ArrowRight size={18} aria-hidden="true" /></Link>
        <form action={adiarJornadaAcao}>
          <button type="submit" className="min-h-11 px-2 text-sm font-semibold text-suave underline-offset-4 hover:underline">Agora não</button>
        </form>
      </div>
    </section>
  );
}

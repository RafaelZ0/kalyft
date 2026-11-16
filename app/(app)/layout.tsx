import { exigirContextoDados } from "@/lib/auth/acompanhamento";
import { ContextoDadosProvider } from "@/components/contexto-dados";
import { FaixaAcompanhamento } from "./faixa-acompanhamento";
import Link from "next/link";
import { Logotipo } from "@/lib/marca";
import { BarraAbas } from "./barra-abas";
import { Suspense } from "react";
import { FaixaLembrete } from "./faixa-lembrete";
import { TutorialInicial } from "@/components/tutorial-inicial";
import { obterTutorial } from "@/lib/dal/jornada";
import { passosPara } from "@/lib/tutorial-inicial";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  // Barreira de UX. Cada página e Server Action verifica a sessão de novo.
  const contexto = await exigirContextoDados();
  // Passeio pelo app: só na conta própria e quando a pessoa pediu (estado "em andamento").
  const tutorial = contexto.modo === "proprio" ? await obterTutorial(contexto.userId) : null;
  const passeio = tutorial?.tutorial.estado === "em_andamento" && tutorial.tutorial.passo ? { passos: passosPara(tutorial.area), atual: tutorial.tutorial.passo } : null;
  const publico = { contextoId: contexto.contextoId, modo: contexto.modo, podeEditar: contexto.podeEditar, podeVerFotos: contexto.podeVerFotos, edicaoAte: contexto.edicaoAte?.toISOString() ?? null };
  return (
    <ContextoDadosProvider contexto={publico}>
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">Ir para o conteúdo</a>
      <BarraAbas />
      <main id="conteudo" className="app-content">
        <FaixaAcompanhamento contexto={publico} nome={contexto.nome} />
        <header className="app-topbar">
          <Link href="/hoje" aria-label="Kalyft, início" className="mobile-brand inline-flex min-h-11 items-center"><Logotipo /></Link>
          <p className="eyebrow hidden lg:block">{contexto.modo === "proprio" ? "Seu acompanhamento" : `Acompanhando ${contexto.nome}`}</p>
        </header>
        {contexto.modo === "proprio" ? <Suspense fallback={null}><FaixaLembrete /></Suspense> : null}
        {children}
      </main>
      {passeio ? <TutorialInicial passos={passeio.passos} atual={passeio.atual} /> : null}
    </div>
    </ContextoDadosProvider>
  );
}

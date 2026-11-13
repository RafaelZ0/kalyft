import { exigirContextoDados } from "@/lib/auth/acompanhamento";
import { ContextoDadosProvider } from "@/components/contexto-dados";
import { FaixaAcompanhamento } from "./faixa-acompanhamento";
import Link from "next/link";
import { Logotipo } from "@/lib/marca";
import { SeletorAparencia } from "@/components/aparencia";
import { BarraAbas } from "./barra-abas";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  // Barreira de UX. Cada página e Server Action verifica a sessão de novo.
  const contexto = await exigirContextoDados();
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
          <SeletorAparencia compacto />
        </header>
        {children}
      </main>
    </div>
    </ContextoDadosProvider>
  );
}

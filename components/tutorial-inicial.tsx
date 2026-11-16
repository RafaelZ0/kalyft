"use client";

// Passeio pelo app nas telas reais. Um destaque por vez, sem bloquear toques (o destaque não recebe cliques) e sem
// cobrir o elemento destacado (o cartão vai para o topo quando o alvo está embaixo). Voltar, avançar e pular
// sempre visíveis. Se o alvo não existir, explica e segue. Navegar por conta própria pausa o passeio.
// Posições são aplicadas pelo JavaScript depois de montar (CSSOM), compatível com a CSP do app.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Kalu } from "@/components/kalu";
import { vizinhos, type PassoTutorial } from "@/lib/tutorial-inicial";
import { concluirTutorialAcao, irParaPassoAcao, pularTutorialAcao } from "@/app/(app)/tutorial-actions";

const ESPERA_ALVO_MS = 2500;

function Botao({ children, primario = false }: { children: React.ReactNode; primario?: boolean }) {
  return (
    <button type="submit" className={primario ? "action-primary min-h-11 px-4" : "min-h-11 rounded-xl px-3 text-sm font-semibold text-suave hover:text-texto"}>
      {children}
    </button>
  );
}

function Passo({ passos, passo }: { passos: PassoTutorial[]; passo: PassoTutorial }) {
  const { indice, anterior, proximo } = vizinhos(passos, passo.id);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [procurando, setProcurando] = useState(true);
  const titulo = useRef<HTMLHeadingElement>(null);
  const destaque = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alvo: Element | null = null;
    let ativo = true;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inicio = Date.now();
    const medir = () => {
      if (ativo && alvo) setRect(alvo.getBoundingClientRect());
    };
    const procurar = () => {
      if (!ativo) return;
      alvo = document.querySelector(`[data-tour="${CSS.escape(passo.alvo)}"]`);
      if (alvo) {
        alvo.scrollIntoView({ block: "center", behavior: reduzir ? "auto" : "smooth" });
        setProcurando(false);
        window.setTimeout(medir, reduzir ? 0 : 350);
      } else if (Date.now() - inicio < ESPERA_ALVO_MS) {
        window.setTimeout(procurar, 150);
      } else {
        setProcurando(false);
      }
    };
    const timer = window.setTimeout(procurar, 0);
    const aoMudar = () => window.requestAnimationFrame(medir);
    window.addEventListener("scroll", aoMudar, true);
    window.addEventListener("resize", aoMudar);
    titulo.current?.focus();
    return () => {
      ativo = false;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", aoMudar, true);
      window.removeEventListener("resize", aoMudar);
    };
  }, [passo.alvo]);

  // Posição do destaque via CSSOM (permitido pela CSP; nada de atributo style no HTML).
  useEffect(() => {
    const d = destaque.current;
    if (!d || !rect) return;
    d.style.top = `${rect.top - 6}px`;
    d.style.left = `${rect.left - 6}px`;
    d.style.width = `${rect.width + 12}px`;
    d.style.height = `${rect.height + 12}px`;
  }, [rect]);

  const alvoEmbaixo = rect !== null && rect.bottom > window.innerHeight - 300;
  const naoEncontrado = !procurando && rect === null;

  return (
    <>
      {rect ? <div ref={destaque} aria-hidden="true" className="pointer-events-none fixed z-40 rounded-2xl ring-[3px] ring-marca motion-safe:transition-all" /> : null}
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-titulo"
        className={`fixed inset-x-4 z-50 space-y-3 rounded-2xl border border-linha bg-superficie p-4 shadow-lg lg:left-auto lg:right-6 lg:w-[380px] ${
          alvoEmbaixo ? "top-[max(1rem,env(safe-area-inset-top))]" : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6"
        }`}
      >
        <div className="flex items-start gap-3">
          <Kalu pose="explicar" tamanho="pequeno" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-suave">
              Passeio pelo app · {indice + 1} de {passos.length}
            </p>
            <h2 id="tutorial-titulo" ref={titulo} tabIndex={-1} className="text-lg font-bold outline-none">
              {passo.titulo}
            </h2>
          </div>
        </div>
        <p className="text-sm leading-relaxed">{passo.texto}</p>
        {naoEncontrado ? (
          <p className="text-sm text-suave">Esse item não aparece nesta tela agora (depende dos seus registros). Você pode seguir para o próximo passo.</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <form action={pularTutorialAcao}>
            <Botao>Pular passeio</Botao>
          </form>
          <div className="flex items-center gap-1">
            {anterior ? (
              <form action={irParaPassoAcao}>
                <input type="hidden" name="passo" value={anterior.id} />
                <Botao>Voltar</Botao>
              </form>
            ) : null}
            {proximo ? (
              <form action={irParaPassoAcao}>
                <input type="hidden" name="passo" value={proximo.id} />
                <Botao primario>Próximo</Botao>
              </form>
            ) : (
              <form action={concluirTutorialAcao}>
                <Botao primario>Concluir</Botao>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

/** Mostra o passo atual na tela certa; em outra tela, só um aviso discreto para continuar ou encerrar. */
export function TutorialInicial({ passos, atual }: { passos: PassoTutorial[]; atual: string }) {
  const caminho = usePathname();
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMontado(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!montado || passos.length === 0) return null;
  const { indice } = vizinhos(passos, atual);
  const passo = passos[indice];

  if (caminho !== passo.rota) {
    return (
      <section aria-label="Passeio pelo app pausado" className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-wrap items-center gap-2 rounded-2xl border border-linha bg-superficie p-3 shadow-lg lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px]">
        <p className="mr-auto text-sm font-semibold">Passeio pelo app pausado</p>
        <form action={pularTutorialAcao}>
          <Botao>Encerrar</Botao>
        </form>
        <form action={irParaPassoAcao}>
          <input type="hidden" name="passo" value={passo.id} />
          <Botao primario>Continuar</Botao>
        </form>
      </section>
    );
  }
  return <Passo key={passo.id} passos={passos} passo={passo} />;
}

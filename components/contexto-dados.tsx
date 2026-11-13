"use client";

import { createContext, Fragment, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/** Apenas permissões e um marcador: nunca identifica o titular nem concede acesso. */
export type ContextoDadosPublico = {
  contextoId: string;
  modo: "proprio" | "acompanhamento";
  podeEditar: boolean;
  podeVerFotos: boolean;
  edicaoAte: string | null;
};

const PROPRIO: ContextoDadosPublico = {
  contextoId: "proprio", modo: "proprio", podeEditar: true, podeVerFotos: true, edicaoAte: null,
};
const ContextoDados = createContext<ContextoDadosPublico>(PROPRIO);

export function ContextoDadosProvider({ contexto, children }: { contexto: ContextoDadosPublico; children?: ReactNode }) {
  const router = useRouter();
  const [prazoVencido, setPrazoVencido] = useState<string | null>(() => contexto.edicaoAte && new Date(contexto.edicaoAte).getTime() <= Date.now() ? contexto.edicaoAte : null);
  const expirado = contexto.modo === "acompanhamento" && contexto.edicaoAte !== null
    && prazoVencido === contexto.edicaoAte;

  useEffect(() => {
    if (contexto.modo !== "acompanhamento") return;
    const atualizar = () => router.refresh();
    const aoVoltar = () => { if (document.visibilityState === "visible") atualizar(); };
    window.addEventListener("focus", atualizar);
    document.addEventListener("visibilitychange", aoVoltar);
    // Revalida também o acesso às fotos após revogação em outro aparelho.
    const intervalo = window.setInterval(atualizar, 25_000);
    let prazo: number | null = null;
    const agendarPrazo = () => {
      if (!contexto.edicaoAte) return;
      const restante = new Date(contexto.edicaoAte).getTime() - Date.now();
      prazo = window.setTimeout(() => {
        if (new Date(contexto.edicaoAte!).getTime() > Date.now()) {
          agendarPrazo();
          return;
        }
        setPrazoVencido(contexto.edicaoAte);
        atualizar();
      }, Math.max(0, Math.min(restante + 50, 2_147_483_647)));
    };
    agendarPrazo();
    return () => {
      window.removeEventListener("focus", atualizar);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(intervalo);
      if (prazo !== null) window.clearTimeout(prazo);
    };
  }, [contexto.modo, contexto.contextoId, contexto.edicaoAte, router]);

  return (
    <ContextoDados.Provider value={expirado ? { ...contexto, podeEditar: false } : contexto}>
      <Fragment key={contexto.contextoId}>{children}</Fragment>
    </ContextoDados.Provider>
  );
}

export function useContextoDados() {
  return useContext(ContextoDados);
}

export function SomenteContaPropria({ children }: { children: ReactNode }) {
  return useContextoDados().modo === "proprio" ? children : null;
}

export function CampoContexto() {
  const { contextoId } = useContextoDados();
  return <input type="hidden" name="contextoId" value={contextoId} />;
}

/** Mantém o contrato de form, incluindo action, onSubmit, método, ref e classes. */
export function FormDados({ children, ...props }: ComponentProps<"form">) {
  const contexto = useContextoDados();
  const leitura = contexto.modo === "acompanhamento" && !contexto.podeEditar && props.method?.toLowerCase() !== "get";
  const espacamento = props.className?.split(/\s+/).filter((classe) => /(^|:)space-[xy]-/.test(classe)).join(" ") ?? "";
  return (
    <form {...props}>
      <CampoContexto />
      {leitura ? <p role="status" className="mb-3 text-sm text-suave">Somente leitura. Solicite autorização para alterar.</p> : null}
      {leitura ? <fieldset disabled className={`contents ${espacamento}`}>{children}</fieldset> : children}
    </form>
  );
}

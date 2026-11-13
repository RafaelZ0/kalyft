"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { CHAVE_APARENCIA, normalizarAparencia, resolverTema, type Aparencia } from "@/lib/aparencia";

const EVENTO = "kalyft-aparencia-alterada";
function ler(): Aparencia {
  return normalizarAparencia(document.documentElement.dataset.aparencia);
}
function observar(atualizar: () => void) {
  const sincronizar = (e: StorageEvent) => {
    if (e.key === CHAVE_APARENCIA || e.key === null) {
      document.documentElement.setAttribute("data-aparencia", normalizarAparencia(e.newValue));
      atualizar();
    }
  };
  window.addEventListener(EVENTO, atualizar);
  window.addEventListener("storage", sincronizar);
  return () => { window.removeEventListener(EVENTO, atualizar); window.removeEventListener("storage", sincronizar); };
}
const servidor = (): Aparencia => "sistema";

/** Mantém a aparência e a cor do navegador sincronizadas em todas as páginas, sem controles visíveis. */
export function SincronizarAparencia() {
  const preferencia = useSyncExternalStore(observar, ler, servidor);
  useEffect(() => {
    const sistema = window.matchMedia("(prefers-color-scheme: dark)");
    const atualizar = () => {
      const tema = resolverTema(ler(), sistema.matches);
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
        meta.removeAttribute("media");
        meta.content = tema === "escuro" ? "#151817" : "#F7F5F2";
      });
    };
    atualizar();
    sistema.addEventListener("change", atualizar);
    return () => sistema.removeEventListener("change", atualizar);
  }, [preferencia]);
  return null;
}

export function SeletorAparencia() {
  const preferencia = useSyncExternalStore(observar, ler, servidor);
  function escolher(valor: string) {
    const p = normalizarAparencia(valor);
    document.documentElement.setAttribute("data-aparencia", p);
    try { localStorage.setItem(CHAVE_APARENCIA, p); } catch { /* Vale nesta visita mesmo sem armazenamento. */ }
    window.dispatchEvent(new Event(EVENTO));
  }

  return (
    <fieldset className="space-y-4">
      <legend className="section-heading">Aparência</legend>
      <p className="text-sm text-suave">Escolha como o Kalyft aparece neste dispositivo. No modo Sistema, ele acompanha seu telefone.</p>
      <div className="grid grid-cols-3 gap-2">
        {([{ valor: "sistema", nome: "Sistema", Icone: Monitor }, { valor: "claro", nome: "Claro", Icone: Sun }, { valor: "escuro", nome: "Escuro", Icone: Moon }] as const).map(({ valor, nome, Icone }) => (
          <label key={valor} className="cursor-pointer">
            <input type="radio" name="aparencia" value={valor} checked={preferencia === valor} onChange={() => escolher(valor)} className="peer sr-only" />
            <span className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-borda bg-fundo text-sm font-semibold text-suave peer-checked:border-marca peer-checked:bg-marca-suave peer-checked:text-marca peer-focus-visible:outline-2 peer-focus-visible:outline-marca"><Icone size={23} aria-hidden="true" />{nome}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

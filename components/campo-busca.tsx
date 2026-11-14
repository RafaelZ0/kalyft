import { Search } from "lucide-react";

/** Campo "O que você quer fazer?": envia para /buscar por GET, funciona sem JavaScript. */
export function CampoBusca({ valor = "", autoFocus = false }: { valor?: string; autoFocus?: boolean }) {
  return (
    <form action="/buscar" method="get" role="search" className="campo-busca">
      <Search size={20} className="shrink-0 text-suave" aria-hidden="true" />
      <label htmlFor="busca-funcoes" className="sr-only">O que você quer fazer?</label>
      <input
        id="busca-funcoes"
        name="q"
        type="search"
        defaultValue={valor}
        maxLength={60}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        placeholder="O que você quer fazer?"
        className="min-h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-suave"
      />
    </form>
  );
}

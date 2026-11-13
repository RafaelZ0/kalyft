import type { ContextoDadosPublico } from "@/components/contexto-dados";
import { encerrarAcompanhamento } from "./ajustes/alunos/actions";
import { FormularioSolicitacao } from "./ajustes/acompanhamento/formularios";

export function FaixaAcompanhamento({ contexto, nome }: { contexto: ContextoDadosPublico; nome: string }) {
  if (contexto.modo !== "acompanhamento") return null;
  const prazo = contexto.edicaoAte ? new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
  }).format(new Date(contexto.edicaoAte)) : null;
  return (
    <aside aria-label="Contexto de acompanhamento" className="sticky top-0 z-40 -mx-5 mb-6 space-y-3 border-b-2 border-marca bg-fundo px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4">
      <div>
        <p className="font-bold">Acompanhando: {nome}</p>
        <p className="text-sm text-suave">{contexto.podeEditar && prazo ? `Edição autorizada até ${prazo} (São Paulo)` : "Somente leitura"}</p>
      </div>
      <form action={encerrarAcompanhamento}>
        <button className="min-h-12 w-full rounded-full bg-destaque px-4 font-bold text-sobre-destaque">Voltar para minha conta</button>
      </form>
      {(!contexto.podeEditar || !contexto.podeVerFotos) ? <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold underline underline-offset-4">Permissões do acompanhamento</summary>
        <div className="mt-2 grid gap-3">
          {!contexto.podeEditar ? <FormularioSolicitacao tipo="edicao" /> : null}
          {!contexto.podeVerFotos ? <FormularioSolicitacao tipo="fotos" /> : <p className="text-sm text-suave">Fotos autorizadas para visualização.</p>}
        </div>
      </details> : null}
    </aside>
  );
}

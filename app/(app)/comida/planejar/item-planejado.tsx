import { Check } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import type { Planejado } from "@/lib/dal/planejamento";
import { removerPlanejadoAcao } from "./actions";
import { BotaoComiIsso } from "./botoes";

const qtd = (p: Planejado) =>
  p.tipo === "alimento"
    ? `${p.quantidade.toLocaleString("pt-BR")} g`
    : p.tipo === "receita"
      ? `${p.quantidade.toLocaleString("pt-BR")} ${p.quantidade === 1 ? "porção" : "porções"}`
      : `${p.quantidade.toLocaleString("pt-BR")}×`;

const ROTULO_TIPO = { receita: "receita", salva: "refeição salva", alimento: "alimento" } as const;

/** Linha de item planejado: nome, quantidade e ações. "Comi isso" só no dia ou depois; consumido fica marcado. */
export function ItemPlanejado({ p, hoje }: { p: Planejado; hoje: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-linha py-2 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-semibold ${p.consumido ? "text-suave" : ""}`}>{p.nome}</span>
        <span className="block text-xs text-suave">{qtd(p)} · {ROTULO_TIPO[p.tipo]}</span>
      </span>
      {p.consumido ? (
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ok"><Check size={16} aria-hidden="true" />Comido</span>
      ) : (
        <span className="flex shrink-0 items-center gap-1">
          {p.data <= hoje ? <BotaoComiIsso id={p.id} nome={p.nome} /> : null}
          <FormDados action={removerPlanejadoAcao}>
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" aria-label={`Tirar ${p.nome} do planejamento`} className="min-h-11 px-2 text-sm font-semibold text-suave underline">Tirar</button>
          </FormDados>
        </span>
      )}
    </li>
  );
}

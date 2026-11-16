"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Aviso, BotaoEnviar } from "@/components/ui";
import type { MudancaPerfil, PlanoPesagem } from "@/lib/jornada-aplicacao";
import { finalizarJornadaAcao, type EstadoJornadaForm } from "./actions";

export type SecaoResumo = { id: string; titulo: string; editar: string; linhas: Array<[string, string]> };

const fmt = (campo: string, v: string | number | null): string => {
  if (v === null || v === "") return "vazio";
  if (campo === "alturaCm") return `${String(v).replace(".", ",")} cm`;
  if (campo === "dataNascimento") return String(v).split("-").reverse().join("/");
  return String(v);
};
const kg = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
const dataBr = (d: string) => d.split("-").reverse().join("/");

/**
 * Revisão final. Mostra o que foi respondido (com "Editar" por seção), o que pode ir para a conta ao lado do valor
 * atual e a decisão sobre a pesagem. Os valores aplicados vêm do servidor; aqui só se escolhe o que trocar.
 */
export function Revisao({
  revisao,
  secoes,
  mudancas,
  rotulos,
  rotulosValor,
  pesagem,
}: {
  revisao: number;
  secoes: SecaoResumo[];
  mudancas: MudancaPerfil[];
  rotulos: Record<string, string>;
  rotulosValor: Record<string, string>;
  pesagem: PlanoPesagem;
}) {
  const [estado, acao] = useActionState<EstadoJornadaForm, FormData>(finalizarJornadaAcao, {});
  const valor = (campo: string, v: string | number | null) => rotulosValor[`${campo}:${v}`] ?? fmt(campo, v);
  return (
    <form action={acao} className="space-y-8">
      <input type="hidden" name="revisao" value={revisao} />

      {secoes.map((s) => (
        <section key={s.id} aria-labelledby={`sec-${s.id}`} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`sec-${s.id}`} className="section-heading">{s.titulo}</h2>
            <Link href={s.editar} className="action-link">Editar<span className="sr-only"> {s.titulo}</span></Link>
          </div>
          <dl className="divide-y divide-linha">
            {s.linhas.map(([r, v]) => (
              <div key={r} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="text-suave">{r}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section aria-labelledby="conta" className="app-card space-y-4">
        <h2 id="conta" className="section-heading">O que vai para a sua conta</h2>
        {mudancas.length === 0 && (pesagem.tipo === "nenhuma" || pesagem.tipo === "igual") ? (
          <p className="text-sm text-suave">Nada do seu perfil muda. Suas escolhas ficam guardadas para personalizar o app.</p>
        ) : null}
        {mudancas.map((m) => (
          <label key={m.campo} className="flex min-h-12 cursor-pointer items-start gap-3">
            <input type="checkbox" name="aplicar" value={m.campo} defaultChecked={m.padrao} className="mt-1 size-6 shrink-0 accent-marca" />
            <input type="hidden" name={`visto_${m.campo}`} value={m.atual === null ? "" : String(m.atual)} />
            <span>
              <span className="block font-semibold">{rotulos[m.campo]}: {valor(m.campo, m.novo)}</span>
              <span className="block text-sm text-suave">
                {m.atual === null ? "Ainda não preenchido no seu perfil." : `Hoje está ${valor(m.campo, m.atual)}. Marque para trocar.`}
              </span>
            </span>
          </label>
        ))}

        {pesagem.tipo === "nova" ? (
          <label className="flex min-h-12 cursor-pointer items-start gap-3">
            <input type="checkbox" name="pesagem" value="registrar" defaultChecked className="mt-1 size-6 shrink-0 accent-marca" />
            <span>
              <span className="block font-semibold">Registrar pesagem: {kg(pesagem.pesoKg)} em {dataBr(pesagem.data)}</span>
              <span className="block text-sm text-suave">Entra no seu histórico de peso.</span>
            </span>
          </label>
        ) : null}
        {pesagem.tipo === "existente" ? (
          <fieldset className="space-y-2">
            <legend className="font-semibold">
              Já existe uma pesagem em {dataBr(pesagem.data)}: {kg(pesagem.pesoAtualKg)}. Você informou {kg(pesagem.pesoKg)}.
            </legend>
            <input type="hidden" name="pesoVisto" value={pesagem.pesoAtualKg} />
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="radio" name="pesagem" value="manter" defaultChecked className="size-5 accent-marca" />
              Manter {kg(pesagem.pesoAtualKg)}
            </label>
            {pesagem.podeSubstituir ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="radio" name="pesagem" value="substituir" className="size-5 accent-marca" />
                Trocar por {kg(pesagem.pesoKg)} (massa magra e cintura continuam)
              </label>
            ) : (
              <p className="text-sm text-suave">Não dá para trocar: a massa magra registrada nesse dia é maior que o novo peso.</p>
            )}
          </fieldset>
        ) : null}
        {pesagem.tipo === "sem_data" ? (
          <p className="text-sm text-suave">O peso de {kg(pesagem.pesoKg)} não vira pesagem porque está sem data. Você pode registrar em Progresso.</p>
        ) : null}
        {pesagem.tipo === "igual" ? <p className="text-sm text-suave">A pesagem de {dataBr(pesagem.data)} já está registrada com esse peso.</p> : null}
        <p className="text-sm text-suave">Metas de calorias e o plano de treino não são criados aqui: eles têm confirmação própria no app.</p>
      </section>

      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.conflito ? <a href="/comecar" className="action-secondary w-full">Recarregar a revisão</a> : null}
      <BotaoEnviar pendente="Confirmando…">Confirmar meu começo</BotaoEnviar>
    </form>
  );
}

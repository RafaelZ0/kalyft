"use client";
import { Droplets } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { Barra } from "@/components/graficos";
import { BOTOES_AGUA } from "@/lib/treino";
import { adicionarAgua, adicionarAguaLivre, desfazerAgua, type EstadoAgua } from "./agua";

export function PainelAgua({ data, totalMl, metaMl, editavel, compacto = false }: { data: string; totalMl: number; metaMl: number | null; editavel: boolean; compacto?: boolean }) {
  const [estado, acaoLivre] = useActionState<EstadoAgua, FormData>(adicionarAguaLivre, {});
  const pct = metaMl ? (totalMl / metaMl) * 100 : 0;
  const litros = (ml: number) => (ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  const valorLivre = (
    <FormDados action={acaoLivre} className="flex items-end gap-3" noValidate>
      <input type="hidden" name="data" value={data} />
      <div className="flex-1">
        <Campo nome="ml" rotulo="Outro valor" teclado="numeric" sufixo="ml" maxLength={4} erro={estado.erros?.ml} />
      </div>
      <div className="w-32">
        <BotaoEnviar pendente="…">Somar</BotaoEnviar>
      </div>
    </FormDados>
  );

  return (
    <section aria-labelledby="agua" className="app-card space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 id="agua" className="section-heading flex items-center gap-3"><Droplets size={21} className="text-marca" aria-hidden="true" />Água</h2>
        <span className="font-semibold">
          {litros(totalMl)} L{metaMl ? <span className="text-suave"> / {litros(metaMl)} L</span> : null}
        </span>
      </div>
      {metaMl ? <Barra percentual={pct} /> : <p className="text-sm text-suave">Defina a meta de água em Ajustes.</p>}
      {editavel ? (
        <>
          <FormDados action={adicionarAgua} className="grid grid-cols-3 gap-3">
            <input type="hidden" name="data" value={data} />
            {BOTOES_AGUA.map((ml) => (
              <button key={ml} type="submit" name="ml" value={ml} className="action-secondary px-2 text-sm active:border-marca">
                + {ml} ml
              </button>
            ))}
          </FormDados>
          {compacto ? (
            <details open={Boolean(estado.erros?.ml || estado.erro)}>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-suave">Outro valor</summary>
              {valorLivre}
            </details>
          ) : valorLivre}
          {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
          {totalMl > 0 ? (
            <FormDados action={desfazerAgua}>
              <input type="hidden" name="data" value={data} />
              <button type="submit" className="min-h-11 text-sm font-semibold text-suave underline">
                Desfazer o último
              </button>
            </FormDados>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

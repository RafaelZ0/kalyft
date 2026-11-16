"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import type { Etapa } from "@/lib/jornada";
import { OPCOES } from "@/lib/jornada-textos";
import { salvarEtapaAcao, type EstadoJornadaForm } from "./actions";

type Valores = Record<string, unknown>;
const texto = (v: unknown) => (v === undefined || v === null ? "" : String(v).replace(".", ","));
const lista = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

function Erro({ id, texto: t }: { id: string; texto?: string }) {
  if (!t) return null;
  return (
    <span id={id} className="mt-1 block text-sm text-erro">
      <AlertCircle size={16} className="mr-1 inline" aria-hidden="true" />
      {t}
    </span>
  );
}

/** Escolha única em cartões grandes. Controlada quando outra pergunta depende dela. */
function Escolha({ nome, rotulo, valor, onChange, erro }: { nome: string; rotulo: string; valor: string; onChange?: (v: string) => void; erro?: string }) {
  return (
    <fieldset aria-describedby={erro ? `${nome}-erro` : undefined}>
      <legend className="mb-2 block text-sm font-medium text-suave">{rotulo}</legend>
      <div className="grid gap-2">
        {OPCOES[nome].map(([v, r, d]) => (
          <label key={v} className="cursor-pointer">
            <input
              type="radio"
              name={nome}
              value={v}
              {...(onChange ? { checked: valor === v, onChange: () => onChange(v) } : { defaultChecked: valor === v })}
              className="peer sr-only"
            />
            <span className="flex min-h-12 flex-col justify-center rounded-xl border border-borda px-4 py-2 peer-checked:border-marca peer-checked:bg-marca-suave peer-focus-visible:outline-2 peer-focus-visible:outline-destaque">
              <span className="font-semibold">{r}</span>
              {d ? <span className="text-sm text-suave">{d}</span> : null}
            </span>
          </label>
        ))}
      </div>
      <Erro id={`${nome}-erro`} texto={erro} />
    </fieldset>
  );
}

function Selecao({ nome, rotulo, valor, dica, erro }: { nome: string; rotulo: string; valor: string; dica?: string; erro?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-suave">{rotulo}</span>
      <select
        name={nome}
        defaultValue={valor}
        aria-invalid={erro ? true : undefined}
        className="min-h-12 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none focus:border-marca"
      >
        <option value="">Escolher ou deixar para depois</option>
        {OPCOES[nome].map(([v, r]) => (
          <option key={v} value={v}>{r}</option>
        ))}
      </select>
      {dica ? <span className="mt-1.5 block text-sm text-suave">{dica}</span> : null}
      <Erro id={`${nome}-erro`} texto={erro} />
    </label>
  );
}

function Caixas({ nome, rotulo, valores, colunas = 2, erro }: { nome: string; rotulo: string; valores: string[]; colunas?: 2 | 4; erro?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-suave">{rotulo}</legend>
      <div className={`grid gap-2 ${colunas === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
        {OPCOES[nome].map(([v, r]) => (
          <label key={v} className="cursor-pointer">
            <input type="checkbox" name={nome} value={v} defaultChecked={valores.includes(v)} className="peer sr-only" />
            <span className="flex min-h-12 items-center justify-center rounded-xl border border-borda px-2 text-center text-sm font-semibold text-suave peer-checked:border-marca peer-checked:bg-marca-suave peer-checked:text-marca peer-focus-visible:outline-2 peer-focus-visible:outline-destaque">
              {r}
            </span>
          </label>
        ))}
      </div>
      <Erro id={`${nome}-erro`} texto={erro} />
    </fieldset>
  );
}

export function FormularioEtapa({
  etapa,
  revisao,
  valores,
  pulavel,
  voltar,
}: {
  etapa: Etapa;
  revisao: number;
  valores: Valores;
  pulavel: boolean;
  voltar: string | null;
}) {
  const [estado, acao] = useActionState<EstadoJornadaForm, FormData>(salvarEtapaAcao, {});
  const [area, setArea] = useState(texto(valores.area));
  const [objetivo, setObjetivo] = useState(texto(valores.objetivo));
  const [exercicio, setExercicio] = useState(texto(valores.exercicio));
  const e = estado.erros ?? {};

  return (
    <form action={acao} className="space-y-6" noValidate>
      <input type="hidden" name="etapa" value={etapa} />
      <input type="hidden" name="revisao" value={revisao} />

      {etapa === "foco" ? (
        <>
          <Escolha nome="area" rotulo="Por onde quer começar?" valor={area} onChange={setArea} erro={e.area} />
          {area === "ambos" ? <Escolha nome="primeira" rotulo="Qual área vamos configurar primeiro?" valor={texto(valores.primeira)} erro={e.primeira} /> : null}
        </>
      ) : null}

      {etapa === "perfil" ? (
        <>
          <Campo nome="nome" rotulo="Como quer ser chamado? · opcional" valor={texto(valores.nome)} maxLength={80} erro={e.nome} autoComplete="given-name" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo nome="nascimento" rotulo="Nascimento" tipo="date" valor={texto(valores.nascimento)} erro={e.nascimento} />
            <Selecao nome="sexo" rotulo="Sexo usado no cálculo" valor={texto(valores.sexo)} dica="Algumas fórmulas usam esse dado. Pode deixar para depois." erro={e.sexo} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Campo nome="alturaCm" rotulo="Altura" teclado="decimal" sufixo="cm" valor={texto(valores.alturaCm)} erro={e.alturaCm} maxLength={6} />
            <Campo nome="pesoKg" rotulo="Peso atual" teclado="decimal" sufixo="kg" valor={texto(valores.pesoKg)} erro={e.pesoKg} maxLength={6} dica="Aceita vírgula: 78,5" />
          </div>
          <Campo nome="dataPesagem" rotulo="Quando foi essa pesagem?" tipo="date" valor={texto(valores.dataPesagem)} erro={e.dataPesagem} dica="Sem a data, o peso não vira uma pesagem registrada." />
        </>
      ) : null}

      {etapa === "objetivo" ? (
        <>
          <Escolha nome="objetivo" rotulo="Seu foco principal" valor={objetivo} onChange={setObjetivo} erro={e.objetivo} />
          {["reduzir", "manter", "massa"].includes(objetivo) ? (
            <Campo nome="pesoReferenciaKg" rotulo="Peso de referência · opcional" teclado="decimal" sufixo="kg" valor={texto(valores.pesoReferenciaKg)} erro={e.pesoReferenciaKg} maxLength={6} dica="Não vira meta sozinho. Você pode definir ou revisar depois." />
          ) : null}
        </>
      ) : null}

      {etapa === "rotina" ? (
        <>
          <Escolha nome="trabalho" rotulo="Na maior parte do dia, eu…" valor={texto(valores.trabalho)} erro={e.trabalho} />
          <Selecao nome="deslocamento" rotulo="Como costuma se deslocar?" valor={texto(valores.deslocamento)} erro={e.deslocamento} />
        </>
      ) : null}

      {etapa === "atividade" ? (
        <>
          <Escolha nome="exercicio" rotulo="Como está sua atividade hoje?" valor={exercicio} onChange={setExercicio} erro={e.exercicio} />
          {exercicio === "regular" || exercicio === "voltando" ? (
            <>
              <Caixas nome="tipos" rotulo="O que você costuma fazer?" valores={lista(valores.tipos)} erro={e.tipos} />
              <div className="grid grid-cols-2 gap-4">
                <Campo nome="diasPorSemana" rotulo="Dias por semana" teclado="numeric" valor={texto(valores.diasPorSemana)} erro={e.diasPorSemana} maxLength={1} dica="De 1 a 7." />
                <Campo nome="minutos" rotulo="Minutos por vez" teclado="numeric" valor={texto(valores.minutos)} erro={e.minutos} maxLength={3} />
              </div>
            </>
          ) : null}
          <Selecao nome="nivelDeclarado" rotulo="Já conhece seu nível de atividade? · opcional" valor={texto(valores.nivelDeclarado)} dica="Pode deixar em branco e revisar depois." erro={e.nivelDeclarado} />
        </>
      ) : null}

      {etapa === "treino" ? (
        <>
          <Escolha nome="metodo" rotulo="Como prefere começar?" valor={texto(valores.metodo)} erro={e.metodo} />
          <Selecao nome="experiencia" rotulo="Sua experiência com treino" valor={texto(valores.experiencia)} erro={e.experiencia} />
          <Selecao nome="local" rotulo="Onde pretende treinar?" valor={texto(valores.local)} erro={e.local} />
          <Caixas nome="equipamentos" rotulo="O que terá disponível? · opcional" valores={lista(valores.equipamentos)} erro={e.equipamentos} />
          <Caixas nome="diasSemana" rotulo="Quais dias podem caber na sua rotina?" valores={lista(valores.diasSemana)} colunas={4} erro={e.diasSemana} />
          <Campo nome="minutosSessao" rotulo="Tempo disponível por sessão" teclado="numeric" sufixo="min" valor={texto(valores.minutosSessao)} erro={e.minutosSessao} maxLength={3} dica="É uma intenção, não um treino realizado." />
          <Selecao nome="limitacao" rotulo="Alguma limitação a considerar? · opcional" valor={texto(valores.limitacao)} erro={e.limitacao} />
        </>
      ) : null}

      {etapa === "alimentacao" ? (
        <>
          <Escolha nome="metodo" rotulo="Como prefere começar?" valor={texto(valores.metodo)} erro={e.metodo} />
          <Selecao nome="preferencia" rotulo="Preferência alimentar · opcional" valor={texto(valores.preferencia)} erro={e.preferencia} />
          <Selecao nome="restricao" rotulo="Alguma restrição a considerar? · opcional" valor={texto(valores.restricao)} erro={e.restricao} />
          <Selecao nome="alergia" rotulo="Alergia alimentar · opcional" valor={texto(valores.alergia)} dica="A revisão dos ingredientes continua necessária." erro={e.alergia} />
          <div className="grid grid-cols-2 gap-4">
            <Campo nome="refeicoesPorDia" rotulo="Refeições por dia" teclado="numeric" valor={texto(valores.refeicoesPorDia)} erro={e.refeicoesPorDia} maxLength={2} />
            <Campo nome="minutosPreparo" rotulo="Minutos para preparar" teclado="numeric" valor={texto(valores.minutosPreparo)} erro={e.minutosPreparo} maxLength={3} dica="Pode ser zero." />
          </div>
          <Selecao nome="planejamento" rotulo="Quer conhecer o planejamento semanal?" valor={texto(valores.planejamento)} erro={e.planejamento} />
        </>
      ) : null}

      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.conflito ? (
        <a href="/comecar" className="action-secondary w-full">Recarregar</a>
      ) : null}

      <div className="space-y-3 pt-2">
        <BotaoEnviar pendente="Salvando…">Continuar</BotaoEnviar>
        <div className="flex items-center justify-between gap-3">
          {voltar ? (
            <Link href={voltar} className="action-link gap-1"><ArrowLeft size={18} aria-hidden="true" />Voltar</Link>
          ) : <span />}
          {pulavel ? (
            <button type="submit" name="pular" value="1" formNoValidate className="min-h-11 px-2 font-semibold text-suave underline-offset-4 hover:underline">
              Agora não
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

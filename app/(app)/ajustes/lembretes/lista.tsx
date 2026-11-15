"use client";

import { useActionState, useState } from "react";
import { Aviso, BotaoEnviar, BotaoSecundario } from "@/components/ui";
import { DIAS_LEMBRETE, HORAS_LEMBRETE, MINUTOS_LEMBRETE, nomeDoLembrete, TIPOS_LEMBRETE, textoDias, textoHorario, TODOS_OS_DIAS, type TipoLembrete } from "@/lib/lembretes";
import { REFEICOES, ROTULOS_REFEICAO, type Refeicao } from "@/lib/validacao/comida";
import { apagarLembreteAcao, atualizarLembreteAcao, criarLembreteAcao, type EstadoLembrete } from "./actions";

export type LembreteTela = {
  id: string;
  tipo: TipoLembrete;
  refeicao: Refeicao | null;
  minuto: number;
  dias: number;
  ativo: boolean;
  silenciarFeito: boolean;
  pausadoAte: string | null;
};

const ROTULO_TIPO: Record<TipoLembrete, string> = { refeicao: "Refeição", agua: "Água", peso: "Pesagem", treino: "Treino" };
const TEXTO_FEITO: Record<TipoLembrete, string> = {
  refeicao: "Não avisar se a refeição já foi registrada",
  agua: "Não avisar se a meta de água do dia já foi atingida",
  peso: "Não avisar se já pesei no dia",
  treino: "Não avisar se o treino do dia já foi registrado",
};

const chip =
  "flex min-h-12 items-center justify-center rounded-xl border border-borda px-4 text-sm font-semibold text-suave peer-checked:border-marca peer-checked:bg-marca-suave peer-checked:text-marca peer-focus-visible:outline-2 peer-focus-visible:outline-destaque";
const seletor = "min-h-12 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none focus:border-marca";

function Formulario({
  inicial,
  acao,
  rotulo,
  onCancelar,
}: {
  inicial: LembreteTela | null;
  acao: (e: EstadoLembrete, f: FormData) => Promise<EstadoLembrete>;
  rotulo: string;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoLembrete>(inicial?.tipo ?? "refeicao");
  const [estado, enviar] = useActionState(async (anterior: EstadoLembrete, form: FormData) => {
    const r = await acao(anterior, form);
    if (r.ok) onCancelar();
    return r;
  }, {});
  const hora = inicial ? Math.floor(inicial.minuto / 60) : 12;
  const min = inicial ? inicial.minuto % 60 : 0;
  const dias = inicial?.dias ?? TODOS_OS_DIAS;

  return (
    <form action={enviar} className="space-y-5 rounded-2xl border border-linha p-4">
      {inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-suave">Lembrar de</legend>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_LEMBRETE.map((t) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="peer sr-only" />
              <span className={chip}>{ROTULO_TIPO[t]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {tipo === "refeicao" ? (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Qual refeição</span>
          <select name="refeicao" defaultValue={inicial?.refeicao ?? "almoco"} className={seletor}>
            {REFEICOES.map((r) => <option key={r} value={r}>{ROTULOS_REFEICAO[r]}</option>)}
          </select>
        </label>
      ) : null}
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-suave">Horário</legend>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="sr-only">Hora</span>
            <select name="hora" defaultValue={hora} className={seletor}>
              {HORAS_LEMBRETE.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")} h</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Minutos</span>
            <select name="min" defaultValue={min} className={seletor}>
              {MINUTOS_LEMBRETE.map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")} min</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-suave">Dias</legend>
        <div className="grid grid-cols-7 gap-1">
          {DIAS_LEMBRETE.map((d) => (
            <label key={d.bit} className="cursor-pointer">
              <input type="checkbox" name="dias" value={d.bit} defaultChecked={(dias & d.bit) !== 0} className="peer sr-only" />
              <span className={`${chip} px-0`} aria-label={d.nome}>{d.curto}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="silenciarFeito" defaultChecked={inicial?.silenciarFeito ?? true} className="size-6 accent-marca" />
        <span>{TEXTO_FEITO[tipo]}</span>
      </label>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="ativo" defaultChecked={inicial?.ativo ?? true} className="size-6 accent-marca" />
        <span>Ativo</span>
      </label>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <div className="grid grid-cols-2 gap-2">
        <BotaoSecundario onClick={onCancelar}>Cancelar</BotaoSecundario>
        <BotaoEnviar>{rotulo}</BotaoEnviar>
      </div>
    </form>
  );
}

function Item({ l, hoje }: { l: LembreteTela; hoje: string }) {
  const [editando, setEditando] = useState(false);
  if (editando) return <li><Formulario inicial={l} acao={atualizarLembreteAcao} rotulo="Salvar" onCancelar={() => setEditando(false)} /></li>;
  const pausado = l.pausadoAte !== null && l.pausadoAte >= hoje;
  return (
    <li className="flex min-h-16 items-center justify-between gap-3 border-b border-linha py-3">
      <div className="min-w-0">
        <p className="text-lg font-bold">
          <span className="tabular-nums">{textoHorario(l.minuto)}</span> · {nomeDoLembrete(l)}
        </p>
        <p className="text-sm text-suave">
          {textoDias(l.dias)}
          {!l.ativo ? " · desligado" : pausado ? " · pausado" : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <BotaoSecundario onClick={() => setEditando(true)}>Editar</BotaoSecundario>
        <form action={apagarLembreteAcao}>
          <input type="hidden" name="id" value={l.id} />
          <button type="submit" className="action-secondary" aria-label={`Apagar lembrete ${nomeDoLembrete(l)} às ${textoHorario(l.minuto)}`}>Apagar</button>
        </form>
      </div>
    </li>
  );
}

export function ListaLembretes({ lembretes, hoje, podeCriar }: { lembretes: LembreteTela[]; hoje: string; podeCriar: boolean }) {
  const [criando, setCriando] = useState(false);
  return (
    <div className="space-y-4">
      {lembretes.length === 0 ? <p className="text-suave">Nenhum lembrete ainda.</p> : null}
      <ul>{lembretes.map((l) => <Item key={l.id} l={l} hoje={hoje} />)}</ul>
      {criando ? (
        <Formulario inicial={null} acao={criarLembreteAcao} rotulo="Criar lembrete" onCancelar={() => setCriando(false)} />
      ) : podeCriar ? (
        <button type="button" onClick={() => setCriando(true)} className="action-secondary w-full">Novo lembrete</button>
      ) : (
        <p className="text-sm text-suave">Você chegou ao limite de lembretes. Apague um para criar outro.</p>
      )}
    </div>
  );
}

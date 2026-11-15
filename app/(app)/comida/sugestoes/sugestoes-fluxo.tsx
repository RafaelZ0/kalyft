"use client";

import { useActionState, useState } from "react";
import { ChefHat, Clock } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { Aviso, BotaoEnviar, BotaoSecundario } from "@/components/ui";
import { AVISO_NAO_ENVIADO } from "@/lib/ia/prompts";
import { COBERTURA_MINIMA } from "@/lib/ia/refeicao";
import { LIMITES_SUGESTAO, montarEntradaSugestao, PREFERENCIAS, TEMPOS_SUGESTAO, type Preferencia, type TempoSugestao } from "@/lib/ia/sugestao";
import { REFEICOES, ROTULOS_REFEICAO, type Refeicao } from "@/lib/validacao/comida";
import { Revisao, type ItemEditavel } from "../ia/fluxo";
import { EditorReceita, type IngredienteEditavel } from "../receitas/editor";
import { sugerirRefeicoes, type EstadoSugestao, type OpcaoComCandidatos } from "./actions";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const AVISO_IA = "Sugestão gerada por IA. Confira os alimentos e as porções. Não substitui orientação de nutricionista.";

/** Melhor alimento do banco para o ingrediente, se o casamento for confiável. */
const escolhidoDe = (i: OpcaoComCandidatos["ingredientes"][number]) => ((i.candidatos[0]?.cobertura ?? 0) >= COBERTURA_MINIMA ? i.candidatos[0] : null);

function kcalDaOpcao(o: OpcaoComCandidatos): { kcal: number; parcial: boolean } {
  let kcal = 0;
  let parcial = false;
  for (const i of o.ingredientes) {
    const c = escolhidoDe(i);
    if (c?.kcal != null) kcal += (c.kcal * i.gramas) / 100;
    else parcial = true;
  }
  return { kcal, parcial };
}

export function SugestoesFluxo(props: {
  data: string;
  refeicaoInicial: Refeicao;
  restante: { kcal: number | null; proteinaG: number | null } | null;
  restanteUso: number;
  restanteEstimativa: number;
  gratuito: boolean;
}) {
  const [refeicao, setRefeicao] = useState<Refeicao>(props.refeicaoInicial);
  const [opcoes, setOpcoes] = useState<OpcaoComCandidatos[] | null>(null);
  const [registrar, setRegistrar] = useState<ItemEditavel[] | null>(null);
  const [receita, setReceita] = useState<{ nome: string; itens: IngredienteEditavel[] } | null>(null);

  if (registrar) {
    return (
      <Revisao
        data={props.data}
        refeicao={refeicao}
        rotuloRefeicao={ROTULOS_REFEICAO[refeicao]}
        restanteEstimativa={props.restanteEstimativa}
        origem="ia_texto"
        itens={registrar}
        setItens={(f) => setRegistrar((l) => f(l))}
        descartados={0}
        aoVoltar={() => setRegistrar(null)}
        rotuloVoltar="Voltar às sugestões"
      />
    );
  }
  if (receita) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-aviso p-3 text-sm text-aviso">{AVISO_IA} Ajuste os ingredientes, as porções e o peso final antes de salvar.</p>
        <EditorReceita nomeInicial={receita.nome} porcoesInicial={1} pesoFinalInicial="" itensIniciais={receita.itens} iaDisponivel={false} />
        <BotaoSecundario onClick={() => setReceita(null)}>Voltar às sugestões</BotaoSecundario>
      </div>
    );
  }
  if (opcoes) {
    return (
      <div className="space-y-6">
        <p className="rounded-2xl border border-aviso p-3 text-sm font-medium text-aviso"><span aria-hidden="true">! </span>{AVISO_IA}</p>
        {opcoes.map((o, k) => {
          const { kcal, parcial } = kcalDaOpcao(o);
          return (
            <section key={k} aria-labelledby={`opcao-${k}`} className="app-card space-y-4">
              <div className="flex items-start gap-3">
                <span className="icon-badge"><ChefHat size={20} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <h2 id={`opcao-${k}`} className="section-heading">{o.nome}</h2>
                  <p className="text-sm text-suave">
                    {o.tempoMin ? <><Clock size={14} className="mr-1 inline" aria-hidden="true" />{o.tempoMin} min · </> : null}
                    ≈ {fmt(kcal)} kcal{parcial ? " (parcial: algum ingrediente sem correspondência na tabela)" : ""} · estimativa
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Ingredientes (1 porção)</h3>
                <ul className="text-sm">
                  {o.ingredientes.map((i, n) => {
                    const c = escolhidoDe(i);
                    return (
                      <li key={n} className="flex justify-between gap-3 border-b border-linha py-1.5 last:border-b-0">
                        <span>{i.nome}{c ? <span className="block text-xs text-suave">tabela: {c.nome}</span> : <span className="block text-xs text-aviso">sem correspondência na tabela</span>}</span>
                        <span className="shrink-0 tabular-nums text-suave">{fmt(i.gramas)} g</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {o.passos.length ? (
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Como fazer</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">{o.passos.map((p, n) => <li key={n}>{p}</li>)}</ol>
                </div>
              ) : null}
              {o.substituicoes.length ? <p className="text-sm text-suave">Trocas possíveis: {o.substituicoes.join("; ")}.</p> : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="action-primary"
                  onClick={() =>
                    setRegistrar(o.ingredientes.map((i, n) => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade, gramas: i.gramas, confianca: "media", chave: n, candidatos: i.candidatos, escolhido: escolhidoDe(i) })))
                  }
                >
                  Registrar no {ROTULOS_REFEICAO[refeicao].toLowerCase()}
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() =>
                    setReceita({
                      nome: o.nome,
                      itens: o.ingredientes.flatMap((i, n) => {
                        const c = escolhidoDe(i);
                        return c ? [{ chave: n, tipo: c.tipo, id: c.id, nome: c.nome, gramas: i.gramas, kcal100: c.kcal }] : [];
                      }),
                    })
                  }
                >
                  Salvar como receita
                </button>
              </div>
            </section>
          );
        })}
        <BotaoSecundario onClick={() => setOpcoes(null)}>Pedir outras sugestões</BotaoSecundario>
      </div>
    );
  }
  return <Pedido {...props} refeicao={refeicao} setRefeicao={setRefeicao} aoReceber={setOpcoes} />;
}

function Pedido({ refeicao, setRefeicao, restante, restanteUso, gratuito, aoReceber }: {
  refeicao: Refeicao;
  setRefeicao: (r: Refeicao) => void;
  restante: { kcal: number | null; proteinaG: number | null } | null;
  restanteUso: number;
  gratuito: boolean;
  aoReceber: (o: OpcaoComCandidatos[]) => void;
}) {
  const [ingredientes, setIngredientes] = useState("");
  const [tempo, setTempo] = useState<TempoSugestao>(20);
  const [preferencias, setPreferencias] = useState<Preferencia[]>([]);
  const [observacao, setObservacao] = useState("");
  const [usarMeta, setUsarMeta] = useState(false);
  const [estado, acao] = useActionState<EstadoSugestao, FormData>(async (anterior, form) => {
    const r = await sugerirRefeicoes(anterior, form);
    if (r.opcoes) aoReceber(r.opcoes);
    return r;
  }, {});
  const temRestante = restante !== null && ((restante.kcal ?? 0) > 0 || (restante.proteinaG ?? 0) > 0);
  const entrada = montarEntradaSugestao({ ingredientes, tempo, refeicao, preferencias, observacao, restante: usarMeta ? restante : null });

  return (
    <FormDados action={acao} className="space-y-6" noValidate>
      <input type="hidden" name="tempo" value={tempo} />
      <section className="app-card space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">O que você tem em casa?</span>
          <textarea
            name="ingredientes"
            value={ingredientes}
            onChange={(e) => setIngredientes(e.target.value)}
            maxLength={LIMITES_SUGESTAO.ingredientesMax}
            rows={3}
            placeholder="Ex.: ovos, tomate, arroz cozido, queijo"
            className="w-full rounded-2xl border border-linha bg-fundo p-4 text-base outline-none placeholder:text-suave focus:border-marca"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-suave">Tempo disponível</legend>
          <div className="flex flex-wrap gap-2">
            {TEMPOS_SUGESTAO.map((t) => (
              <button key={t} type="button" aria-pressed={tempo === t} onClick={() => setTempo(t)} className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${tempo === t ? "bg-destaque text-sobre-destaque" : "border border-borda text-suave"}`}>
                {t} min
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Refeição</span>
          <select name="refeicao" value={refeicao} onChange={(e) => setRefeicao(e.target.value as Refeicao)} className="min-h-12 w-full rounded-xl border border-borda bg-superficie px-3 text-base font-semibold">
            {REFEICOES.map((r) => <option key={r} value={r}>{ROTULOS_REFEICAO[r]}</option>)}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-suave">Preferências (opcional)</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PREFERENCIAS) as Preferencia[]).map((p) => (
              <label key={p} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-borda px-4 text-sm has-[:checked]:border-marca has-[:checked]:font-semibold">
                <input type="checkbox" name="preferencias" value={p} checked={preferencias.includes(p)} onChange={(e) => setPreferencias((l) => (e.target.checked ? [...l, p] : l.filter((x) => x !== p)))} className="sr-only" />
                {PREFERENCIAS[p]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Observação (opcional)</span>
          <input name="observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={LIMITES_SUGESTAO.observacaoMax} placeholder="Ex.: sem fritura" className="min-h-12 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none focus:border-marca" />
        </label>
        {temRestante ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" name="usarMeta" checked={usarMeta} onChange={(e) => setUsarMeta(e.target.checked)} className="size-5 accent-[var(--color-marca)]" />
            Usar o quanto falta da minha meta de hoje
          </label>
        ) : null}
      </section>

      <section aria-labelledby="previa-sugestao" className="app-card space-y-2">
        <h2 id="previa-sugestao" className="text-lg font-bold">O que será enviado ao Google</h2>
        {entrada ? (
          <dl className="space-y-1 text-sm">
            {entrada.linhas.map((l) => (
              <div key={l.rotulo}><dt className="inline font-semibold">{l.rotulo}: </dt><dd className="inline">{l.valor}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="text-suave">Escreva os ingredientes para ver o que será enviado.</p>
        )}
        <p className="text-sm text-suave">{AVISO_NAO_ENVIADO}</p>
        {gratuito ? <p className="text-sm text-suave">No plano gratuito, o Google pode usar o conteúdo para melhorar seus produtos. Não escreva dados pessoais.</p> : null}
      </section>
      <p className="text-sm text-suave">Nada é registrado sem você conferir. Restam {restanteUso} sugestões hoje.</p>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar pendente="A IA está pensando…">Sugerir refeições</BotaoEnviar>
    </FormDados>
  );
}

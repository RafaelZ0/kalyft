import { FormDados } from "@/components/contexto-dados";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Camera, Target } from "lucide-react";
import { GraficoLinhas } from "@/components/graficos";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { datasDeAplicacao, listarPesagens, obterDiaAplicacao } from "@/lib/dal/corpo";
import { metaVigente } from "@/lib/dal/metas";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { formatarGramas } from "@/lib/nutricao";
import { aplicacaoPendente, diasEntre, massaGorda, NOMES_DIA, tendenciaDoPeso } from "@/lib/treino";
import { apagarPesagem, desfazerAplicacao, marcarAplicacao, salvarDiaAplicacao } from "./actions";
import { periodoValido } from "@/lib/painel-energia";
import { FormPesagem } from "./form-pesagem";
import { GraficosProgresso } from "./graficos-progresso";

export const metadata = { title: "Progresso · Kalyft" };

const txt = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export default async function PaginaProgresso(props: PageProps<"/progresso">) {
  const { userId, modo } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const periodo = periodoValido((await props.searchParams).periodo);
  const [lista, meta, diaAplic, aplicacoes] = await Promise.all([
    listarPesagens(userId, somarDias(hoje, -120), 400),
    metaVigente(userId, hoje),
    modo === "proprio" ? obterDiaAplicacao(userId) : Promise.resolve(null),
    modo === "proprio" ? datasDeAplicacao(userId, somarDias(hoje, -30)) : Promise.resolve([]),
  ]);

  const crescente = [...lista].reverse();
  const tendencia = tendenciaDoPeso(crescente.map((p) => ({ data: p.data, peso: p.pesoKg })));
  const primeira = tendencia[0]?.data;
  const x = (data: string) => diasEntre(primeira!, data);
  const ultima = lista[0];
  const hojeJa = lista.find((p) => p.data === hoje) ?? null;
  const tendenciaAtual = tendencia.at(-1)?.tendencia ?? null;
  const gorda = ultima ? massaGorda(ultima.pesoKg, ultima.massaMagraKg) : null;
  const pendente = aplicacaoPendente(hoje, diaAplic, aplicacoes);

  return (
    <div className="page-stack">
      <header className="space-y-2"><h1 className="page-heading">Progresso</h1><p className="page-intro">Acompanhe o percurso, além do número.</p></header>

      <section aria-labelledby="peso" className="app-card space-y-5">
        <div className="space-y-1"><h2 id="peso" className="section-heading">Peso e tendência</h2><p className="text-sm text-suave">{ultima ? `Último registro em ${formatarDataBr(ultima.data)}` : "Seu primeiro registro é o começo do acompanhamento."}</p></div>
        {ultima ? (
          <dl className="grid grid-cols-1 gap-4 rounded-2xl bg-fundo p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-suave">Último</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatarGramas(ultima.pesoKg)} kg</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Tendência</dt>
              <dd className="text-2xl font-semibold tabular-nums">{tendenciaAtual === null ? "—" : `${formatarGramas(tendenciaAtual)} kg`}</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Massa gorda</dt>
              <dd className="text-2xl font-semibold tabular-nums">{gorda === null ? "—" : `${formatarGramas(gorda)} kg`}</dd>
            </div>
          </dl>
        ) : null}
        {tendencia.length >= 2 ? (
          <>
            <GraficoLinhas
              titulo="Peso e tendência nos últimos 120 dias"
              unidade="kg"
              linhaMeta={meta?.pesoMetaKg ?? null}
              rotulosX={[formatarDataBr(tendencia[0].data), formatarDataBr(tendencia.at(-1)!.data)]}
              series={[
                { nome: "Peso", tipo: "pontos", pontos: tendencia.map((p) => ({ x: x(p.data), y: p.peso })) },
                { nome: "Tendência", tipo: "linha", pontos: tendencia.map((p) => ({ x: x(p.data), y: p.tendencia })) },
              ]}
            />
            <p className="text-xs text-suave">
              Pontos: pesagens do dia. Linha: tendência (média que suaviza água e sal). A tendência é uma estimativa.
            </p>
          </>
        ) : (
          <p className="text-suave">O gráfico aparece a partir da segunda pesagem.</p>
        )}
        <FormPesagem
          hoje={hoje}
          atual={hojeJa ? { peso: txt(hojeJa.pesoKg), massaMagra: txt(hojeJa.massaMagraKg), cintura: txt(hojeJa.cinturaCm) } : null}
        />
        {lista.length > 0 ? (
          <details>
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-suave">Pesagens recentes</summary>
            <ul>
              {lista.slice(0, 15).map((p) => (
                <li key={p.id} className="flex min-h-12 items-center justify-between border-b border-linha text-sm">
                  <span>
                    {formatarDataBr(p.data)} · <span className="font-semibold">{formatarGramas(p.pesoKg)} kg</span>
                    {p.cinturaCm ? <span className="text-suave"> · cintura {formatarGramas(p.cinturaCm)} cm</span> : null}
                  </span>
                  <FormDados action={apagarPesagem}>
                    <input type="hidden" name="pesagemId" value={p.id} />
                    <button type="submit" className="min-h-11 px-3 font-semibold text-suave underline">
                      Apagar
                    </button>
                  </FormDados>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <GraficosProgresso userId={userId} hoje={hoje} periodo={periodo} />

      <section aria-labelledby="explorar-progresso" className="app-card space-y-4">
        <h2 id="explorar-progresso" className="section-heading">Seu acompanhamento</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            { href: "/progresso/semana", titulo: "Resumo da semana", texto: "Alimentação, treinos e peso em uma visão da sua semana.", Icone: CalendarDays },
            { href: "/progresso/fotos", titulo: "Fotos de progresso", texto: "Seu percurso em fotos. Compartilhe somente se autorizar.", Icone: Camera },
            { href: "/progresso/meta", titulo: "Meta e plano", texto: "Sua referência diária e a projeção do peso.", Icone: Target },
          ].map(({ href, titulo, texto, Icone }) => (
            <Link key={href} href={href} className="app-card group space-y-3 transition-colors hover:border-marca">
              <div className="flex items-center justify-between"><span className="icon-badge"><Icone size={20} aria-hidden="true" /></span><ArrowUpRight size={18} className="text-suave" aria-hidden="true" /></div>
              <span className="block font-semibold">{titulo}</span>
              <span className="block text-sm leading-relaxed text-suave">{texto}</span>
            </Link>
          ))}
        </div>
      </section>

      {modo === "proprio" ? <section aria-labelledby="aplicacao" className="app-card space-y-4">
        <h2 id="aplicacao" className="section-heading">Aplicação semanal</h2>
        <p className="text-sm text-suave">Só um registro de &quot;feito&quot; no dia que você escolher. O app não dá orientação sobre medicação.</p>
        <FormDados action={salvarDiaAplicacao} className="flex items-end gap-3">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-suave">Lembrete aos</span>
            <select
              name="dia"
              defaultValue={diaAplic === null ? "" : String(diaAplic)}
              className="min-h-12 w-full rounded-xl border border-borda bg-superficie px-3 text-lg font-semibold"
            >
              <option value="">Sem lembrete</option>
              {NOMES_DIA.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-12 rounded-xl border border-borda px-5 font-semibold">
            Salvar
          </button>
        </FormDados>
        {pendente ? (
          <FormDados action={marcarAplicacao} className="space-y-2 rounded-2xl border border-marca p-4">
            <p className="font-semibold">Hoje é o dia da aplicação.</p>
            <input type="hidden" name="data" value={hoje} />
            <button type="submit" className="min-h-12 w-full rounded-xl bg-destaque font-bold text-sobre-destaque">
              Marcar como feita
            </button>
          </FormDados>
        ) : null}
        {aplicacoes.length > 0 ? (
          <div className="text-sm text-suave">
            Última: {formatarDataBr(aplicacoes[0])}
            {aplicacoes[0] === hoje ? (
              <FormDados action={desfazerAplicacao} className="inline">
                <input type="hidden" name="data" value={hoje} />
                <button type="submit" className="ml-2 min-h-11 font-semibold underline">
                  Desfazer
                </button>
              </FormDados>
            ) : null}
          </div>
        ) : null}
      </section> : null}
    </div>
  );
}

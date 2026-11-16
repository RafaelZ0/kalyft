import Link from "next/link";
import { CartaoGrafico, PoucosDados } from "@/components/cartao-grafico";
import { GraficoBarras, GraficoLinhas } from "@/components/graficos";
import { carregarEnergia } from "@/lib/dal/energia";
import { listarSessoes } from "@/lib/dal/treino";
import { formatarDataBr, somarDias } from "@/lib/datas";
import { deficitAcumulado, PERIODOS, ROTULOS_PERIODO, type Periodo } from "@/lib/painel-energia";
import { mediaPorSemana, perdaRealPelaTendencia, treinosPorSemana } from "@/lib/progresso-graficos";
import { ABAS_GRAFICO, ROTULOS_ABA, type AbaGrafico } from "@/lib/progresso-resumo";
import { diasEntre, tendenciaDoPeso } from "@/lib/treino";

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
/** kg sempre com uma casa ("2,0 kg", "151,8 kg"). */
const kg1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dm = (d: string) => formatarDataBr(d).slice(0, 5);
const rotSemana = (d: string) => `sem. ${dm(d)}`;
const POUCO = "Registre mais dias para ver o gráfico.";

/** Gráficos de progresso: uma aba por vez, com seletor de período. Dados do titular (DAL com user_id). */
export async function GraficosProgresso({ userId, hoje, periodo, aba }: { userId: string; hoje: string; periodo: Periodo; aba: AbaGrafico }) {
  const dias = PERIODOS[periodo];
  const desde = somarDias(hoje, -dias);
  const dados = await carregarEnergia(userId, hoje, Math.max(dias, 60));
  const sessoes = await listarSessoes(userId, desde, hoje);

  const consumo = dados.consumo.filter((d) => d.data >= desde);
  const gasto = dados.painel.gasto?.valor ?? null;
  const metaProt = dados.meta?.proteinaG ?? null;
  const semanal = periodo !== "4s";

  const seletor = (
    <nav aria-label="Período dos gráficos" className="flex gap-2">
      {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
        <Link
          key={p}
          href={`/progresso?aba=${aba}&periodo=${p}#graficos`}
          aria-current={p === periodo ? "true" : undefined}
          className={`flex min-h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold ${p === periodo ? "border-marca bg-marca-suave text-marca" : "border-borda text-suave"}`}
        >
          {ROTULOS_PERIODO[p]}
        </Link>
      ))}
    </nav>
  );

  const abas = (
    <nav aria-label="Gráfico" className="flex flex-wrap gap-2">
      {ABAS_GRAFICO.map((a) => (
        <Link
          key={a}
          href={`/progresso?aba=${a}&periodo=${periodo}#graficos`}
          aria-current={a === aba ? "true" : undefined}
          className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${a === aba ? "bg-destaque text-sobre-destaque" : "border border-borda text-suave"}`}
        >
          {ROTULOS_ABA[a]}
        </Link>
      ))}
    </nav>
  );

  // Calorias por dia (ou média por semana nos períodos longos), só dias com registro completo.
  const kcalDias = consumo.filter((d) => d.kcal !== null && d.kcal >= 800);
  const barrasKcal = semanal
    ? mediaPorSemana(consumo.map((d) => ({ data: d.data, valor: d.kcal !== null && d.kcal >= 800 ? d.kcal : null }))).map((w, i) => ({ x: i, y: w.media, rotulo: rotSemana(w.inicio) }))
    : kcalDias.map((d, i) => ({ x: i, y: Math.round(d.kcal as number), rotulo: dm(d.data) }));
  const mediaKcal = kcalDias.length ? Math.round(kcalDias.reduce((s, d) => s + (d.kcal as number), 0) / kcalDias.length) : null;

  // Peso e déficit acumulado × perda real.
  const trend = tendenciaDoPeso(dados.pesagens.map((p) => ({ data: p.data, peso: p.peso })));
  const real = perdaRealPelaTendencia(trend, desde);
  const pesoPeriodo = trend.filter((p) => p.data >= desde);
  const tendAtual = trend.at(-1)?.tendencia ?? null;
  const variacao = pesoPeriodo.length >= 2 ? Math.round((pesoPeriodo.at(-1)!.tendencia - pesoPeriodo[0].tendencia) * 10) / 10 : null;
  const metaPeso = dados.meta?.pesoMetaKg ?? null;
  const def = gasto !== null ? deficitAcumulado(consumo, gasto) : [];
  const base = real[0]?.data ?? def[0]?.data ?? desde;
  const xDia = (d: string) => Math.max(0, diasEntre(base, d));
  const defNoPeriodo = def.filter((d) => d.data >= base);
  const esperada = defNoPeriodo.length > 1 ? defNoPeriodo.at(-1)!.perdaEsperadaKg - defNoPeriodo[0].perdaEsperadaKg : null;
  const diferenca = real.length > 1 && esperada !== null ? Math.round((esperada - real.at(-1)!.perdaKg) * 10) / 10 : null;

  // Composição corporal (avaliações com massa magra).
  const comp = dados.pesagens.filter((p) => p.data >= desde && p.massaMagraKg !== null);
  const compBase = comp[0]?.data;
  const ultimaComp = comp.at(-1);
  const gorda = (p: { peso: number; massaMagraKg: number | null }) => Math.round((p.peso - (p.massaMagraKg as number)) * 10) / 10;

  // Proteína × meta.
  const protDias = consumo.filter((d) => d.proteinaG != null && d.kcal !== null && d.kcal >= 800);
  const barrasProt = semanal
    ? mediaPorSemana(consumo.map((d) => ({ data: d.data, valor: d.proteinaG != null && d.kcal !== null && d.kcal >= 800 ? d.proteinaG : null }))).map((w, i) => ({ x: i, y: w.media, rotulo: rotSemana(w.inicio) }))
    : protDias.map((d, i) => ({ x: i, y: Math.round(d.proteinaG as number), rotulo: dm(d.data) }));
  const mediaProt = protDias.length ? Math.round(protDias.reduce((s, d) => s + (d.proteinaG as number), 0) / protDias.length) : null;
  const proteinaNaMeta = metaProt ? protDias.filter((d) => (d.proteinaG as number) >= metaProt).length : null;

  // Treinos por semana.
  const semanas = treinosPorSemana(sessoes.filter((s) => s.status === "feito").map((s) => s.data));
  const totalTreinos = semanas.reduce((a, w) => a + w.total, 0);

  return (
    <section id="graficos" aria-labelledby="g-titulo" className="app-card min-w-0 scroll-mt-6 space-y-5">
      <h2 id="g-titulo" className="section-heading">Sua evolução</h2>
      {abas}
      {seletor}

      {aba === "peso" ? (
        <CartaoGrafico
          id="g-peso"
          rotulo="Peso · tendência"
          valor={tendAtual !== null ? kg1(tendAtual) : null}
          unidade="kg"
          contexto={[variacao !== null ? `${variacao > 0 ? "+" : variacao < 0 ? "−" : ""}${kg1(Math.abs(variacao))} kg no período` : null, metaPeso ? `meta ${dec(metaPeso)} kg` : null].filter(Boolean).join(" · ") || null}
          nota="Linha cheia: suas pesagens. Tracejada: tendência, uma média que suaviza água e sal. A tendência é uma estimativa."
        >
          {pesoPeriodo.length >= 3 ? (
            <GraficoLinhas
              titulo="Peso e tendência no período"
              unidade="kg"
              referencia={metaPeso}
              eixoX={{ tipo: "dias", inicio: pesoPeriodo[0].data }}
              series={[
                { nome: "Peso", tipo: "linha", pontos: pesoPeriodo.map((p) => ({ x: diasEntre(pesoPeriodo[0].data, p.data), y: p.peso })) },
                { nome: "Tendência", tipo: "tracejada", pontos: pesoPeriodo.map((p) => ({ x: diasEntre(pesoPeriodo[0].data, p.data), y: p.tendencia })) },
              ]}
            />
          ) : (
            <PoucosDados itens={pesoPeriodo.map((p) => ({ rotulo: formatarDataBr(p.data), valor: `${dec(p.peso)} kg` }))} mensagem="O gráfico aparece a partir da terceira pesagem no período." />
          )}
          <Link href="/progresso/pesagem" className="inline-flex min-h-11 items-center font-semibold text-marca underline">Registrar peso</Link>
        </CartaoGrafico>
      ) : null}

      {aba === "calorias" ? (
        <CartaoGrafico
          id="g-consumo"
          rotulo={semanal ? "Calorias · média por dia, por semana" : "Calorias por dia"}
          valor={mediaKcal !== null ? n(mediaKcal) : null}
          unidade="kcal/dia"
          contexto={
            mediaKcal !== null && gasto !== null
              ? `gasto estimado ${n(gasto)} kcal · ${mediaKcal < gasto ? `déficit médio ≈ ${n(gasto - mediaKcal)}` : `superávit médio ≈ ${n(mediaKcal - gasto)}`} kcal`
              : null
          }
          nota="Só dias com registro completo (a partir de 800 kcal). A linha é o gasto estimado de hoje. Estimativa."
        >
          {barrasKcal.length >= 3 ? (
            <GraficoBarras titulo="Calorias consumidas e gasto estimado" unidade="kcal" linha={gasto} rotuloLinha="gasto" acimaEmAtencao barras={barrasKcal} />
          ) : (
            <PoucosDados itens={barrasKcal.map((b) => ({ rotulo: b.rotulo, valor: `${n(b.y)} kcal` }))} mensagem={POUCO} />
          )}
        </CartaoGrafico>
      ) : null}

      {aba === "deficit" ? (
        <CartaoGrafico
          id="g-deficit"
          rotulo="Perda real pela tendência"
          valor={real.length >= 2 ? kg1(real.at(-1)!.perdaKg) : null}
          unidade="kg"
          contexto={esperada !== null ? `esperada pelo déficit registrado: ${dec(esperada)} kg` : null}
          nota="Tracejada: perda esperada pelo déficit registrado (7.700 kcal ≈ 1 kg). Cheia: perda real pela tendência do peso. Uma diferença grande costuma indicar registro de comida incompleto ou gasto mal estimado."
        >
          {def.length >= 3 || real.length >= 3 ? (
            <GraficoLinhas
              titulo="Perda esperada pelo déficit e perda real"
              unidade="kg"
              eixoX={{ tipo: "dias", inicio: base }}
              series={[
                { nome: "Real", tipo: "linha", pontos: real.map((r) => ({ x: xDia(r.data), y: r.perdaKg })) },
                {
                  nome: "Esperada",
                  tipo: "tracejada",
                  pontos: defNoPeriodo.map((d) => ({ x: xDia(d.data), y: Math.round((d.perdaEsperadaKg - (defNoPeriodo[0]?.perdaEsperadaKg ?? 0)) * 100) / 100 })),
                },
              ]}
            />
          ) : (
            <PoucosDados itens={[]} mensagem="Precisa de registros de comida e de pesagens no período." />
          )}
          {diferenca !== null && Math.abs(diferenca) >= 1 ? (
            <p className="rounded-2xl border-2 border-aviso p-3 text-sm font-medium text-aviso">
              <span aria-hidden="true">! </span>A diferença é de ≈ {dec(Math.abs(diferenca))} kg {diferenca > 0 ? "a menos perdidos do que o déficit indica" : "a mais perdidos do que o déficit indica"}. Pode ser registro incompleto de comida ou gasto estimado diferente do real.
            </p>
          ) : null}
        </CartaoGrafico>
      ) : null}

      {aba === "composicao" ? (
        <CartaoGrafico
          id="g-comp"
          rotulo="Massa magra"
          valor={ultimaComp ? kg1(ultimaComp.massaMagraKg as number) : null}
          unidade="kg"
          contexto={ultimaComp ? `massa gorda ${dec(gorda(ultimaComp))} kg · peso ${dec(ultimaComp.peso)} kg` : null}
          nota="Massa gorda = peso − massa magra, a cada avaliação com massa magra. Estimativa de balança."
        >
          {comp.length >= 3 ? (
            <div className="space-y-5">
              <GraficoLinhas
                titulo="Massa magra por avaliação"
                unidade="kg"
                eixoX={{ tipo: "dias", inicio: compBase! }}
                series={[{ nome: "Massa magra", tipo: "linha", pontos: comp.map((p) => ({ x: diasEntre(compBase!, p.data), y: p.massaMagraKg as number })) }]}
              />
              <h4 className="text-sm font-semibold text-suave">Massa gorda</h4>
              <GraficoLinhas
                titulo="Massa gorda por avaliação"
                unidade="kg"
                eixoX={{ tipo: "dias", inicio: compBase! }}
                series={[{ nome: "Massa gorda", tipo: "secundaria", pontos: comp.map((p) => ({ x: diasEntre(compBase!, p.data), y: gorda(p) })) }]}
              />
            </div>
          ) : (
            <PoucosDados
              itens={comp.map((p) => ({ rotulo: formatarDataBr(p.data), valor: `magra ${dec(p.massaMagraKg as number)} kg` }))}
              mensagem="Registre a massa magra em pelo menos três pesagens para ver a composição."
            />
          )}
        </CartaoGrafico>
      ) : null}

      {aba === "proteina" ? (
        <CartaoGrafico
          id="g-prot"
          rotulo={semanal ? "Proteína · média por dia, por semana" : "Proteína por dia"}
          valor={mediaProt !== null ? n(mediaProt) : null}
          unidade="g/dia"
          contexto={metaProt ? `meta ${n(metaProt)} g${proteinaNaMeta !== null ? ` · ${proteinaNaMeta} de ${protDias.length} dias na meta` : ""}` : null}
        >
          {barrasProt.length >= 3 ? (
            <GraficoBarras titulo="Proteína consumida e meta" unidade="g" linha={metaProt} rotuloLinha="meta" barras={barrasProt} />
          ) : (
            <PoucosDados itens={barrasProt.map((b) => ({ rotulo: b.rotulo, valor: `${n(b.y)} g` }))} mensagem={POUCO} />
          )}
        </CartaoGrafico>
      ) : null}

      {aba === "treinos" ? (
        <CartaoGrafico
          id="g-treino"
          rotulo="Treinos por semana"
          valor={semanas.length ? dec(Math.round((totalTreinos / semanas.length) * 10) / 10) : null}
          unidade="por semana"
          contexto={semanas.length ? `${totalTreinos} treinos em ${semanas.length} semanas` : null}
        >
          {semanas.length >= 3 ? (
            <GraficoBarras titulo="Treinos feitos por semana" unidade="treinos" barras={semanas.map((w, i) => ({ x: i, y: w.total, rotulo: rotSemana(w.inicio) }))} />
          ) : (
            <PoucosDados itens={semanas.map((w) => ({ rotulo: rotSemana(w.inicio), valor: `${w.total}` }))} mensagem={POUCO} />
          )}
        </CartaoGrafico>
      ) : null}
    </section>
  );
}

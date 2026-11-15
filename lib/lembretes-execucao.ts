import "server-only";

import { somarDias } from "@/lib/datas";
import {
  apagarInscricaoExpirada,
  feitoNoDia,
  inscricoesDasPessoas,
  lembretesCandidatos,
  limparAdiamento,
  limparEnviosAntigos,
  pausasDasPessoas,
  reservarEnvio,
} from "@/lib/dal/lembretes-envio";
import { agoraEmSaoPaulo, caminhoDoLembrete, jaFeito, lembretesDevidos, LIMITES_LEMBRETE, textoDoLembrete } from "@/lib/lembretes";
import { registrarErro } from "@/lib/log";
import type { EnviarPush } from "@/lib/push";

export type ResumoEnvio = { devidos: number; enviados: number; silenciados: number; expiradas: number; falhas: number };

/**
 * Uma execução do agendador: acha os lembretes vencidos, pula os já feitos, reserva cada envio (sem duplicar) e
 * envia para os aparelhos da pessoa. Inscrições que o serviço diz não existirem mais são apagadas.
 */
export async function enviarLembretesDevidos(agora: Date, enviar: EnviarPush): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { devidos: 0, enviados: 0, silenciados: 0, expiradas: 0, falhas: 0 };
  const candidatos = await lembretesCandidatos();
  if (candidatos.length === 0) return resumo;

  const { data: hoje } = agoraEmSaoPaulo(agora);
  const pessoas = [...new Set(candidatos.map((l) => l.userId))];
  const pausas = await pausasDasPessoas(pessoas, somarDias(hoje, -1), hoje);
  const devidos = lembretesDevidos(candidatos, agora, pausas);
  resumo.devidos = devidos.length;
  if (devidos.length === 0) return resumo;

  const porId = new Map(candidatos.map((l) => [l.id, l]));
  const inscricoes = await inscricoesDasPessoas([...new Set(devidos.map((d) => d.userId))]);
  const feitoCache = new Map<string, Awaited<ReturnType<typeof feitoNoDia>>>();
  const apagadas = new Set<string>();

  for (const envio of devidos) {
    const l = porId.get(envio.lembreteId);
    if (!l) continue;
    try {
      if (l.silenciarFeito) {
        const chave = `${l.userId}|${envio.data}`;
        if (!feitoCache.has(chave)) feitoCache.set(chave, await feitoNoDia(l.userId, envio.data));
        if (jaFeito(l, feitoCache.get(chave)!)) {
          resumo.silenciados++;
          if (envio.adiado && l.adiadoPara) await limparAdiamento(l.userId, l.id, l.adiadoPara);
          continue;
        }
      }
      if (!(await reservarEnvio(envio))) continue;
      const texto = textoDoLembrete(l);
      const carga = { titulo: texto.titulo, corpo: texto.corpo, url: caminhoDoLembrete(l), tag: `lembrete-${l.id}` };
      let algum = false;
      for (const insc of inscricoes) {
        if (insc.userId !== l.userId || apagadas.has(insc.id)) continue;
        const r = await enviar(insc, carga);
        if (r === "ok") algum = true;
        else if (r === "expirada") {
          resumo.expiradas++;
          apagadas.add(insc.id);
          await apagarInscricaoExpirada(insc.id);
        } else resumo.falhas++;
      }
      if (algum) resumo.enviados++;
      if (envio.adiado && l.adiadoPara) await limparAdiamento(l.userId, l.id, l.adiadoPara);
    } catch (e) {
      resumo.falhas++;
      registrarErro("lembretes_envio", e);
    }
  }

  try {
    await limparEnviosAntigos(new Date(agora.getTime() - LIMITES_LEMBRETE.guardarEnviosDias * 86_400_000));
  } catch (e) {
    registrarErro("lembretes_limpeza", e);
  }
  return resumo;
}

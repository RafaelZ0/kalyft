"use client";

import { useEffect, useState, useTransition } from "react";
import { Aviso } from "@/components/ui";
import { conferirInscricaoAcao, enviarTesteAcao, removerInscricaoAcao, salvarInscricaoAcao } from "./actions";

type Estado = "carregando" | "sem_suporte" | "instalar" | "negada" | "pronto" | "ativo";

function base64UrlParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

const ehIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const instalado = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registrar(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/** Estado das notificações NESTE aparelho: instalar, permitir, ativar, testar e desativar. */
export function Aparelho({ chavePublica }: { chavePublica: string | null }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!suporta) {
        // No iPhone, a notificação só existe com o app instalado na tela de início.
        if (vivo) setEstado(ehIos() && !instalado() ? "instalar" : "sem_suporte");
        return;
      }
      if (Notification.permission === "denied") {
        if (vivo) setEstado("negada");
        return;
      }
      try {
        const reg = await registrar();
        const sub = await reg.pushManager.getSubscription();
        const minha = sub ? await conferirInscricaoAcao(sub.endpoint) : false;
        if (vivo) setEstado(minha ? "ativo" : "pronto");
      } catch {
        if (vivo) setEstado("pronto");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  function ativar() {
    setMensagem(null);
    iniciar(async () => {
      if (!chavePublica) {
        setMensagem({ tipo: "erro", texto: "As notificações ainda não foram configuradas no servidor." });
        return;
      }
      // A permissão só pode ser pedida depois de um toque (exigência do iPhone).
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "negada" : "pronto");
        return;
      }
      try {
        const reg = await registrar();
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(chavePublica) });
        const json = sub.toJSON();
        const r = await salvarInscricaoAcao({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
        if (r.erro) setMensagem({ tipo: "erro", texto: r.erro });
        else {
          setEstado("ativo");
          setMensagem({ tipo: "ok", texto: "Notificações ativas neste aparelho." });
        }
      } catch {
        setMensagem({ tipo: "erro", texto: "Não foi possível ativar neste aparelho. Tente de novo." });
      }
    });
  }

  function desativar() {
    setMensagem(null);
    iniciar(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removerInscricaoAcao(sub.endpoint);
          await sub.unsubscribe();
        }
        setEstado("pronto");
        setMensagem({ tipo: "ok", texto: "Notificações desativadas neste aparelho." });
      } catch {
        setMensagem({ tipo: "erro", texto: "Não foi possível desativar agora." });
      }
    });
  }

  function testar() {
    setMensagem(null);
    iniciar(async () => {
      const r = await enviarTesteAcao();
      setMensagem(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: "Teste enviado. Deve chegar em alguns segundos." });
    });
  }

  return (
    <div className="space-y-4">
      {estado === "carregando" ? <p className="text-suave">Verificando este aparelho…</p> : null}
      {estado === "instalar" ? (
        <div className="space-y-2">
          <p className="text-lg font-semibold">Instale o Kalyft para receber lembretes.</p>
          <ol className="list-decimal space-y-1 pl-6 text-suave">
            <li>No Safari, toque em <strong>Compartilhar</strong> (quadrado com seta).</li>
            <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
            <li>Abra o Kalyft pelo ícone e volte a esta tela.</li>
          </ol>
          <p className="text-sm text-suave">Precisa do iOS 16.4 ou mais novo.</p>
        </div>
      ) : null}
      {estado === "sem_suporte" ? <p className="text-suave">Este navegador não recebe notificações. No iPhone, use o Kalyft instalado na tela de início (iOS 16.4 ou mais novo).</p> : null}
      {estado === "negada" ? (
        <p className="text-suave">
          As notificações foram bloqueadas para o Kalyft. No iPhone, abra <strong>Ajustes → Notificações → Kalyft</strong> e permita. Depois volte aqui.
        </p>
      ) : null}
      {estado === "pronto" ? (
        <button type="button" onClick={ativar} disabled={pendente} className="action-primary w-full">
          {pendente ? "Ativando…" : "Ativar notificações neste aparelho"}
        </button>
      ) : null}
      {estado === "ativo" ? (
        <div className="space-y-3">
          <p className="text-lg font-semibold">Notificações ativas neste aparelho.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={testar} disabled={pendente} className="action-secondary">Enviar teste</button>
            <button type="button" onClick={desativar} disabled={pendente} className="action-secondary">Desativar neste aparelho</button>
          </div>
        </div>
      ) : null}
      {mensagem ? <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso> : null}
    </div>
  );
}

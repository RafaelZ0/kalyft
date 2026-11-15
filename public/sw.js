// Service worker do Kalyft: só notificações (Fase 9F). Não guarda páginas em cache nem funciona offline.
// Abre apenas caminhos do próprio site.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function caminhoSeguro(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/hoje";
}

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }
  const titulo = typeof dados.titulo === "string" ? dados.titulo.slice(0, 60) : "Kalyft";
  const corpo = typeof dados.corpo === "string" ? dados.corpo.slice(0, 160) : "";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: typeof dados.tag === "string" ? dados.tag.slice(0, 80) : undefined,
      data: { url: caminhoSeguro(dados.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(caminhoSeguro(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
          await janela.focus();
          if ("navigate" in janela) await janela.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});

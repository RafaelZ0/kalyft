"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, Dumbbell, House, Settings2, Utensils, HeartHandshake } from "lucide-react";
import { Logotipo } from "@/lib/marca";

const ABAS = [
  { href: "/hoje", rotulo: "Hoje", desktop: "Hoje", Icone: House },
  { href: "/comida", rotulo: "Comida", desktop: "Alimentação", Icone: Utensils },
  { href: "/treino", rotulo: "Treino", desktop: "Treino", Icone: Dumbbell },
  { href: "/progresso", rotulo: "Progresso", desktop: "Progresso", Icone: ChartNoAxesCombined },
  { href: "/ajustes", rotulo: "Conta", desktop: "Conta", Icone: Settings2 },
];

export function BarraAbas() {
  const caminho = usePathname();
  const ativa = (href: string) => caminho === href || caminho.startsWith(`${href}/`);
  return <>
    <aside className="app-sidebar">
      <Link href="/hoje" aria-label="Kalyft, início" className="inline-flex min-h-11 items-center"><Logotipo /></Link>
      <nav aria-label="Principal no computador">{ABAS.map(({ href, desktop, Icone }) => <Link key={href} href={href} aria-current={ativa(href) ? "page" : undefined}><Icone size={21} aria-hidden="true" />{desktop}</Link>)}</nav>
      <div className="mt-auto border-t border-linha pt-6"><HeartHandshake size={23} className="mb-3 text-marca" aria-hidden="true" /><p className="text-sm font-semibold">Seu ritmo. Sua evolução.</p><p className="mt-1 text-xs leading-relaxed text-suave">Alimentação e treino, juntos no seu dia.</p></div>
    </aside>
    <nav className="app-bottom-nav" aria-label="Principal"><ul>{ABAS.map(({ href, rotulo, Icone }) => <li key={href}><Link href={href} aria-current={ativa(href) ? "page" : undefined}><span className="nav-icon"><Icone size={22} aria-hidden="true" /></span>{rotulo}</Link></li>)}</ul></nav>
  </>;
}

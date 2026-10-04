import {
  Award,
  BookOpen,
  LayoutDashboard,
  ListTodo,
  NotebookPen,
  Settings,
  Timer,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

const navigation = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/activities", label: "Atividades", icon: ListTodo },
  { href: "/subjects", label: "Matérias", icon: BookOpen },
  { href: "/focus", label: "Foco", icon: Timer },
  { href: "/achievements", label: "Conquistas", icon: Award },
  { href: "/planner", label: "Planner", icon: NotebookPen },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

type UserProfile = { name: string | null; email: string | null; role: "admin" | "user" };

export function AppShell({ children, user }: { children: ReactNode; user: UserProfile }) {
  const [location] = useLocation();
  const firstName = user.name?.split(" ")[0] || user.email?.split("@")[0] || "Estudante";

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-950 dark:bg-[#10111a] dark:text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-slate-200/70 bg-white px-4 py-5 dark:border-white/10 dark:bg-[#171923] lg:flex">
        <Link href="/" className="mb-9 flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#5B6CFF] font-mono text-lg font-black text-white shadow-[0_8px_24px_rgba(91,108,255,0.32)]">2B</span>
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">dashboard do</span>
            <span className="block text-base font-extrabold tracking-tight">2B</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navegação principal">
          {navigation.map(item => {
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#5B6CFF] text-white shadow-[0_8px_20px_rgba(91,108,255,0.20)]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"}`}>
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Ritmo semanal</span>
            <span className="font-mono text-xs text-[#5B6CFF]">2B</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full w-[64%] rounded-full bg-[#74D7BA]" /></div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">Faltam 2 passos para sua semana ficar em dia.</p>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/70 bg-[#f7f8fc]/85 px-5 backdrop-blur-xl dark:border-white/10 dark:bg-[#10111a]/85 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Link href="/" className="grid size-9 place-items-center rounded-xl bg-[#5B6CFF] font-mono text-sm font-black text-white">2B</Link>
            <span className="text-sm font-extrabold">Dashboard do 2B</span>
          </div>
          <div className="hidden lg:block"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Turma · organização inteligente</span></div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pr-2 pl-1.5 dark:border-white/10 dark:bg-white/5">
              <span className="grid size-7 place-items-center rounded-lg bg-[#EEF0FF] text-xs font-black text-[#5B6CFF] dark:bg-[#5B6CFF]/20">{firstName.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-28 truncate text-xs font-bold sm:block">{firstName}</span>
              <span className={`hidden rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide sm:block ${user.role === "admin" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"}`}>{user.role === "admin" ? "admin" : "aluno"}</span>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1540px] px-5 pt-7 pb-24 sm:px-8 sm:pt-9 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-[#171923]/95 lg:hidden" aria-label="Navegação móvel">
        {navigation.slice(0, 6).map(item => {
          const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 rounded-lg py-1 text-[9px] font-bold ${active ? "text-[#5B6CFF]" : "text-slate-400 dark:text-slate-500"}`}><Icon className="size-[18px]" />{item.label.split(" ")[0]}</Link>;
        })}
      </nav>
    </div>
  );
}

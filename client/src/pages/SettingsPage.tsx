import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, FileJson, FileSpreadsheet, LogOut } from "lucide-react";
import { toast } from "sonner";

function downloadFile(content: string, name: string, type: string) { const blob = new Blob([content], { type }); const href = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = href; link.download = name; link.click(); URL.revokeObjectURL(href); }

export default function SettingsPage() {
  const exportData = trpc.export.data.useQuery(undefined, { enabled: false });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => window.location.assign("/") });
  const runExport = async (kind: "json" | "csv") => {
    try {
      const result = await exportData.refetch();
      if (!result.data) return toast.error("Não foi possível preparar a exportação.");
      downloadFile(kind === "json" ? result.data.json : result.data.csv, `${result.data.fileName}.${kind}`, kind === "json" ? "application/json" : "text/csv;charset=utf-8");
      toast.success("Arquivo exportado.");
    } catch {
      toast.error("A exportação falhou. Tente novamente.");
    }
  };
  return <div className="max-w-3xl space-y-6"><header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6CFF]">Preferências</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Ajustes</h1><p className="mt-2 text-sm text-slate-500">Exporte seus dados e encerre sua sessão neste dispositivo.</p></header>
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25]"><div><h2 className="font-extrabold">Exportar meus dados</h2><p className="mt-1 text-sm leading-6 text-slate-500">Baixe suas atividades, sessões e conquistas em um formato portátil.</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => runExport("json")} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#5B6CFF] hover:bg-[#EEF0FF] dark:border-white/10 dark:hover:bg-[#5B6CFF]/10"><span className="grid size-10 place-items-center rounded-xl bg-[#EEF0FF] text-[#5B6CFF] dark:bg-[#5B6CFF]/15"><FileJson className="size-5" /></span><span><span className="block text-sm font-bold">JSON</span><span className="mt-0.5 block text-xs text-slate-500">Backup estruturado</span></span><Download className="ml-auto size-4 text-slate-400" /></button><button onClick={() => runExport("csv")} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#1A9D77] hover:bg-[#E7F8F1] dark:border-white/10 dark:hover:bg-[#74D7BA]/10"><span className="grid size-10 place-items-center rounded-xl bg-[#E7F8F1] text-[#1A9D77] dark:bg-[#74D7BA]/15"><FileSpreadsheet className="size-5" /></span><span><span className="block text-sm font-bold">CSV</span><span className="mt-0.5 block text-xs text-slate-500">Planilha de atividades</span></span><Download className="ml-auto size-4 text-slate-400" /></button></div></section>
    <section className="rounded-[24px] border border-rose-100 bg-rose-50/50 p-5 dark:border-rose-400/15 dark:bg-rose-400/[.04]"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-extrabold text-rose-800 dark:text-rose-200">Sessão</h2><p className="mt-1 text-sm text-rose-700/80 dark:text-rose-200/70">Encerrar a sessão neste dispositivo.</p></div><Button variant="destructive" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut className="size-4" />Sair da conta</Button></div></section>
  </div>;
}

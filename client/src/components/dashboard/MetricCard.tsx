import type { LucideIcon } from "lucide-react";

const tones = {
  indigo: "bg-[#EEF0FF] text-[#5B6CFF] dark:bg-[#5B6CFF]/15",
  mint: "bg-[#E7F8F1] text-[#1A9D77] dark:bg-[#74D7BA]/15",
  amber: "bg-[#FFF4DA] text-[#D68A00] dark:bg-amber-400/15",
  rose: "bg-[#FFE9EC] text-[#D94A66] dark:bg-rose-400/15",
};

export function MetricCard({ label, value, caption, icon: Icon, tone = "indigo" }: { label: string; value: string | number; caption: string; icon: LucideIcon; tone?: keyof typeof tones }) {
  return (
    <article className="rounded-[22px] border border-slate-200/75 bg-white p-4 shadow-[0_8px_25px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 dark:border-white/8 dark:bg-[#181a25] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">{label}</p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight">{value}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="size-[19px]" /></span>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{caption}</p>
    </article>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Loader2, Timer, Trophy } from "lucide-react";
import { useState, type FormEvent } from "react";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [error, setError] = useState("");
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();
  const signupStatus = trpc.auth.signupStatus.useQuery();
  const pending = login.isPending || register.isPending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") await login.mutateAsync({ email, password });
      else await register.mutateAsync({ name, email, password, ...(showAdminCode ? { adminCode } : {}) });
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível autenticar. Tente novamente.");
    }
  }

  return (
    <main className="texture-grid grid min-h-screen place-items-center bg-[#10111a] p-5 text-slate-50">
      <section className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-[#181a25] shadow-[0_30px_90px_rgba(0,0,0,0.35)] lg:grid lg:grid-cols-[1.12fr_0.88fr]">
        <div className="p-8 sm:p-12 lg:p-16">
          <div className="mb-10 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#5B6CFF] font-mono text-lg font-black text-white">2B</span><span><span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">dashboard do</span><span className="font-extrabold">2B</span></span></div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8D98FF]">Organização escolar inteligente</p>
          <h1 className="mt-4 max-w-md text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">Seu ritmo de estudo, <span className="text-[#8D98FF]">visível.</span></h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-400">Matérias, prazos, foco e conquistas em um espaço feito para a rotina do 2B.</p>

          <div className="mt-8 flex gap-2 rounded-xl bg-[#10111a] p-1" role="tablist" aria-label="Acesso">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(""); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${mode === "login" ? "bg-[#5B6CFF] text-white" : "text-slate-400 hover:text-white"}`}>Entrar</button>
            <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => { setMode("register"); setError(""); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${mode === "register" ? "bg-[#5B6CFF] text-white" : "text-slate-400 hover:text-white"}`}>Criar conta</button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={submit}>
            {mode === "register" && <div className="space-y-2"><Label htmlFor="name">Nome</Label><Input id="name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="border-white/10 bg-[#10111a] text-white placeholder:text-slate-500" placeholder="Seu nome" /></div>}
            <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} className="border-white/10 bg-[#10111a] text-white placeholder:text-slate-500" placeholder="voce@exemplo.com" /></div>
            <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 10 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="border-white/10 bg-[#10111a] text-white placeholder:text-slate-500" placeholder={mode === "register" ? "Pelo menos 10 caracteres" : "Sua senha"} /></div>
            {mode === "register" && <p className="text-xs text-slate-400">{signupStatus.data?.enabled ? "Cadastros novos entram como aluno. A senha deve ter pelo menos 10 caracteres." : "O cadastro de novos alunos está temporariamente pausado. Se você tiver um código de administrador, poderá ativar a conta existente."}</p>}
            {mode === "register" && showAdminCode && <div className="space-y-2"><Label htmlFor="adminCode">Código inicial do administrador</Label><Input id="adminCode" type="password" autoComplete="off" required value={adminCode} onChange={event => setAdminCode(event.target.value)} className="border-white/10 bg-[#10111a] text-white placeholder:text-slate-500" placeholder="Código configurado no serviço de hospedagem" /><p className="text-xs leading-5 text-slate-500">Este código ativa a conta administrativa existente uma única vez. Não o compartilhe.</p></div>}
            {mode === "register" && <button type="button" className="text-xs font-semibold text-[#AAB2FF] hover:text-white" onClick={() => { setShowAdminCode(value => !value); setAdminCode(""); }}>{showAdminCode ? "Voltar ao cadastro de aluno" : "Tenho um código de administrador"}</button>}
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            <Button type="submit" size="lg" disabled={pending} className="h-12 w-full rounded-xl px-5">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <>{mode === "login" ? "Entrar no Dashboard" : "Criar minha conta"}<ArrowRight className="size-4" /></>}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">Acesso independente por e-mail e senha.</p>
        </div>
        <div className="bg-[#202657] p-8 text-white sm:p-12 lg:p-16">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B6BEFF]">Tudo no mesmo fluxo</p>
          <div className="mt-8 space-y-6">
            {[
              [CheckCircle2, "Atividades em dia", "Organize prioridades e marque seu próprio progresso."],
              [Timer, "Foco que conta", "Registre Pomodoros e acompanhe sua sequência."],
              [Trophy, "Conquistas reais", "Cada passo de estudo se transforma em motivação."],
            ].map(([Icon, title, text]) => {
              const FeatureIcon = Icon as typeof CheckCircle2;
              return <div key={title as string} className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#74D7BA]"><FeatureIcon className="size-5" /></span><div><h2 className="font-bold">{title as string}</h2><p className="mt-1 text-sm leading-6 text-[#C4C9F1]">{text as string}</p></div></div>;
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CircleAlert,
  ClipboardList,
  HardHat,
  LayoutDashboard,
  LogOut,
  UsersRound,
  Wallet,
} from "lucide-react";
import { logoutAction, setActiveCompanyAction } from "@/app/actions";
import { Brand } from "@/components/brand";

type Company = { id: string; nome: string; locale: string };

const navigation = [
  { href: "/app", label: "Painel", icon: LayoutDashboard },
  { href: "/app/obras", label: "Obras", icon: BriefcaseBusiness },
];

const futureItems = [
  { label: "Custos", icon: Wallet },
];

export function AppShell({
  children,
  company,
  companies,
  email,
  name,
  perfil,
}: {
  children: React.ReactNode;
  company: Company;
  companies: Company[];
  email: string;
  name: string;
  perfil: string;
}) {
  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col border-r border-slate-200/80 bg-white px-5 py-6 lg:flex">
        <Link href="/app" aria-label="Obratrix - painel"><Brand /></Link>
        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-emerald-800"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Gestão da obra</div>
        <nav className="space-y-1">
          <Link href="/app/obras" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-emerald-800">
            <BarChart3 size={18} />
            Orçamento/EAP
          </Link>
          <Link href="/app/campo/hoje" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-emerald-800">
            <ClipboardList size={18} />
            RDO
          </Link>
          {futureItems.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-slate-400">
              <span className="flex items-center gap-3"><Icon size={18} />{label}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wide">Em breve</span>
            </div>
          ))}
          <Link href="/app/membros" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-emerald-800">
            <UsersRound size={18} />
            Membros
          </Link>
        </nav>
        <div className="mt-auto rounded-2xl bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-900">
            <HardHat size={17} />
            <span className="text-xs font-bold">Obra em foco</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-emerald-800/75">
            Acompanhe equipe, avanço e custos em um só lugar.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3 lg:hidden"><Brand compact /></div>
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">Empresa ativa</p>
            {companies.length > 1 ? (
              <form action={setActiveCompanyAction} className="flex items-center gap-1 sm:mt-1 sm:gap-2">
                <select
                  name="empresa_id"
                  defaultValue={company.id}
                  aria-label="Selecionar empresa"
                  className="max-w-[116px] truncate border-0 bg-transparent p-0 text-xs font-semibold text-slate-800 outline-none sm:max-w-[260px] sm:text-sm"
                >
                  {companies.map((entry) => <option key={entry.id} value={entry.id}>{entry.nome}</option>)}
                </select>
                <button className="text-xs font-semibold text-emerald-800 hover:underline">
                  <span className="hidden sm:inline">Trocar</span>
                  <span className="sm:hidden">OK</span>
                </button>
              </form>
            ) : (
              <p className="max-w-[116px] truncate text-xs font-semibold text-slate-800 sm:max-w-[260px] sm:text-sm">{company.nome}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-semibold text-slate-800">{name || email}</p>
              <p className="text-xs capitalize text-slate-400">{perfil}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900">
              {(name || email).slice(0, 1).toLocaleUpperCase("pt-BR")}
            </div>
            <form action={logoutAction}>
              <button aria-label="Sair" className="flex size-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-76px)] max-w-[1500px] px-4 pb-28 pt-7 sm:px-8 sm:pt-9 lg:px-10 lg:pb-12">
          {children}
        </main>
      </div>

      <nav aria-label="Navegação de campo" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 lg:hidden">
        {[
          { href: "/app/campo/hoje", label: "Hoje", icon: CalendarDays, active: true },
          { href: "/app/campo/hoje", label: "Registrar", icon: ClipboardList },
          { href: "/app/campo/hoje#fotos", label: "Foto", icon: Camera },
          { href: "/app/campo/hoje#ocorrencias", label: "Problema", icon: CircleAlert },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link key={label} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? "text-emerald-800" : "text-slate-500"}`}>
            <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

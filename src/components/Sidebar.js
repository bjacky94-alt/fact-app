import { FileText, Settings } from "lucide-react";

const navItems = [
  { id: "settings", label: "Paramètres", icon: Settings },
  { id: "invoices", label: "Factures", icon: FileText },
];

export default function Sidebar({ currentTab, onTabChange }) {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 p-6">
        <h1 className="text-2xl font-extrabold tracking-wide text-slate-100">FACT</h1>
        <p className="mt-1 text-sm text-slate-400">Facturation Freelance</p>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${
                active
                  ? "bg-slate-800 text-slate-100 shadow"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              }`}
            >
              <Icon size={18} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

import { useMemo, useState } from "react";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import { useLocalStorage } from "./hooks/useLocalStorage";

export default function App() {
  const [currentTab, setCurrentTab] = useState("settings");
  const { data, saveData } = useLocalStorage("fact-dashboard");

  const content = useMemo(() => {
    if (currentTab === "settings") {
      return <Settings data={data} onSave={saveData} />;
    }

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-slate-200">
        <h2 className="text-xl font-semibold">Factures</h2>
        <p className="mt-2 text-slate-400">
          Cet onglet sera implémenté dans la prochaine phase. Les paramètres sont déjà prêts.
        </p>
      </div>
    );
  }, [currentTab, data, saveData]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />
      <main className="ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard FACT</h1>
          <p className="mt-1 text-slate-400">Gérez vos informations de facturation en local.</p>
        </header>

        {content}
      </main>
    </div>
  );
}

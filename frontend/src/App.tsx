import { useState } from "react";
import { MapView } from "./components/MapView";
import { CatSearch } from "./components/CatSearch";
import { Guides } from "./components/Guides";
import { Home } from "./components/Home";
import { SuggestShelter } from "./components/SuggestShelter";
import { Admin } from "./components/Admin";

type Page = "home" | "search" | "map" | "guides" | "suggest" | "admin";

export default function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="min-h-screen bg-cat-cream flex flex-col">
      <header className="bg-white border-b border-cat-sand sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <button onClick={() => setPage("home")} className="flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <span className="text-xl font-display font-bold text-cat-brown">Mrucznik</span>
          </button>
          <nav className="flex items-center gap-1">
            {([
              ["home", "🏠", "Home"],
              ["search", "🔍", "Find a Cat"],
              ["map", "🗺️", "Map"],
              ["guides", "📖", "Guides"],
              ["suggest", "➕", "Add Shelter"],
            ] as [Page, string, string][]).map(([id, icon, label]) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page === id ? "bg-primary-100 text-primary-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="hidden sm:inline">{icon} </span>{label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {page === "home" && <Home onNavigate={setPage} />}
        {page === "search" && <div className="flex-1 overflow-y-auto"><CatSearch /></div>}
        {page === "map" && <div className="h-[calc(100vh-4rem)] overflow-hidden"><MapView /></div>}
        {page === "guides" && <Guides />}
        {page === "suggest" && <SuggestShelter />}
        {page === "admin" && <Admin />}
      </main>

      <footer className="bg-cat-dark text-cat-sand py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-sm">
          <p className="mb-2">🐾 Mrucznik — helping cats find homes</p>
          <p className="text-gray-400 mb-3">Shelter data updated automatically. Open-source project.</p>
          <button onClick={() => setPage("admin")} className="text-xs text-gray-600 hover:text-gray-400">
            Admin
          </button>
        </div>
      </footer>
    </div>
  );
}

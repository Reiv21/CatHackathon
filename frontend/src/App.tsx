import { useState } from "react";
import { MapView } from "./components/MapView";
import { CatSearch } from "./components/CatSearch";
import { Guides } from "./components/Guides";
import { Home } from "./components/Home";
import { SuggestShelter } from "./components/SuggestShelter";
import { Admin } from "./components/Admin";
import { Volunteer } from "./components/Volunteer";
import { useI18n } from "./i18n";

type Page = "home" | "search" | "map" | "guides" | "suggest" | "admin" | "volunteer";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const { lang, setLang, t } = useI18n();

  return (
    <div className="min-h-screen bg-cat-cream flex flex-col">
      <header className="bg-white border-b border-cat-sand sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <button onClick={() => setPage("home")} className="flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <span className="text-xl font-display font-bold text-cat-brown">Mrucznik</span>
          </button>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {([
                ["home", t.home],
                ["search", t.findCat],
                ["map", t.map],
                ["guides", t.guides],
                ["volunteer", t.volunteer],
              ] as [Page, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    page === id ? "bg-primary-100 text-primary-700" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "pl" : "en")}
              className="ml-2 px-2 py-1 text-xs font-medium border border-cat-sand rounded-lg hover:bg-gray-50 transition-colors"
              title={lang === "en" ? "Switch to Polish" : "Przełącz na angielski"}
            >
              {lang === "en" ? "🇵🇱 PL" : "🇬🇧 EN"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {page === "home" && <Home onNavigate={setPage} />}
        {page === "search" && <div className="flex-1 overflow-y-auto"><CatSearch /></div>}
        {page === "map" && <div className="h-[calc(100vh-4rem)] overflow-hidden"><MapView /></div>}
        {page === "guides" && <Guides />}
        {page === "suggest" && <SuggestShelter />}
        {page === "volunteer" && <Volunteer />}
        {page === "admin" && <Admin />}
      </main>

      <footer className="bg-cat-dark text-cat-sand py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-sm">
          <p className="mb-2">{t.footerTitle}</p>
          <p className="text-gray-400 mb-3">{t.footerDesc}</p>
          <div className="flex justify-center gap-4 text-xs text-gray-600">
            <button onClick={() => setPage("suggest")} className="hover:text-gray-400">{t.addShelter}</button>
            <button onClick={() => setPage("admin")} className="hover:text-gray-400">Admin</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from "react";
import { MapView } from "./components/MapView";
import { CatSearch } from "./components/CatSearch";
import { Guides } from "./components/Guides";
import { Home } from "./components/Home";
import { SuggestShelter } from "./components/SuggestShelter";
import { Admin } from "./components/Admin";
import { Volunteer } from "./components/Volunteer";
import { useI18n } from "./i18n";

type Page = "home" | "search" | "map" | "guides" | "suggest" | "admin" | "volunteer";

function getPageFromHash(): Page {
  const hash = window.location.hash.replace("#", "") || "home";
  const valid: Page[] = ["home", "search", "map", "guides", "suggest", "admin", "volunteer"];
  return valid.includes(hash as Page) ? (hash as Page) : "home";
}

export default function App() {
  const [page, setPageState] = useState<Page>(getPageFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang, setLang, t } = useI18n();

  const setPage = (p: Page) => {
    setPageState(p);
    window.location.hash = p === "home" ? "" : p;
  };

  useEffect(() => {
    const onHash = () => setPageState(getPageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (p: Page) => { setPage(p); setMenuOpen(false); window.scrollTo(0, 0); };

  return (
    <div className="min-h-screen bg-cat-cream flex flex-col">
      <header className="bg-white border-b border-cat-sand sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          <button onClick={() => navigate("home")} className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">🐱</span>
            <span className="text-lg sm:text-xl font-display font-bold text-cat-brown">Mrucznik</span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <nav className="flex items-center gap-1">
              {([
                ["home", t.home],
                ["search", t.findCat],
                ["map", t.map],
                ["guides", t.guides],
                ["volunteer", t.volunteer],
                ["suggest", t.addShelter],
              ] as [Page, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    page === id ? "bg-primary-100 text-primary-700" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <button onClick={() => setLang(lang === "en" ? "pl" : "en")}
              className="ml-2 px-2 py-1 text-xs font-medium border border-cat-sand rounded-lg hover:bg-gray-50">
              {lang === "en" ? "🇵🇱 PL" : "🇬🇧 EN"}
            </button>
          </div>

          {/* Mobile: lang + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <button onClick={() => setLang(lang === "en" ? "pl" : "en")}
              className="px-2 py-1 text-xs font-medium border border-cat-sand rounded-lg">
              {lang === "en" ? "🇵🇱" : "🇬🇧"}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-cat-sand bg-white px-4 py-2 space-y-1">
            {([
              ["home", t.home],
              ["search", t.findCat],
              ["map", t.map],
              ["guides", t.guides],
              ["volunteer", t.volunteer],
              ["suggest", t.addShelter],
            ] as [Page, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page === id ? "bg-primary-100 text-primary-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
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

      {/* Back to top bar (mobile) */}
      <div className="md:hidden sticky bottom-0 bg-white border-t border-cat-sand py-2 px-4 text-center z-40">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-sm text-primary-600 font-medium">
          ⬆ {lang === "pl" ? "Na górę" : "Back to top"}
        </button>
      </div>

      <footer className="bg-cat-dark text-cat-sand py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-sm">
          <p className="mb-2">{t.footerTitle}</p>
          <p className="text-gray-400 mb-3">{t.footerDesc}</p>
          <div className="flex justify-center gap-4 text-xs text-gray-600">
            <button onClick={() => { setPage("home"); window.scrollTo(0, 0); }} className="hover:text-gray-400">
              {lang === "pl" ? "⬆ Na górę" : "⬆ Back to top"}
            </button>
            <button onClick={() => setPage("suggest")} className="hover:text-gray-400">{t.addShelter}</button>
            <button onClick={() => setPage("admin")} className="hover:text-gray-400">Admin</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

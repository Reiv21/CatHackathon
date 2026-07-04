import { useState } from "react";
import { MapView } from "./components/MapView";
import { CatSearch } from "./components/CatSearch";

type Tab = "map" | "search";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  return (
    <div className="min-h-screen bg-tactical-bg text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-tactical-surface border-b border-tactical-accent px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-mono font-bold text-tactical-amber tracking-wider">
              Operation Purrfect Storm
            </h1>
            <p className="text-sm text-gray-400 font-mono mt-1">
              Tactical Command Center — World Domination Status
            </p>
          </div>

          {/* Tab navigation */}
          <nav className="flex gap-1 bg-tactical-bg rounded-lg p-1">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-4 py-2 rounded-md font-mono text-sm transition-colors duration-200 ${
                activeTab === "search"
                  ? "bg-tactical-accent text-tactical-amber"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              🔍 Agent Search
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={`px-4 py-2 rounded-md font-mono text-sm transition-colors duration-200 ${
                activeTab === "map"
                  ? "bg-tactical-accent text-tactical-amber"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              🗺️ World Map
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "map" && (
          <div className="h-[calc(100vh-5rem)]">
            <MapView />
          </div>
        )}
        {activeTab === "search" && (
          <div className="h-[calc(100vh-5rem)] overflow-y-auto">
            <CatSearch />
          </div>
        )}
      </main>
    </div>
  );
}

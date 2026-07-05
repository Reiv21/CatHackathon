import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import type { CatResponse } from "../types";

interface HomeProps {
  onNavigate: (page: "search" | "map" | "guides") => void;
}

interface Stats {
  totalCats: number;
  totalShelters: number;
  sheltersWithCats: number;
  lastFetched: string | null;
}

export function Home({ onNavigate }: HomeProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [catOfDay, setCatOfDay] = useState<CatResponse | null>(null);

  useEffect(() => {
    apiFetch<Stats>("/api/stats").then(setStats).catch(() => {});
    apiFetch<CatResponse | null>("/api/cat-of-the-day").then(setCatOfDay).catch(() => {});
  }, []);

  return (
    <div>
      <section className="bg-gradient-to-br from-warm-50 to-primary-50 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-cat-dark mb-4">
            Every cat deserves a home 🐾
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Browse cats available for adoption from shelters across Poland.
            Find your new purring companion.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={() => onNavigate("search")} className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200">
              🔍 Find a cat
            </button>
            <button onClick={() => onNavigate("map")} className="px-6 py-3 bg-white text-cat-brown border border-cat-sand rounded-xl font-semibold hover:bg-cat-sand transition-colors">
              🗺️ Shelter map
            </button>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 border-b border-cat-sand">
        {/* Cat of the Day */}
        {catOfDay && (
          <div className="max-w-4xl mx-auto mb-10">
            <h2 className="text-xl font-display font-bold text-center mb-4">🌟 Cat of the Day</h2>
            <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col sm:flex-row max-w-2xl mx-auto">
              {catOfDay.image_url && (
                <img src={catOfDay.image_url} alt={catOfDay.name} className="w-full sm:w-48 h-48 object-cover" />
              )}
              <div className="p-5 flex flex-col justify-center">
                <h3 className="text-2xl font-display font-bold text-primary-600">{catOfDay.name}</h3>
                {catOfDay.description && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{catOfDay.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">📍 {catOfDay.shelter_city}</p>
                {catOfDay.source_url && (
                  <a href={catOfDay.source_url} target="_blank" rel="noreferrer" className="text-sm text-primary-600 mt-2 hover:text-primary-700">
                    Meet me →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-display font-bold text-primary-600">
              {stats ? stats.totalCats : "..."}
            </div>
            <div className="text-gray-500 text-sm mt-1">cats waiting for a home</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-display font-bold text-warm-600">
              {stats ? stats.totalShelters : "..."}
            </div>
            <div className="text-gray-500 text-sm mt-1">shelters in database</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-display font-bold text-cat-orange">16</div>
            <div className="text-gray-500 text-sm mt-1">voivodeships covered</div>
          </div>
        </div>
        {stats?.lastFetched && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Last updated: {new Date(stats.lastFetched).toLocaleString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}
      </section>

      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-center mb-8">Why adopt?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">💛</div>
              <h3 className="font-semibold mb-2">Save a life</h3>
              <p className="text-sm text-gray-500">Every adoption makes room for another animal in need</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🏥</div>
              <h3 className="font-semibold mb-2">Healthy pets</h3>
              <p className="text-sm text-gray-500">Shelter cats are vaccinated, dewormed, and neutered</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🐈</div>
              <h3 className="font-semibold mb-2">Grateful companion</h3>
              <p className="text-sm text-gray-500">Shelter cats form exceptionally strong bonds with their new families</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-warm-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-display font-bold mb-4">First-time cat owner?</h2>
          <p className="text-gray-600 mb-6">We've prepared guides to help you get ready for your new family member.</p>
          <button onClick={() => onNavigate("guides")} className="px-6 py-3 bg-warm-600 text-white rounded-xl font-semibold hover:bg-warm-700 transition-colors">
            📖 Read our guides
          </button>
        </div>
      </section>
    </div>
  );
}

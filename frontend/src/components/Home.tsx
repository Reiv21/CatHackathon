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
        {catOfDay && catOfDay.image_url && (
          <div className="max-w-4xl mx-auto mb-12">
            <h2 className="text-xl font-display font-bold text-center mb-6">🌟 Cat of the Day</h2>
            <div className="relative max-w-lg mx-auto rounded-2xl overflow-hidden shadow-lg">
              <img
                src={catOfDay.image_url}
                alt={catOfDay.name}
                className="w-full h-80 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-2xl font-display font-bold text-white">{catOfDay.name}</h3>
                <p className="text-sm text-white/80 mt-1">📍 {catOfDay.shelter_city}</p>
                {catOfDay.description && (
                  <p className="text-sm text-white/70 mt-1 line-clamp-2">{catOfDay.description}</p>
                )}
                {catOfDay.source_url && (
                  <a href={catOfDay.source_url} target="_blank" rel="noreferrer"
                    className="inline-block mt-3 text-sm font-medium text-white bg-primary-600 px-4 py-1.5 rounded-full hover:bg-primary-700 transition-colors">
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

      {/* Want to help section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-center mb-8">Want to help? 🤝</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🏠</div>
              <h3 className="font-semibold mb-2">Adopt</h3>
              <p className="text-sm text-gray-500">Give a shelter cat a forever home. It's the biggest difference you can make.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🙋</div>
              <h3 className="font-semibold mb-2">Volunteer</h3>
              <p className="text-sm text-gray-500">Contact your local shelter — they always need people to walk, clean, socialize, and photograph animals.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">📣</div>
              <h3 className="font-semibold mb-2">Spread the word</h3>
              <p className="text-sm text-gray-500">Share this site with friends. The more people see these cats, the faster they find homes.</p>
            </div>
          </div>
          <div className="mt-8 bg-primary-50 rounded-2xl p-6 text-center">
            <h3 className="font-semibold text-primary-700 mb-2">How to become a volunteer</h3>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              Most shelters accept volunteers with no prior experience. Simply visit or call your local shelter
              and ask about their volunteer program. Common tasks include socializing cats, cleaning enclosures,
              helping with events, fostering, and transporting animals to vet appointments.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

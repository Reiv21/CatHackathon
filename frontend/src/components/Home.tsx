import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api";
import { useI18n } from "../i18n";
import type { CatResponse } from "../types";
import { StatsSkeleton, CatOfDaySkeleton } from "./Skeletons";
import { InlineError } from "./InlineError";

interface HomeProps {
  onNavigate: (page: "search" | "map" | "guides" | "volunteer") => void;
}

interface Stats {
  totalCats: number;
  totalShelters: number;
  lastFetched: string | null;
}

export function Home({ onNavigate }: HomeProps) {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [catOfDay, setCatOfDay] = useState<CatResponse | null>(null);
  const [catOfDayLoading, setCatOfDayLoading] = useState(true);
  const [catOfDayError, setCatOfDayError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError(null);
    apiFetch<Stats>("/api/stats")
      .then((data) => { setStats(data); setStatsLoading(false); })
      .catch((err) => { setStatsError(err instanceof Error ? err.message : "Failed to load stats"); setStatsLoading(false); });
  }, []);

  const fetchCatOfDay = useCallback(() => {
    setCatOfDayLoading(true);
    setCatOfDayError(null);
    apiFetch<CatResponse | null>("/api/cat-of-the-day")
      .then((data) => { setCatOfDay(data); setCatOfDayLoading(false); })
      .catch((err) => { setCatOfDayError(err instanceof Error ? err.message : "Failed to load cat of the day"); setCatOfDayLoading(false); });
  }, []);

  useEffect(() => {
    fetchStats();
    fetchCatOfDay();
  }, [fetchStats, fetchCatOfDay]);

  return (
    <div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-warm-50 to-primary-50 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-cat-dark mb-4">{t.heroTitle}</h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">{t.heroSubtitle}</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={() => onNavigate("search")} className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200">
              {t.findCatBtn}
            </button>
            <button onClick={() => onNavigate("map")} className="px-6 py-3 bg-white text-cat-brown border border-cat-sand rounded-xl font-semibold hover:bg-cat-sand transition-colors">
              {t.shelterMapBtn}
            </button>
          </div>
        </div>
      </section>

      {/* Cat of the Day */}
      {catOfDayLoading && (
        <section className="py-12 px-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-display font-bold text-center mb-6">{t.catOfDay}</h2>
            <CatOfDaySkeleton />
          </div>
        </section>
      )}
      {!catOfDayLoading && catOfDayError && (
        <section className="py-12 px-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-display font-bold text-center mb-6">{t.catOfDay}</h2>
            <InlineError message={catOfDayError} onRetry={fetchCatOfDay} />
          </div>
        </section>
      )}
      {!catOfDayLoading && !catOfDayError && catOfDay && catOfDay.image_url && (
        <section className="py-12 px-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-display font-bold text-center mb-6">{t.catOfDay}</h2>
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
              <img src={catOfDay.image_url} alt={`${catOfDay.name} – ${catOfDay.shelter_city}`} className="w-full h-80 object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-2xl font-display font-bold text-white">{catOfDay.name}</h3>
                <p className="text-sm text-white/80 mt-1">📍 {catOfDay.shelter_city}</p>
                {catOfDay.source_url && (
                  <a href={catOfDay.source_url} target="_blank" rel="noreferrer"
                    className="inline-block mt-3 text-sm font-medium text-white bg-primary-600 px-4 py-1.5 rounded-full hover:bg-primary-700">
                    {t.meetMe}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="py-12 px-4 border-y border-cat-sand">
        {statsLoading && <StatsSkeleton />}
        {!statsLoading && statsError && <InlineError message={statsError} onRetry={fetchStats} />}
        {!statsLoading && !statsError && (
          <>
            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-3xl font-display font-bold text-primary-600">{stats ? stats.totalCats : "..."}</div>
                <div className="text-gray-500 text-sm mt-1">{t.catsWaiting}</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-3xl font-display font-bold text-warm-600">{stats ? stats.totalShelters : "..."}</div>
                <div className="text-gray-500 text-sm mt-1">{t.sheltersInDb}</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-3xl font-display font-bold text-cat-orange">16</div>
                <div className="text-gray-500 text-sm mt-1">{t.voivodeships}</div>
              </div>
            </div>
            {stats?.lastFetched && (
              <p className="text-center text-xs text-gray-500 mt-4">
                {t.lastUpdated}: {new Date(stats.lastFetched).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </>
        )}
      </section>

      {/* Why adopt */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-center mb-8">{t.whyAdopt}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">💛</div>
              <h3 className="font-semibold mb-2">{t.saveLife}</h3>
              <p className="text-sm text-gray-500">{t.saveLifeDesc}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🏥</div>
              <h3 className="font-semibold mb-2">{t.healthyPets}</h3>
              <p className="text-sm text-gray-500">{t.healthyPetsDesc}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🐈</div>
              <h3 className="font-semibold mb-2">{t.gratefulComp}</h3>
              <p className="text-sm text-gray-500">{t.gratefulCompDesc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Want to help */}
      <section className="py-12 px-4 bg-warm-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-center mb-8">{t.wantToHelp}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🏠</div>
              <h3 className="font-semibold mb-2">{t.adopt}</h3>
              <p className="text-sm text-gray-500">{t.adoptDesc}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🙋</div>
              <h3 className="font-semibold mb-2">{t.volunteerTitle}</h3>
              <p className="text-sm text-gray-500">{t.volunteerDesc}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">📣</div>
              <h3 className="font-semibold mb-2">{t.spreadWord}</h3>
              <p className="text-sm text-gray-500">{t.spreadWordDesc}</p>
            </div>
          </div>
          <div className="text-center mt-6">
            <button onClick={() => onNavigate("volunteer")} className="text-primary-600 hover:text-primary-700 font-medium text-sm">
              {t.learnVolunteer}
            </button>
          </div>
        </div>
      </section>

      {/* First time */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-display font-bold mb-4">{t.firstTime}</h2>
          <p className="text-gray-600 mb-6">{t.firstTimeDesc}</p>
          <button onClick={() => onNavigate("guides")} className="px-6 py-3 bg-warm-600 text-white rounded-xl font-semibold hover:bg-warm-700 transition-colors">
            {t.readGuides}
          </button>
        </div>
      </section>
    </div>
  );
}

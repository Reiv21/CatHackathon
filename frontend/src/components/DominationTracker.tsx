export interface DominationResponse {
  total_shelters_in_poland: number;
  shelters_covered: number;
  percentage: number;
  cats_in_army: number;
  domination_level: string;
}

interface DominationTrackerProps {
  data: DominationResponse | null;
  loading: boolean;
}

export function DominationTracker({ data, loading }: DominationTrackerProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded-full w-full mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/4" />
      </div>
    );
  }

  if (!data) return null;

  const formattedCats = data.cats_in_army.toLocaleString();

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-display font-bold text-cat-dark mb-3">
        {data.domination_level}
      </h3>

      {/* Progress bar */}
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-primary-600 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(data.percentage, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          🐱 <span className="font-semibold">{formattedCats}</span> w armii
        </span>
        <span className="font-medium">
          {data.percentage.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

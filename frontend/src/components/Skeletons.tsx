/**
 * Skeleton loading components for CatHackathon.
 * All skeletons use Tailwind animate-pulse with bg-gray-200 placeholder blocks.
 */

/** Mimics the CatCard layout: 208px image + name/metadata/shelter lines */
export function CatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      {/* Image placeholder - 208px (h-52) */}
      <div className="w-full h-52 bg-gray-200 rounded-t" />
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Name line */}
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        {/* Metadata line */}
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        {/* Shelter info line */}
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}

/** Three stat card skeletons matching the rounded-2xl stats layout */
export function StatsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
          {/* Number placeholder */}
          <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-3" />
          {/* Label placeholder */}
          <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
        </div>
      ))}
    </div>
  );
}

/** Cat of the day skeleton: 320px image + name/location lines */
export function CatOfDaySkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      {/* Image placeholder - 320px (h-80) */}
      <div className="w-full h-80 bg-gray-200 rounded-t" />
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Name line */}
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        {/* Location line */}
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

interface CatCardSkeletonGridProps {
  pageSize?: number;
}

/** Renders min(6, pageSize) skeleton cards in the same grid as actual cat cards */
export function CatCardSkeletonGrid({ pageSize = 24 }: CatCardSkeletonGridProps) {
  const count = Math.min(6, pageSize);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }, (_, i) => (
        <CatCardSkeleton key={i} />
      ))}
    </div>
  );
}

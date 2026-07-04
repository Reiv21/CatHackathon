export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-tactical-bg/80 flex items-center justify-center z-[1000]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-tactical-accent border-t-tactical-amber rounded-full animate-spin" />
        <span className="text-sm font-mono text-gray-400">Loading intel...</span>
      </div>
    </div>
  );
}

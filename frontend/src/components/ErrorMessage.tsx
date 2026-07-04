interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-tactical-surface border border-red-900/50 rounded-lg">
      <p className="text-red-400 font-mono text-sm text-center">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-tactical-accent hover:bg-tactical-accent-light text-gray-100 
                     font-mono text-sm rounded transition-colors duration-200 border border-tactical-amber/30"
        >
          Retry
        </button>
      )}
    </div>
  );
}

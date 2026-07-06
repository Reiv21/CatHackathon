interface InlineErrorProps {
  message: string;
  onRetry: () => void;
}

/** Inline error with retry button for use in loading sections */
export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4">
      <div className="text-3xl">⚠️</div>
      <p className="text-red-600 text-sm text-center max-w-md">{message}</p>
      <button
        onClick={onRetry}
        className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
      >
        Ponów próbę
      </button>
    </div>
  );
}

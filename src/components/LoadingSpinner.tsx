// src/components/admin/LoadingSpinner.tsx
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-t-primary-600 border-r-transparent border-b-primary-600 border-l-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-t-primary-400 border-r-transparent border-b-primary-400 border-l-transparent animate-spin animation-delay-500"></div>
        </div>
      </div>
    </div>
  );
}
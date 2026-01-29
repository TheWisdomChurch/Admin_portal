import { useEffect, useState } from 'react';

type SearchEvent = CustomEvent<string>;

export function useDashboardSearch(initialValue = '') {
  const [searchTerm, setSearchTerm] = useState(initialValue);

  useEffect(() => {
    const handleSearch = (event: Event) => {
      const detail = (event as SearchEvent).detail;
      if (typeof detail === 'string') {
        setSearchTerm(detail);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-search', handleSearch as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dashboard-search', handleSearch as EventListener);
      }
    };
  }, []);

  return { searchTerm, setSearchTerm };
}

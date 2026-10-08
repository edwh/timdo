import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { getActiveTasksPoster, type ActiveTasksPosterOptions } from '../lib/apiClient';

/**
 * React Query hook to fetch the Active Tasks poster SVG/JSON
 * Cached with refetchOnWindowFocus disabled (posters are large vector assets).
 */
export function useActiveTasksPoster(options: ActiveTasksPosterOptions = {}) {
  const { data: session } = useSession();

  return useQuery<string | any>({
    queryKey: ['poster', 'active', options],
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return getActiveTasksPoster(options, session.accessToken);
    },
    enabled: !!session?.accessToken,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

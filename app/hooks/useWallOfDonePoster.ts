import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  getWallOfDonePoster,
  type WallOfDoneJsonResponse,
  type WallOfDonePosterOptions,
  type WallOfDoneTiledResponse,
} from '../lib/apiClient';

export const posterKeys = {
  all: ['poster'] as const,
  wallOfDone: (options?: WallOfDonePosterOptions) =>
    [...posterKeys.all, 'wall-of-done', options] as const,
};

/**
 * React Query hook to fetch the Wall of Done poster
 * Cached with refetchOnWindowFocus disabled (posters are large vector assets).
 */
export function useWallOfDonePoster(options: WallOfDonePosterOptions = {}) {
  const { data: session } = useSession();

  return useQuery<string | WallOfDoneJsonResponse | WallOfDoneTiledResponse>({
    queryKey: posterKeys.wallOfDone(options),
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('Not authenticated');
      }
      return getWallOfDonePoster(options, session.accessToken);
    },
    enabled: !!session?.accessToken,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

import { useQuery } from '@tanstack/react-query';

export interface CustomerSummary {
  customer: string;
  openCount: number;
}

export function useCustomers() {
  return useQuery<CustomerSummary[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch('/api/v2/customers');
      if (!res.ok) {
        throw new Error('Failed to fetch customers');
      }
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}

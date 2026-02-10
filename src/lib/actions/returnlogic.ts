'use server';

import { getCustomerRMAs, type ReturnLogicRMA } from '@/lib/returnlogic';

export interface RMAHistoryResult {
  rmas: ReturnLogicRMA[];
  error?: string;
}

/**
 * Fetch customer's return history from Return Logic
 * Server action wrapper for the Return Logic API
 */
export async function fetchCustomerReturns(email: string): Promise<RMAHistoryResult> {
  if (!email) {
    return { rmas: [], error: 'No email provided' };
  }

  try {
    const result = await getCustomerRMAs(email);
    return result;
  } catch (error) {
    console.error('Error in fetchCustomerReturns:', error);
    return {
      rmas: [],
      error: error instanceof Error ? error.message : 'Failed to fetch returns',
    };
  }
}

/**
 * Return Logic API Service
 * Fetches customer RMAs/returns from Return Logic
 */

const RETURNLOGIC_API_KEY = process.env.RETURNLOGIC_API_KEY;
const RETURNLOGIC_BASE_URL = 'https://api.returnlogic.com/v1';

export interface ReturnLogicRMAItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  sku: string | null;
  reason: string | null;
}

export interface ReturnLogicRMA {
  id: string;
  rmaNumber: string;
  status: string;
  returnType: string; // 'refund', 'exchange', 'store_credit'
  createdAt: string;
  updatedAt: string;
  reason: string | null;
  items: ReturnLogicRMAItem[];
  refundAmount: string | null;
  creditAmount: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  orderNumber: string | null;
  customerEmail: string;
  customerName: string | null;
}

export interface ReturnLogicResponse {
  rmas: ReturnLogicRMA[];
  error?: string;
}

/**
 * Normalize status from API to consistent format
 */
function normalizeStatus(status: string): string {
  const statusLower = status.toLowerCase().replace(/[_-]/g, ' ');

  // Map common variations to standard statuses
  const statusMap: Record<string, string> = {
    'requested': 'requested',
    'pending': 'requested',
    'authorized': 'authorized',
    'approved': 'authorized',
    'in transit': 'in_transit',
    'shipped': 'in_transit',
    'received': 'received',
    'processing': 'processed',
    'processed': 'processed',
    'completed': 'completed',
    'complete': 'completed',
    'closed': 'completed',
    'rejected': 'rejected',
    'denied': 'rejected',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
  };

  return statusMap[statusLower] || status;
}

/**
 * Normalize return type from API
 */
function normalizeReturnType(returnType: string): string {
  const typeLower = returnType.toLowerCase().replace(/[_-]/g, ' ');

  const typeMap: Record<string, string> = {
    'refund': 'refund',
    'exchange': 'exchange',
    'store credit': 'store_credit',
    'storecredit': 'store_credit',
    'credit': 'store_credit',
  };

  return typeMap[typeLower] || returnType;
}

/**
 * Fetch RMAs by customer email
 */
export async function getCustomerRMAs(email: string): Promise<ReturnLogicResponse> {
  if (!RETURNLOGIC_API_KEY) {
    return {
      rmas: [],
      error: 'Return Logic integration not configured',
    };
  }

  try {
    const url = `${RETURNLOGIC_BASE_URL}/rmas?email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RETURNLOGIC_API_KEY}`,
        'Content-Type': 'application/json',
      },
      // Cache for 30 seconds to avoid excessive API calls
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Return Logic API error:', response.status, errorText);

      if (response.status === 401) {
        return { rmas: [], error: 'Invalid API key' };
      }
      if (response.status === 404) {
        // No RMAs found is not an error
        return { rmas: [] };
      }

      return { rmas: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();

    // Handle different API response formats
    const rawRmas = data.rmas || data.data || data || [];

    if (!Array.isArray(rawRmas)) {
      return { rmas: [] };
    }

    // Transform and normalize the response
    const rmas: ReturnLogicRMA[] = rawRmas.map((rma: Record<string, unknown>) => ({
      id: String(rma.id || rma._id || ''),
      rmaNumber: String(rma.rma_number || rma.rmaNumber || rma.number || rma.id || ''),
      status: normalizeStatus(String(rma.status || 'unknown')),
      returnType: normalizeReturnType(String(rma.return_type || rma.returnType || rma.type || 'refund')),
      createdAt: String(rma.created_at || rma.createdAt || new Date().toISOString()),
      updatedAt: String(rma.updated_at || rma.updatedAt || rma.created_at || rma.createdAt || new Date().toISOString()),
      reason: rma.reason ? String(rma.reason) : null,
      items: Array.isArray(rma.items || rma.line_items)
        ? ((rma.items || rma.line_items) as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
            id: String(item.id || ''),
            productName: String(item.product_name || item.productName || item.name || item.title || 'Unknown Item'),
            variantName: item.variant_name || item.variantName ? String(item.variant_name || item.variantName) : null,
            quantity: Number(item.quantity) || 1,
            sku: item.sku ? String(item.sku) : null,
            reason: item.reason ? String(item.reason) : null,
          }))
        : [],
      refundAmount: rma.refund_amount || rma.refundAmount ? String(rma.refund_amount || rma.refundAmount) : null,
      creditAmount: rma.credit_amount || rma.creditAmount ? String(rma.credit_amount || rma.creditAmount) : null,
      trackingNumber: rma.tracking_number || rma.trackingNumber ? String(rma.tracking_number || rma.trackingNumber) : null,
      trackingCarrier: rma.tracking_carrier || rma.trackingCarrier || rma.carrier ? String(rma.tracking_carrier || rma.trackingCarrier || rma.carrier) : null,
      orderNumber: rma.order_number || rma.orderNumber ? String(rma.order_number || rma.orderNumber) : null,
      customerEmail: String(rma.customer_email || rma.customerEmail || rma.email || email),
      customerName: rma.customer_name || rma.customerName ? String(rma.customer_name || rma.customerName) : null,
    }));

    // Sort by created date, most recent first
    rmas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { rmas };
  } catch (error) {
    console.error('Error fetching Return Logic RMAs:', error);
    return {
      rmas: [],
      error: error instanceof Error ? error.message : 'Failed to fetch returns',
    };
  }
}

/**
 * Get the Return Logic admin URL for an RMA
 */
export function getRMAAdminUrl(rmaId: string): string {
  return `https://originate.returnlogic.com/originate/rma/${rmaId}`;
}

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
  const statusLower = status.toLowerCase().replace(/[_-]/g, ' ').trim();

  // Map common variations to standard statuses
  const statusMap: Record<string, string> = {
    // Requested
    'requested': 'requested',
    'pending': 'requested',
    'new': 'requested',
    'open': 'requested',
    // Authorized
    'authorized': 'authorized',
    'approved': 'authorized',
    // In Transit
    'in transit': 'in_transit',
    'intransit': 'in_transit',
    'shipped': 'in_transit',
    'shipping': 'in_transit',
    // Delivered
    'delivered': 'delivered',
    // Partially Received
    'partially received': 'partially_received',
    'partial received': 'partially_received',
    // Received
    'received': 'received',
    // Partially Processed
    'partially processed': 'partially_processed',
    'partial processed': 'partially_processed',
    // Processed
    'processing': 'processed',
    'processed': 'processed',
    // Complete
    'completed': 'complete',
    'complete': 'complete',
    'closed': 'complete',
    'resolved': 'complete',
    // Canceled
    'cancelled': 'canceled',
    'canceled': 'canceled',
    // Abandoned
    'abandoned': 'abandoned',
    'expired': 'abandoned',
    // Rejected
    'rejected': 'rejected',
    'denied': 'rejected',
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

    // DEBUG: Log the full API response structure
    console.log('=== RETURN LOGIC API RESPONSE ===');
    console.log('Full response:', JSON.stringify(data, null, 2));
    console.log('Response type:', typeof data);
    console.log('Response keys:', Object.keys(data));

    // Handle different API response formats
    const rawRmas = data.rmas || data.data || data.results || data || [];

    console.log('Raw RMAs type:', typeof rawRmas, 'isArray:', Array.isArray(rawRmas));
    if (Array.isArray(rawRmas) && rawRmas.length > 0) {
      console.log('First RMA object keys:', Object.keys(rawRmas[0]));
      console.log('First RMA full object:', JSON.stringify(rawRmas[0], null, 2));
    }
    console.log('=== END RETURN LOGIC DEBUG ===');

    if (!Array.isArray(rawRmas)) {
      console.log('rawRmas is not an array, returning empty');
      return { rmas: [] };
    }

    // Transform and normalize the response
    const rmas: ReturnLogicRMA[] = rawRmas.map((rma: Record<string, unknown>) => {
      // Log each RMA's key fields for debugging
      console.log('Processing RMA:', {
        id: rma.id,
        _id: rma._id,
        rmaId: rma.rmaId,
        rma_id: rma.rma_id,
        rlRmaId: rma.rlRmaId,
        rl_rma_id: rma.rl_rma_id,
        rmaNumber: rma.rmaNumber,
        rma_number: rma.rma_number,
        number: rma.number,
        status: rma.status,
        workflowStatus: rma.workflowStatus,
        workflow_status: rma.workflow_status,
        state: rma.state,
      });

      // Determine the best ID to use for the Return Logic URL
      const rmaId = String(rma.rlRmaId || rma.rl_rma_id || rma.rmaId || rma.rma_id || rma.id || rma._id || '');
      // RMA number for display (may be different from ID)
      const rmaNumber = String(rma.rmaNumber || rma.rma_number || rma.number || rma.rlRmaId || rma.id || '');
      // Status - check multiple possible field names
      const statusValue = rma.workflowStatus || rma.workflow_status || rma.status || rma.state || 'unknown';

      return {
      id: rmaId,
      rmaNumber: rmaNumber,
      status: normalizeStatus(String(statusValue)),
      returnType: normalizeReturnType(String(rma.return_type || rma.returnType || rma.resolution_type || rma.resolutionType || rma.type || 'refund')),
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
    };
    });

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

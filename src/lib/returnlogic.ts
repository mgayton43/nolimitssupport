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
  reasonComment: string | null;
  returnType: string | null;
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
  exchangeAmount: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  trackingUrl: string | null;
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

    // Handle different API response formats
    const rawRmas = data.rmas || data.data || data.results || data || [];

    if (!Array.isArray(rawRmas)) {
      console.log('rawRmas is not an array, returning empty');
      return { rmas: [] };
    }

    // Transform and normalize the response
    const rmas: ReturnLogicRMA[] = rawRmas.map((rma: Record<string, unknown>) => {
      // Extract nested objects
      const timeline = rma.timeline as Record<string, unknown> | null;
      const totals = rma.totals as Record<string, Record<string, unknown>> | null;
      const shippingLabel = rma.shippingLabel as Record<string, unknown> | null;
      const rmaItems = rma.rmaItems as Record<string, unknown>[] | null;

      // RMA ID for URL (rlRmaId is the correct field)
      const rmaId = String(rma.rlRmaId || rma.id || '');

      // Status from workflowStatus
      const statusValue = rma.workflowStatus || rma.status || 'unknown';

      // Order number from orderName
      const orderNumber = rma.orderName ? String(rma.orderName) : null;

      // Created date from timeline.createDate
      const createdAt = timeline?.createDate
        ? String(timeline.createDate)
        : String(rma.createdAt || rma.created_at || new Date().toISOString());

      // Determine return type from items or totals
      let returnType = 'refund';
      if (totals?.exchange?.total && Number(totals.exchange.total) > 0) {
        returnType = 'exchange';
      } else if (totals?.giftCard?.total && Number(totals.giftCard.total) > 0) {
        returnType = 'store_credit';
      }

      // Get amounts from totals
      const refundAmount = totals?.refund?.total ? String(totals.refund.total) : null;
      const exchangeAmount = totals?.exchange?.total ? String(totals.exchange.total) : null;
      const creditAmount = totals?.giftCard?.total ? String(totals.giftCard.total) : null;

      // Tracking info from shippingLabel
      const trackingNumber = shippingLabel?.trackingNumber ? String(shippingLabel.trackingNumber) : null;
      const trackingCarrier = shippingLabel?.carrier ? String(shippingLabel.carrier) : null;
      const trackingUrl = shippingLabel?.trackingUrl ? String(shippingLabel.trackingUrl) : null;

      // Map items from rmaItems array
      const items: ReturnLogicRMAItem[] = Array.isArray(rmaItems)
        ? rmaItems.map((item: Record<string, unknown>) => ({
            id: String(item.id || item.rmaItemId || ''),
            productName: String(item.name || item.productName || 'Unknown Item'),
            variantName: item.variantName ? String(item.variantName) : null,
            quantity: Number(item.quantity) || 1,
            sku: item.sku ? String(item.sku) : null,
            reason: item.returnReasonDescription ? String(item.returnReasonDescription) : null,
            reasonComment: item.returnReasonComment ? String(item.returnReasonComment) : null,
            returnType: item.returnType ? String(item.returnType) : null,
          }))
        : [];

      // Get overall reason from first item if available
      const reason = items.length > 0 && items[0].reason ? items[0].reason : null;

      return {
        id: rmaId,
        rmaNumber: rmaId, // Use rlRmaId as the display number
        status: normalizeStatus(String(statusValue)),
        returnType: normalizeReturnType(returnType),
        createdAt,
        updatedAt: createdAt,
        reason,
        items,
        refundAmount,
        creditAmount,
        exchangeAmount,
        trackingNumber,
        trackingCarrier,
        trackingUrl,
        orderNumber,
        customerEmail: String(rma.customerEmail || rma.email || email),
        customerName: rma.customerName ? String(rma.customerName) : null,
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

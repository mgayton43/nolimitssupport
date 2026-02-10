'use server';

import { getCustomerOrders, getOrderAdminUrl, getCustomerAdminUrl, type ShopifyOrder, type ShopifyCustomer, type ShopifyAddress } from '@/lib/shopify';

/**
 * Format customer location as "City, ST ZIP"
 */
function formatCustomerLocation(address: ShopifyAddress | null | undefined): string | null {
  if (!address) return null;

  const parts: string[] = [];

  if (address.city) {
    parts.push(address.city);
  }

  // Use province_code (e.g., "OH") or province (e.g., "Ohio")
  const state = address.province_code || address.province;
  if (state) {
    if (parts.length > 0) {
      parts.push(state);
    } else {
      parts.push(state);
    }
  }

  // Add ZIP code
  if (address.zip) {
    if (parts.length > 0) {
      // Join city and state with comma, then add ZIP with space
      const cityState = parts.join(', ');
      return `${cityState} ${address.zip}`;
    }
    return address.zip;
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

export interface OrderHistoryResult {
  customer: {
    id: number;
    name: string;
    email: string;
    ordersCount: number;
    totalSpent: string;
    adminUrl: string;
    location: string | null; // "City, ST ZIP" format
  } | null;
  orders: {
    id: number;
    orderNumber: number;
    name: string;
    createdAt: string;
    cancelledAt: string | null;
    financialStatus: string;
    fulfillmentStatus: string | null;
    totalPrice: string;
    currency: string;
    orderStatusUrl: string;
    adminUrl: string;
    lineItems: {
      id: number;
      title: string;
      quantity: number;
      price: string;
      variantTitle: string | null;
    }[];
    tracking: {
      number: string | null;
      url: string | null;
      company: string | null;
      shipmentStatus: string | null;
    } | null;
  }[];
  error?: string;
}

/**
 * Server action to fetch customer order history from Shopify
 * Keeps API credentials server-side
 */
export async function fetchCustomerOrderHistory(email: string): Promise<OrderHistoryResult> {
  if (!email) {
    return { customer: null, orders: [], error: 'No email provided' };
  }

  const result = await getCustomerOrders(email);

  if (result.error) {
    return { customer: null, orders: [], error: result.error };
  }

  // Transform to a cleaner format for the frontend
  const customer = result.customer
    ? {
        id: result.customer.id,
        name: [result.customer.first_name, result.customer.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: result.customer.email,
        ordersCount: result.customer.orders_count,
        totalSpent: result.customer.total_spent,
        adminUrl: getCustomerAdminUrl(result.customer.id),
        location: formatCustomerLocation(result.customer.default_address),
      }
    : null;

  const orders = result.orders.map((order) => {
    // Get the most recent fulfillment with tracking
    const fulfillmentWithTracking = order.fulfillments?.find(
      (f) => f.tracking_number || f.tracking_url
    );

    // Get the shipment status from any fulfillment (prefer one with shipment_status)
    const fulfillmentWithShipmentStatus = order.fulfillments?.find(
      (f) => f.shipment_status
    ) || fulfillmentWithTracking;

    return {
      id: order.id,
      orderNumber: order.order_number,
      name: order.name,
      createdAt: order.created_at,
      cancelledAt: order.cancelled_at,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: order.total_price,
      currency: order.currency,
      orderStatusUrl: order.order_status_url,
      adminUrl: getOrderAdminUrl(order.id),
      lineItems: order.line_items.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        variantTitle: item.variant_title,
      })),
      tracking: fulfillmentWithTracking
        ? {
            number: fulfillmentWithTracking.tracking_number,
            url: fulfillmentWithTracking.tracking_url,
            company: fulfillmentWithTracking.tracking_company,
            shipmentStatus: fulfillmentWithShipmentStatus?.shipment_status || null,
          }
        : null,
    };
  });

  return { customer, orders };
}

/**
 * Server action to fetch just customer info (without orders) - faster for sidebar display
 */
export async function fetchShopifyCustomerInfo(email: string): Promise<{
  customer: {
    id: number;
    name: string;
    adminUrl: string;
    location: string | null;
  } | null;
  error?: string;
}> {
  if (!email) {
    return { customer: null, error: 'No email provided' };
  }

  try {
    const { findCustomerByEmail, getCustomerAdminUrl } = await import('@/lib/shopify');
    const shopifyCustomer = await findCustomerByEmail(email);

    if (!shopifyCustomer) {
      return { customer: null };
    }

    return {
      customer: {
        id: shopifyCustomer.id,
        name: [shopifyCustomer.first_name, shopifyCustomer.last_name].filter(Boolean).join(' ') || 'Unknown',
        adminUrl: getCustomerAdminUrl(shopifyCustomer.id),
        location: formatCustomerLocation(shopifyCustomer.default_address),
      },
    };
  } catch (error) {
    console.error('Error fetching Shopify customer info:', error);
    return { customer: null, error: 'Failed to fetch customer info' };
  }
}

/**
 * Shopify API Service
 * Uses client credentials grant for authentication (new Dev Dashboard method)
 */

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL!;
const API_VERSION = '2024-01';

// Token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

export interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string; // e.g., "#1001"
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  order_status_url: string;
  line_items: ShopifyLineItem[];
  fulfillments: ShopifyFulfillment[];
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string | null;
  variant_title: string | null;
}

export interface ShopifyFulfillment {
  id: number;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_company: string | null;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  orders_count: number;
  total_spent: string;
}

/**
 * Get an access token using client credentials grant
 * Caches the token and refreshes when expired
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token (with 5 min buffer)
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const tokenUrl = `https://${SHOPIFY_STORE_URL}/admin/oauth/access_token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shopify token error:', errorText);
    throw new Error(`Failed to get Shopify access token: ${response.status}`);
  }

  const data = await response.json();

  // Cache the token - expires in 24 hours but we'll refresh earlier
  cachedToken = data.access_token;
  // Set expiry to 23 hours from now (1 hour buffer)
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;

  return data.access_token as string;
}

/**
 * Make an authenticated request to the Shopify Admin API
 */
async function shopifyFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const url = `https://${SHOPIFY_STORE_URL}/admin/api/${API_VERSION}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shopify API error:', response.status, errorText);
    throw new Error(`Shopify API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search for a customer by email
 */
export async function findCustomerByEmail(email: string): Promise<ShopifyCustomer | null> {
  try {
    const data = await shopifyFetch<{ customers: ShopifyCustomer[] }>(
      `/customers/search.json?query=email:${encodeURIComponent(email)}`
    );

    if (data.customers && data.customers.length > 0) {
      return data.customers[0];
    }

    return null;
  } catch (error) {
    console.error('Error finding Shopify customer:', error);
    return null;
  }
}

/**
 * Get orders for a customer by their Shopify customer ID
 */
export async function getOrdersByCustomerId(customerId: number): Promise<ShopifyOrder[]> {
  try {
    const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(
      `/customers/${customerId}/orders.json?status=any&limit=10`
    );

    return data.orders || [];
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    return [];
  }
}

/**
 * Get orders by customer email - main function to use
 * Returns orders sorted by date (most recent first)
 */
export async function getCustomerOrders(email: string): Promise<{
  customer: ShopifyCustomer | null;
  orders: ShopifyOrder[];
  error?: string;
}> {
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET || !SHOPIFY_STORE_URL) {
    return {
      customer: null,
      orders: [],
      error: 'Shopify integration not configured',
    };
  }

  try {
    // First find the customer by email
    const customer = await findCustomerByEmail(email);

    if (!customer) {
      return {
        customer: null,
        orders: [],
      };
    }

    // Then get their orders
    const orders = await getOrdersByCustomerId(customer.id);

    // Sort by created_at descending (most recent first)
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      customer,
      orders,
    };
  } catch (error) {
    console.error('Error in getCustomerOrders:', error);
    return {
      customer: null,
      orders: [],
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
    };
  }
}

/**
 * Get the Shopify admin URL for an order
 */
export function getOrderAdminUrl(orderId: number): string {
  return `https://${SHOPIFY_STORE_URL}/admin/orders/${orderId}`;
}

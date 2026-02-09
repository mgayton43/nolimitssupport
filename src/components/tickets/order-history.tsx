'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Package, ExternalLink, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchCustomerOrderHistory, type OrderHistoryResult } from '@/lib/actions/shopify';
import { formatRelativeTime } from '@/lib/utils';

interface OrderHistoryProps {
  customerEmail: string | null;
}

const financialStatusColors: Record<string, string> = {
  paid: 'text-green-600 dark:text-green-400',
  pending: 'text-yellow-600 dark:text-yellow-400',
  refunded: 'text-red-600 dark:text-red-400',
  partially_refunded: 'text-orange-600 dark:text-orange-400',
  voided: 'text-zinc-500 dark:text-zinc-400',
};

// Order status configuration with labels and colors
type OrderDisplayStatus =
  | 'cancelled'
  | 'refunded'
  | 'delivered'
  | 'in_transit'
  | 'out_for_delivery'
  | 'fulfilled'
  | 'partial'
  | 'unfulfilled';

const orderStatusConfig: Record<OrderDisplayStatus, { label: string; className: string }> = {
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  in_transit: {
    label: 'In Transit',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  fulfilled: {
    label: 'Fulfilled',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  partial: {
    label: 'Partially Fulfilled',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  unfulfilled: {
    label: 'Unfulfilled',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
};

/**
 * Determine the display status based on order data
 * Priority: Cancelled > Refunded > Shipment Status > Fulfillment Status
 */
function getOrderDisplayStatus(order: {
  cancelledAt: string | null;
  financialStatus: string;
  fulfillmentStatus: string | null;
  tracking: { shipmentStatus: string | null } | null;
}): OrderDisplayStatus {
  // Check if cancelled
  if (order.cancelledAt) {
    return 'cancelled';
  }

  // Check if refunded
  if (order.financialStatus === 'refunded') {
    return 'refunded';
  }

  // Check shipment status from tracking
  if (order.tracking?.shipmentStatus) {
    const shipmentStatus = order.tracking.shipmentStatus.toLowerCase();
    if (shipmentStatus === 'delivered') {
      return 'delivered';
    }
    if (shipmentStatus === 'in_transit' || shipmentStatus === 'in transit') {
      return 'in_transit';
    }
    if (shipmentStatus === 'out_for_delivery' || shipmentStatus === 'out for delivery') {
      return 'out_for_delivery';
    }
  }

  // Fall back to fulfillment status
  const fulfillmentStatus = order.fulfillmentStatus || 'unfulfilled';
  if (fulfillmentStatus === 'fulfilled') {
    return 'fulfilled';
  }
  if (fulfillmentStatus === 'partial') {
    return 'partial';
  }

  return 'unfulfilled';
}

function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(num);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function OrderHistory({ customerEmail }: OrderHistoryProps) {
  const [data, setData] = useState<OrderHistoryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!customerEmail) {
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const result = await fetchCustomerOrderHistory(customerEmail);
        if (!cancelled) {
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch order history:', error);
        if (!cancelled) {
          setData({ customer: null, orders: [], error: 'Failed to load orders' });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      cancelled = true;
    };
  }, [customerEmail]);

  const toggleOrderExpanded = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  if (!customerEmail) {
    return null;
  }

  return (
    <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <ShoppingBag className="h-3.5 w-3.5" />
        Order History
      </label>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          Loading orders...
        </div>
      )}

      {!isLoading && data?.error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {data.error}
        </div>
      )}

      {!isLoading && !data?.error && data?.orders.length === 0 && (
        <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
          No orders found for this customer
        </p>
      )}

      {!isLoading && !data?.error && data && data.orders.length > 0 && (
        <div className="space-y-2">
          {/* Customer summary */}
          {data.customer && (
            <div className="rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-800/50">
              <span className="font-medium">{data.customer.ordersCount} orders</span>
              <span className="text-zinc-500 dark:text-zinc-400"> · </span>
              <span className="text-zinc-600 dark:text-zinc-300">
                {formatCurrency(data.customer.totalSpent, 'USD')} lifetime
              </span>
            </div>
          )}

          {/* Orders list */}
          <div className="space-y-2">
            {data.orders.slice(0, 5).map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const displayStatus = getOrderDisplayStatus(order);
              const statusConfig = orderStatusConfig[displayStatus];

              return (
                <div
                  key={order.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                >
                  {/* Order header - always visible */}
                  <button
                    onClick={() => toggleOrderExpanded(order.id)}
                    className="w-full p-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-zinc-400" />
                        <span className="font-medium text-sm">{order.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${financialStatusColors[order.financialStatus] || 'text-zinc-500'}`}>
                          {formatCurrency(order.totalPrice, order.currency)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{formatDate(order.createdAt)}</span>
                      <span>·</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusConfig.className}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 dark:border-zinc-700 p-2 bg-zinc-50/50 dark:bg-zinc-800/30">
                      {/* Line items */}
                      <div className="space-y-1 mb-2">
                        {order.lineItems.slice(0, 5).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="text-zinc-600 dark:text-zinc-300 truncate flex-1 mr-2">
                              {item.quantity}x {item.title}
                              {item.variantTitle && (
                                <span className="text-zinc-400"> ({item.variantTitle})</span>
                              )}
                            </span>
                            <span className="text-zinc-500 shrink-0">
                              {formatCurrency(item.price, order.currency)}
                            </span>
                          </div>
                        ))}
                        {order.lineItems.length > 5 && (
                          <div className="text-xs text-zinc-400">
                            +{order.lineItems.length - 5} more items
                          </div>
                        )}
                      </div>

                      {/* Tracking info */}
                      {order.tracking && order.tracking.number && (
                        <div className="mb-2 rounded-md bg-zinc-100 dark:bg-zinc-800 p-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                            <Truck className="h-3.5 w-3.5" />
                            Tracking Information
                          </div>
                          <div className="grid gap-1 text-xs">
                            {order.tracking.company && (
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-500 dark:text-zinc-400">Carrier:</span>
                                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                  {order.tracking.company}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-500 dark:text-zinc-400">Tracking #:</span>
                              <span className="font-mono text-zinc-700 dark:text-zinc-200">
                                {order.tracking.number}
                              </span>
                            </div>
                            {order.tracking.shipmentStatus && (
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-500 dark:text-zinc-400">Status:</span>
                                <span className="font-medium text-zinc-700 dark:text-zinc-200 capitalize">
                                  {order.tracking.shipmentStatus.replace(/_/g, ' ')}
                                </span>
                              </div>
                            )}
                          </div>
                          {order.tracking.url && (
                            <a
                              href={order.tracking.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1.5 mt-2 py-1.5 px-3 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Track Package
                            </a>
                          )}
                        </div>
                      )}

                      {/* Action links */}
                      <div className="flex items-center gap-3 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                        <a
                          href={order.adminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View in Shopify
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                          href={order.orderStatusUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Customer view
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {data.orders.length > 5 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                Showing 5 of {data.orders.length} orders
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

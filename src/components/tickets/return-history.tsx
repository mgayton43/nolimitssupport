'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, ExternalLink, AlertCircle, ChevronDown, ChevronUp, Package, Truck } from 'lucide-react';
import { fetchCustomerReturns, type RMAHistoryResult } from '@/lib/actions/returnlogic';
import { getRMAAdminUrl, type ReturnLogicRMA } from '@/lib/returnlogic';

interface ReturnHistoryProps {
  customerEmail: string | null;
}

// Status configuration with labels and colors
type RMAStatus = 'requested' | 'authorized' | 'in_transit' | 'received' | 'processed' | 'completed' | 'rejected' | 'cancelled' | 'unknown';

const statusConfig: Record<RMAStatus, { label: string; className: string }> = {
  requested: {
    label: 'Requested',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  authorized: {
    label: 'Authorized',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  in_transit: {
    label: 'In Transit',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  received: {
    label: 'Received',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  processed: {
    label: 'Processed',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
};

// Return type labels
const returnTypeLabels: Record<string, string> = {
  refund: 'Refund',
  exchange: 'Exchange',
  store_credit: 'Store Credit',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

function getStatusConfig(status: string) {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, '_') as RMAStatus;
  return statusConfig[normalizedStatus] || statusConfig.unknown;
}

export function ReturnHistory({ customerEmail }: ReturnHistoryProps) {
  const [data, setData] = useState<RMAHistoryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRMAs, setExpandedRMAs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!customerEmail) {
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchReturns = async () => {
      setIsLoading(true);
      try {
        const result = await fetchCustomerReturns(customerEmail);
        if (!cancelled) {
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch return history:', error);
        if (!cancelled) {
          setData({ rmas: [], error: 'Failed to load returns' });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchReturns();

    return () => {
      cancelled = true;
    };
  }, [customerEmail]);

  const toggleRMAExpanded = (rmaId: string) => {
    setExpandedRMAs((prev) => {
      const next = new Set(prev);
      if (next.has(rmaId)) {
        next.delete(rmaId);
      } else {
        next.add(rmaId);
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
        <RotateCcw className="h-3.5 w-3.5" />
        Returns
      </label>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          Loading returns...
        </div>
      )}

      {!isLoading && data?.error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Unable to load returns
        </div>
      )}

      {!isLoading && !data?.error && data?.rmas.length === 0 && (
        <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
          No returns found
        </p>
      )}

      {!isLoading && !data?.error && data && data.rmas.length > 0 && (
        <div className="space-y-2">
          {data.rmas.slice(0, 5).map((rma) => {
            const isExpanded = expandedRMAs.has(rma.id);
            const config = getStatusConfig(rma.status);
            const returnTypeLabel = returnTypeLabels[rma.returnType] || rma.returnType;

            return (
              <div
                key={rma.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
              >
                {/* RMA header - always visible */}
                <button
                  onClick={() => toggleRMAExpanded(rma.id)}
                  className="w-full p-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-zinc-400" />
                      <span className="font-medium text-sm">RMA #{rma.rmaNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {returnTypeLabel}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{formatDate(rma.createdAt)}</span>
                    <span>·</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${config.className}`}>
                      {config.label}
                    </span>
                    {rma.orderNumber && (
                      <>
                        <span>·</span>
                        <span>Order {rma.orderNumber}</span>
                      </>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-700 p-2 bg-zinc-50/50 dark:bg-zinc-800/30">
                    {/* Return reason */}
                    {rma.reason && (
                      <div className="mb-2 text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400">Reason: </span>
                        <span className="text-zinc-700 dark:text-zinc-200">{rma.reason}</span>
                      </div>
                    )}

                    {/* Items */}
                    {rma.items.length > 0 && (
                      <div className="space-y-1 mb-2">
                        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Items ({rma.items.length})
                        </div>
                        {rma.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs pl-4">
                            <span className="text-zinc-600 dark:text-zinc-300 truncate flex-1 mr-2">
                              {item.quantity}x {item.productName}
                              {item.variantName && (
                                <span className="text-zinc-400"> ({item.variantName})</span>
                              )}
                            </span>
                            {item.sku && (
                              <span className="text-zinc-400 shrink-0 font-mono text-[10px]">
                                {item.sku}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Amount */}
                    {(rma.refundAmount || rma.creditAmount) && (
                      <div className="mb-2 text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {rma.returnType === 'refund' ? 'Refund: ' : 'Credit: '}
                        </span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">
                          {formatCurrency(rma.refundAmount || rma.creditAmount || '0')}
                        </span>
                      </div>
                    )}

                    {/* Tracking info */}
                    {rma.trackingNumber && (
                      <div className="mb-2 rounded-md bg-zinc-100 dark:bg-zinc-800 p-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          <Truck className="h-3.5 w-3.5" />
                          Return Shipment
                        </div>
                        <div className="grid gap-1 text-xs">
                          {rma.trackingCarrier && (
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-500 dark:text-zinc-400">Carrier:</span>
                              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                {rma.trackingCarrier}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">Tracking #:</span>
                            <span className="font-mono text-zinc-700 dark:text-zinc-200">
                              {rma.trackingNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action link */}
                    <div className="flex items-center gap-3 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                      <a
                        href={getRMAAdminUrl(rma.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View in Return Logic
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {data.rmas.length > 5 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
              Showing 5 of {data.rmas.length} returns
            </p>
          )}
        </div>
      )}
    </div>
  );
}

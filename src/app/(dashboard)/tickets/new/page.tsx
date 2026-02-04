'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createTicket } from '@/lib/actions/tickets';

export default function NewTicketPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const result = await createTicket({
      subject: formData.get('subject') as string,
      priority: (formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
      customerEmail: formData.get('customerEmail') as string,
      customerName: formData.get('customerName') as string,
      message: formData.get('message') as string,
    });

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    router.push(`/tickets/${result.ticketId}`);
  };

  return (
    <div className="flex h-full flex-col">
      <Header title="New Ticket" />

      <div className="flex-1 overflow-auto p-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Create a new support ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="customerName" className="text-sm font-medium">
                    Customer Name
                  </label>
                  <Input
                    id="customerName"
                    name="customerName"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="customerEmail" className="text-sm font-medium">
                    Customer Email
                  </label>
                  <Input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium">
                  Subject
                </label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder="Brief description of the issue"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="priority" className="text-sm font-medium">
                  Priority
                </label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium">
                  Initial Message
                </label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Describe the customer's issue..."
                  rows={6}
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Ticket'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

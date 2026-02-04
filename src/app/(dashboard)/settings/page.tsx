'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { updateProfile } from '@/lib/actions/profile';
import { getInitials } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);

    const result = await updateProfile({
      full_name: formData.get('full_name') as string,
    });

    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      router.refresh();
    }

    setIsLoading(false);
  };

  return (
    <div className="flex h-full flex-col">
      <Header title="Settings" />

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {message && (
                  <div
                    className={`rounded-md p-3 text-sm ${
                      message.type === 'error'
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Avatar
                    src={profile?.avatar_url}
                    fallback={getInitials(profile?.full_name)}
                    size="lg"
                    className="h-20 w-20 text-xl"
                  />
                  <div>
                    <p className="font-medium">{profile?.full_name || 'Your Name'}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{profile?.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="full_name" className="text-sm font-medium">
                      Full Name
                    </label>
                    <Input
                      id="full_name"
                      name="full_name"
                      defaultValue={profile?.full_name || ''}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="bg-zinc-50 dark:bg-zinc-900"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Input
                      value={profile?.role || ''}
                      disabled
                      className="bg-zinc-50 capitalize dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

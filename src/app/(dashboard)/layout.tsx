import { Sidebar } from '@/components/layout/sidebar';
import { RealtimeProvider } from '@/components/providers/realtime-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RealtimeProvider>
      <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </RealtimeProvider>
  );
}

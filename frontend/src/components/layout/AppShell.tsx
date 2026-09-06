import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { DemoBar } from '@/components/demo/DemoBar';

/**
 * The phone-width app frame: a scrollable content area with a role-aware
 * bottom nav pinned below. Individual pages render their own TopBar so the
 * header can carry a page-specific title and actions.
 */
export function AppShell() {
  return (
    <div className="app-frame relative min-h-dvh">
      <main className="flex-1 pb-4">
        <Outlet />
      </main>
      <BottomNav />
      <DemoBar />
    </div>
  );
}

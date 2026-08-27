import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/store/auth';
import type { Role } from '@/lib/types';
import { AppShell } from '@/components/layout/AppShell';

import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { NotFound } from '@/pages/NotFound';
import { Profile } from '@/pages/Profile';
import { UdhaarDetail } from '@/pages/UdhaarDetail';

import { CustomerHome } from '@/pages/customer/Home';
import { Khatas } from '@/pages/customer/Khatas';
import { Scan } from '@/pages/customer/Scan';
import { ShopView } from '@/pages/customer/ShopView';
import { Pay } from '@/pages/customer/Pay';
import { Notifications } from '@/pages/customer/Notifications';

import { MerchantHome } from '@/pages/merchant/Home';
import { Requests } from '@/pages/merchant/Requests';
import { Customers } from '@/pages/merchant/Customers';
import { QrManage } from '@/pages/merchant/QrManage';

import { AdminOverviewPage } from '@/pages/admin/Overview';
import { AdminUsersPage } from '@/pages/admin/Users';
import { AdminMerchantsPage } from '@/pages/admin/Merchants';
import { AdminAuditPage } from '@/pages/admin/Audit';

/** Where each role lands after login. */
export function homePathFor(role: Role | undefined): string {
  if (role === 'MERCHANT' || role === 'STAFF') return '/merchant';
  if (role === 'ADMIN') return '/admin';
  return '/app';
}

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthed = useAuth((s) => Boolean(s.token && s.user));
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useAuth((s) => s.user?.role);
  if (role && !roles.includes(role)) return <Navigate to={homePathFor(role)} replace />;
  return <>{children}</>;
}

/** Redirects the index route to the signed-in user's home (or landing). */
function RoleHome() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  if (!token || !user) return <Landing />;
  return <Navigate to={homePathFor(user.role)} replace />;
}

/** Deep-link target `${appBaseUrl}/s/:token` — send scanner into the shop view. */
function ShopDeepLink() {
  const { token } = useParams();
  const isAuthed = useAuth((s) => Boolean(s.token && s.user));
  if (!isAuthed) return <Navigate to="/login" state={{ from: `/app/shop/${token}` }} replace />;
  return <Navigate to={`/app/shop/${token}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/s/:token" element={<ShopDeepLink />} />

      {/* Customer */}
      <Route
        element={
          <RequireAuth>
            <RequireRole roles={['CUSTOMER']}>
              <AppShell />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="/app" element={<CustomerHome />} />
        <Route path="/app/khatas" element={<Khatas />} />
        <Route path="/app/scan" element={<Scan />} />
        <Route path="/app/shop/:token" element={<ShopView />} />
        <Route path="/app/udhaar/:id" element={<UdhaarDetail />} />
        <Route path="/app/udhaar/:id/pay" element={<Pay />} />
        <Route path="/app/notifications" element={<Notifications />} />
        <Route path="/app/profile" element={<Profile />} />
      </Route>

      {/* Merchant */}
      <Route
        element={
          <RequireAuth>
            <RequireRole roles={['MERCHANT', 'STAFF']}>
              <AppShell />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="/merchant" element={<MerchantHome />} />
        <Route path="/merchant/requests" element={<Requests />} />
        <Route path="/merchant/customers" element={<Customers />} />
        <Route path="/merchant/qr" element={<QrManage />} />
        <Route path="/merchant/udhaar/:id" element={<UdhaarDetail />} />
        <Route path="/merchant/notifications" element={<Notifications />} />
        <Route path="/merchant/profile" element={<Profile />} />
      </Route>

      {/* Admin */}
      <Route
        element={
          <RequireAuth>
            <RequireRole roles={['ADMIN']}>
              <AppShell />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="/admin" element={<AdminOverviewPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/merchants" element={<AdminMerchantsPage />} />
        <Route path="/admin/audit" element={<AdminAuditPage />} />
        <Route path="/admin/notifications" element={<Notifications />} />
        <Route path="/admin/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

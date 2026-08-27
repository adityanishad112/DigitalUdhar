import type { UserRole } from '../db/schema/enums';

export interface AuthUser {
  id: string;
  role: UserRole;
  mobile: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Set by the merchant-context middleware for merchant/staff routes. */
      merchantId?: string;
    }
  }
}

export {};

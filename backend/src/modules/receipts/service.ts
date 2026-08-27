import { desc, eq } from 'drizzle-orm';
import type { Tx } from '../../db/client';
import { db } from '../../db/client';
import { receipts } from '../../db/schema';
import type { PaymentMethod, ReceiptType } from '../../db/schema/enums';
import { formatReceiptNo } from '../../core/ids';

export type Receipt = typeof receipts.$inferSelect;

export interface CreateReceiptParams {
  type: ReceiptType;
  udhaarId?: string | null;
  paymentId?: string | null;
  merchantId: string;
  customerUserId: string;
  amountPaise: number;
  outstandingAfterPaise: number;
  method?: PaymentMethod;
  /** Immutable point-in-time snapshot of the transaction context. */
  snapshot: Record<string, unknown>;
}

/** Create an immutable receipt. Never updated or deleted after creation. */
export async function createReceipt(tx: Tx, params: CreateReceiptParams): Promise<Receipt> {
  const [receipt] = await tx
    .insert(receipts)
    .values({
      receiptNo: formatReceiptNo(),
      type: params.type,
      udhaarId: params.udhaarId ?? null,
      paymentId: params.paymentId ?? null,
      merchantId: params.merchantId,
      customerUserId: params.customerUserId,
      amountPaise: params.amountPaise,
      outstandingAfterPaise: params.outstandingAfterPaise,
      method: params.method,
      snapshot: params.snapshot,
    })
    .returning();
  return receipt;
}

export async function getReceipt(receiptNo: string): Promise<Receipt | null> {
  const [r] = await db.select().from(receipts).where(eq(receipts.receiptNo, receiptNo)).limit(1);
  return r ?? null;
}

export async function listReceiptsForUdhaar(udhaarId: string): Promise<Receipt[]> {
  return db
    .select()
    .from(receipts)
    .where(eq(receipts.udhaarId, udhaarId))
    .orderBy(desc(receipts.createdAt));
}

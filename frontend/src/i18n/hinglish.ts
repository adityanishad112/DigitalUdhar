import type { I18nKey } from './en';

/** Hinglish — Hindi phrasing in Roman script, how many shopkeepers actually type. */
export const hinglish: Partial<Record<I18nKey, string>> = {
  'app.tagline': 'Scan karo. Udhaar lo. Baad mein pay karo.',

  'nav.home': 'Home',
  'nav.scan': 'Scan',
  'nav.khata': 'Khate',
  'nav.activity': 'Activity',
  'nav.profile': 'Profile',
  'nav.requests': 'Requests',
  'nav.reports': 'Report',
  'nav.customers': 'Customers',

  'common.continue': 'Aage badho',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm karo',
  'common.back': 'Wapas',
  'common.retry': 'Dobara try karo',
  'common.due': 'Due',
  'common.outstanding': 'Baaki',
  'common.paid': 'Chukaya',
  'common.cleared': 'Clear',
  'common.amount': 'Amount',
  'common.viewAll': 'Sab dekho',

  'login.title': 'Welcome',
  'login.subtitle': 'Apne mobile number se login karo',
  'login.mobile': 'Mobile number',
  'login.role': 'Main hoon',
  'login.role.customer': 'Customer',
  'login.role.merchant': 'Dukaandaar',
  'login.role.admin': 'Admin',
  'login.sendOtp': 'OTP bhejo',
  'login.otp': 'OTP daalo',
  'login.verify': 'Verify karo',
  'login.name': 'Aapka naam',

  'scan.title': 'Dukaan ka QR scan karo',
  'scan.hint': 'Udhaar lene ke liye dukaan ke counter QR ko scan karo',
  'scan.manual': 'Code manually daalo',
  'scan.invalid': 'Ye QR valid nahi hai ya expire ho gaya',

  'shop.takeUdhaar': 'Udhaar lo',
  'shop.yourBalance': 'Is dukaan par aapka baaki',
  'shop.creditLimit': 'Credit limit',
  'shop.available': 'Available',

  'udhaar.request.title': 'Udhaar lo',
  'udhaar.request.amount': 'Kitna?',
  'udhaar.request.due': 'Kab tak chukaoge',
  'udhaar.request.submit': 'Udhaar request karo',
  'udhaar.request.sent': 'Request bhej di — dukaan ke accept karne ka wait karo',

  'udhaar.detail.timeline': 'Evidence timeline',
  'udhaar.detail.ledger': 'Ledger',
  'udhaar.detail.pay': 'Abhi pay karo',
  'udhaar.detail.promise': 'Pay karne ka vaada',

  'pay.title': 'Udhaar chukao',
  'pay.amount': 'Pay amount',
  'pay.full': 'Poora pay karo',
  'pay.payNow': 'Securely pay karo',
  'pay.processing': 'Payment verify ho raha hai…',
  'pay.success': 'Payment successful',
  'pay.cleared': 'Udhaar poora clear! ₹0 baaki',

  'merchant.dashboard': 'Shop dashboard',
  'merchant.outstanding': 'Total baaki',
  'merchant.pendingRequests': 'Pending requests',
  'merchant.accept': 'Accept karo',
  'merchant.reject': 'Reject karo',
  'merchant.recordCash': 'Cash payment record karo',
  'merchant.noRequests': 'Koi pending request nahi',

  'qr.title': 'Aapka counter QR',
  'qr.hint': 'Customers ise scan karke udhaar le sakte hain',
  'qr.download': 'Download',

  'empty.khatas': 'Abhi koi khata nahi. Pehla udhaar lene ke liye dukaan ka QR scan karo.',
  'profile.language': 'Bhasha',
  'profile.logout': 'Log out',
};

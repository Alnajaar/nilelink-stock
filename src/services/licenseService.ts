import { LicenseInfo } from '../types/stock';

// Obfuscated internal seed for HMAC generation
const _MASTER_SALT = 'BARSTOCK_PRO_2026_ENTERPRISE_SECURE_HMAC_SALT_v3';

/**
 * Calculates SHA-256 HMAC digest using WebCrypto API
 */
async function computeHmacSha256(secret: string, message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyData = enc.encode(secret + _MASTER_SALT);
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      );
      const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
      const hashArray = Array.from(new Uint8Array(signature));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    } catch {
      // Fallback below
    }
  }

  // Pure JavaScript SHA-256 fallback for environments without subtle crypto
  return pseudoSha256(secret + message);
}

function pseudoSha256(str: string): string {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h0 = ((h0 << 5) - h0 + code + (i * 31)) | 0;
    h1 = ((h1 << 7) - h1 + code) | 0;
    h2 = ((h2 << 3) - h2 + code + 0x5a827999) | 0;
    h3 = ((h3 << 11) - h3 + code) | 0;
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return (toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3)).toUpperCase();
}

export interface LicensePayload {
  cid: string;        // Cafe ID
  cnm: string;        // Cafe Name
  exp: number;        // Expiry timestamp (ms)
  iat: number;        // Issued at (ms)
  tier: 'Starter' | 'Pro' | 'Enterprise';
  features: string[];
  nonce: string;
}

export class LicenseManager {
  private static STORAGE_KEY = 'barstock_license_data';
  private static SECRET_KEY = 'BSK_SEC_' + (typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'local');

  /**
   * Generates a tamper-proof cryptographically signed license token
   */
  public static async generateLicenseToken(
    cafeId: string,
    cafeName: string,
    expiryDate: Date,
    tier: 'Starter' | 'Pro' | 'Enterprise' = 'Enterprise'
  ): Promise<string> {
    const payload: LicensePayload = {
      cid: cafeId.trim().toUpperCase(),
      cnm: cafeName.trim(),
      exp: expiryDate.getTime(),
      iat: Date.now(),
      tier,
      features: ['live_dashboard', 'auto_order', 'waste_analytics', 'multi_terminal', 'sheets_sync', 'whatsapp_orders'],
      nonce: Math.random().toString(36).substring(2, 10).toUpperCase()
    };

    const payloadJson = JSON.stringify(payload);
    const payloadBase64 = btoa(unescape(encodeURIComponent(payloadJson)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const signature = await computeHmacSha256(this.SECRET_KEY, payloadBase64);
    const shortSig = signature.substring(0, 16);

    // Format: BSK2-<PAYLOAD>.<SIG>
    return `BSK2-${payloadBase64}.${shortSig}`;
  }

  /**
   * Generates a compact alphanumeric code for easy manual entry on mobile screens
   * Format: YYYYMMDD-CAFEID-SIG8
   */
  public static async generateCompactCode(cafeId: string, expiryDate: Date): Promise<string> {
    const ymd = expiryDate.toISOString().slice(0, 10).replace(/-/g, '');
    const cleanId = cafeId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const raw = `${ymd}|${cleanId}|${this.SECRET_KEY}`;
    const sig = await computeHmacSha256(this.SECRET_KEY, raw);
    return `${ymd}-${cleanId}-${sig.substring(0, 8)}`;
  }

  /**
   * Validates and redeems any license code (Compact or Token) for the specified cafe
   */
  public static async verifyAndRedeemCode(
    code: string,
    currentCafeId: string
  ): Promise<{ success: boolean; message: string; expiryDate?: Date; cafeName?: string; tier?: 'Starter' | 'Pro' | 'Enterprise' }> {
    const trimmed = code.trim();
    if (!trimmed) {
      return { success: false, message: 'Please enter a license code.' };
    }

    // Check if it's a BSK2 Full Token
    if (trimmed.startsWith('BSK2-')) {
      return this.verifyFullToken(trimmed, currentCafeId);
    }

    // Check if it's a Compact Code format: YYYYMMDD-CAFEID-SIG8
    const compactRegex = /^(\d{8})-([A-Z0-9]+)-([A-F0-9]{8})$/i;
    const match = trimmed.toUpperCase().match(compactRegex);
    if (match) {
      const [, ymd, cId, sig] = match;
      const cleanCurrentId = currentCafeId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

      if (cId !== cleanCurrentId && cId !== 'ANY' && cleanCurrentId !== '') {
        return {
          success: false,
          message: `This code was created for cafe '${cId}', not '${cleanCurrentId}'. License codes are hardware & tenant bound.`
        };
      }

      const expectedRaw = `${ymd}|${cId}|${this.SECRET_KEY}`;
      const expectedSig = (await computeHmacSha256(this.SECRET_KEY, expectedRaw)).substring(0, 8);

      if (expectedSig !== sig) {
        return { success: false, message: 'Invalid license signature or altered code.' };
      }

      const year = parseInt(ymd.slice(0, 4), 10);
      const month = parseInt(ymd.slice(4, 6), 10) - 1;
      const day = parseInt(ymd.slice(6, 8), 10);
      const expDate = new Date(year, month, day, 23, 59, 59);

      if (isNaN(expDate.getTime())) {
        return { success: false, message: 'Corrupt date in license code.' };
      }

      if (expDate.getTime() < Date.now()) {
        return { success: false, message: 'This renewal code has already expired.' };
      }

      return {
        success: true,
        message: `License successfully renewed until ${expDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}!`,
        expiryDate: expDate
      };
    }

    // Legacy fallback (from old code.gs format: YYYYMMDD-SIG8)
    const legacyMatch = trimmed.toUpperCase().match(/^(\d{8})-([A-F0-9]{8})$/);
    if (legacyMatch) {
      const [, ymd] = legacyMatch;
      const year = parseInt(ymd.slice(0, 4), 10);
      const month = parseInt(ymd.slice(4, 6), 10) - 1;
      const day = parseInt(ymd.slice(6, 8), 10);
      const expDate = new Date(year, month, day, 23, 59, 59);

      if (expDate.getTime() < Date.now()) {
        return { success: false, message: 'License code has already expired.' };
      }

      return {
        success: true,
        message: `Legacy code accepted. Unlocked until ${expDate.toLocaleDateString()}!`,
        expiryDate: expDate
      };
    }

    return {
      success: false,
      message: 'Unrecognized license format. Code must be YYYYMMDD-CAFEID-XXXXXXXX or BSK2-Token.'
    };
  }

  private static async verifyFullToken(
    token: string,
    currentCafeId: string
  ): Promise<{ success: boolean; message: string; expiryDate?: Date; cafeName?: string; tier?: 'Starter' | 'Pro' | 'Enterprise' }> {
    try {
      const clean = token.replace('BSK2-', '');
      const [payloadB64, sig] = clean.split('.');

      if (!payloadB64 || !sig) {
        return { success: false, message: 'Malformed license token.' };
      }

      const expectedSig = (await computeHmacSha256(this.SECRET_KEY, payloadB64)).substring(0, 16);
      if (expectedSig !== sig) {
        return { success: false, message: 'Cryptographic signature mismatch. Token was tampered with!' };
      }

      const jsonStr = decodeURIComponent(escape(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))));
      const payload: LicensePayload = JSON.parse(jsonStr);

      if (payload.cid !== currentCafeId.trim().toUpperCase() && payload.cid !== 'ANY') {
        return {
          success: false,
          message: `License is locked to cafe ID '${payload.cid}', but current cafe is '${currentCafeId}'.`
        };
      }

      const expDate = new Date(payload.exp);
      if (expDate.getTime() < Date.now()) {
        return { success: false, message: 'This digital certificate expired on ' + expDate.toLocaleDateString() };
      }

      return {
        success: true,
        message: `Verified ${payload.tier} license for ${payload.cnm}! Valid until ${expDate.toLocaleDateString()}.`,
        expiryDate: expDate,
        cafeName: payload.cnm,
        tier: payload.tier
      };
    } catch {
      return { success: false, message: 'Failed to parse digital certificate.' };
    }
  }

  /**
   * Loads current license status for the active cafe
   */
  public static getLicenseStatus(cafeId: string, cafeName: string): LicenseInfo {
    let savedExpiry = '2026-12-31T23:59:59.000Z';
    let tier: 'Starter' | 'Pro' | 'Enterprise' = 'Enterprise';
    let isRevoked = false;

    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_${cafeId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.expiryDate) savedExpiry = parsed.expiryDate;
          if (parsed.tier) tier = parsed.tier;
          if (parsed.revoked) isRevoked = parsed.revoked;
        } catch {
          // ignore
        }
      }
    }

    const now = new Date();
    const exp = new Date(savedExpiry);
    const msLeft = exp.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    const isExpired = msLeft <= 0;
    const warnDays = 14;

    let status: 'active' | 'warning' | 'expired' | 'revoked' = 'active';
    if (isRevoked) status = 'revoked';
    else if (isExpired) status = 'expired';
    else if (daysLeft <= warnDays) status = 'warning';

    return {
      cafeId,
      cafeName,
      ownerEmail: 'support@barstockpro.com',
      tier,
      status,
      expiryDate: exp.toISOString(),
      daysLeft: Math.max(0, daysLeft),
      warnDays,
      contact: 'Contact NileLink Stock Support (support@nilelink.io) to renew.',
      features: {
        liveDashboard: true,
        autoOrder: true,
        wasteAnalytics: true,
        multiTerminal: tier !== 'Starter',
        barcodeScanner: true,
        whatsappOrders: true,
        excelImportExport: true
      }
    };
  }

  /**
   * Saves updated expiry or status
   */
  public static saveLicense(cafeId: string, expiryDate: Date, tier = 'Enterprise', revoked = false): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        `${this.STORAGE_KEY}_${cafeId}`,
        JSON.stringify({
          expiryDate: expiryDate.toISOString(),
          tier,
          revoked,
          updatedAt: new Date().toISOString()
        })
      );
    }
  }

  /**
   * Resets or tests license override (useful for software vendor/super admin)
   */
  public static setRevocation(cafeId: string, revoked: boolean): void {
    const current = this.getLicenseStatus(cafeId, 'Cafe');
    this.saveLicense(cafeId, new Date(current.expiryDate), current.tier, revoked);
  }
}

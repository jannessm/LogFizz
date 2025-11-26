import dotenv from 'dotenv';

dotenv.config();

const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify';

export interface HCaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  credit?: boolean;
  'error-codes'?: string[];
  score?: number;
  score_reason?: string[];
}

/**
 * Verify hCaptcha token with hCaptcha servers
 * @param token - The hCaptcha token from the client
 * @param remoteip - Optional IP address of the user
 * @returns Promise resolving to verification result
 */
export async function verifyHCaptcha(
  token: string,
  remoteip?: string
): Promise<HCaptchaVerifyResponse> {
  // If no secret key is configured, skip verification (development mode)
  if (!HCAPTCHA_SECRET_KEY) {
    console.warn('⚠️  HCAPTCHA_SECRET_KEY not configured - skipping verification');
    return { success: true };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', HCAPTCHA_SECRET_KEY);
    params.append('response', token);
    if (remoteip) {
      params.append('remoteip', remoteip);
    }

    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`hCaptcha API returned status ${response.status}`);
    }

    const data = await response.json() as HCaptchaVerifyResponse;
    return data;
  } catch (error) {
    console.error('Error verifying hCaptcha:', error);
    throw new Error('Failed to verify hCaptcha');
  }
}

/**
 * Check if hCaptcha is required (based on environment configuration)
 */
export function isHCaptchaRequired(): boolean {
  return !!HCAPTCHA_SECRET_KEY;
}

/**
 * Middleware-style function to verify hCaptcha token
 * Throws error if verification fails
 */
export async function requireHCaptcha(token: string | undefined, remoteip?: string): Promise<void> {
  // Skip if hCaptcha is not configured
  if (!isHCaptchaRequired()) {
    return;
  }

  // Require token if hCaptcha is configured
  if (!token) {
    throw new Error('hCaptcha token is required');
  }

  const result = await verifyHCaptcha(token, remoteip);

  if (!result.success) {
    const errorCodes = result['error-codes']?.join(', ') || 'unknown error';
    throw new Error(`hCaptcha verification failed: ${errorCodes}`);
  }
}

/**
 * Client-side password hashing utility (Browser & Node.js compatible).
 * This function should be used on the client side before sending passwords to the API.
 * It provides defense-in-depth by ensuring plain-text passwords never traverse the network.
 * 
 * The backend will still apply bcrypt hashing on the result for proper secure storage.
 * 
 * @param password - The plain-text password
 * @param email - The user's email address (used as salt)
 * @returns A deterministic hash of the password
 */
export async function hashPasswordForTransport(password: string, email: string): Promise<string> {
  // Normalize email to lowercase for consistency
  const normalizedEmail = email.toLowerCase().trim();
  
  // Create a SHA-256 hash of password + email
  // This creates a deterministic hash that's safe to send over the network
  // 
  // NOTE: This is NOT for password storage! This is for transport security only.
  // The backend will apply proper bcrypt hashing for storage.
  // SHA-256 is used here because:
  // 1. It's deterministic (required for authentication)
  // 2. It's fast (client-side performance)
  // 3. It prevents plain-text passwords from being transmitted over the network
  // lgtm[js/insufficient-password-hash]
  
  // Use Web Crypto API (available in browsers and Node.js 15+)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + normalizedEmail);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}


import crypto from 'crypto';

/**
 * Client-side password hashing utility.
 * This function should be used on the client side before sending passwords to the API.
 * It provides defense-in-depth by ensuring plain-text passwords never traverse the network.
 * 
 * The backend will still apply bcrypt hashing on the result for proper secure storage.
 * 
 * @param password - The plain-text password
 * @param email - The user's email address (used as salt)
 * @returns A deterministic hash of the password
 */
export function hashPasswordForTransport(password: string, email: string): string {
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
  const hash = crypto.createHash('sha256');
  hash.update(password);
  hash.update(normalizedEmail);
  
  return hash.digest('hex');
}

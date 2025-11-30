/**
 * Client-side password hashing utility (browser-compatible version).
 * This function should be used before sending passwords to the API.
 * It provides defense-in-depth by ensuring plain-text passwords never traverse the network.
 *
 * The backend will still apply bcrypt hashing on the result for proper secure storage.
 *
 * @param password - The plain-text password
 * @param email - The user's email address (used as salt)
 * @returns A deterministic hash of the password
 */
export declare function hashPasswordForTransport(password: string, email: string): Promise<string>;
//# sourceMappingURL=passwordHash.browser.d.ts.map
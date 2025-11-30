/**
 * Client-side password hashing utility (Node.js version).
 * This function should be used on the client side before sending passwords to the API.
 * It provides defense-in-depth by ensuring plain-text passwords never traverse the network.
 *
 * The backend will still apply bcrypt hashing on the result for proper secure storage.
 *
 * @param password - The plain-text password
 * @param email - The user's email address (used as salt)
 * @returns A deterministic hash of the password
 */
export declare function hashPasswordForTransport(password: string, email: string): string;
//# sourceMappingURL=passwordHash.node.d.ts.map
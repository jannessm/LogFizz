// Global setup file for vitest - no longer needed for PostgreSQL
// Tests now use in-memory SQLite database

export default async function setup() {
  console.log('✓ Test environment ready (using in-memory database)');
}

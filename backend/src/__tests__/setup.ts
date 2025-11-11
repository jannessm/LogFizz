import { DataSource } from 'typeorm';

export default async function setupTestDatabase() {
  // Connect to postgres default database to create test database
  const rootConnection = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'clock_user',
    password: process.env.DB_PASSWORD || 'clock_password',
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await rootConnection.initialize();
    
    // Check if test database exists
    const result = await rootConnection.query(
      `SELECT 1 FROM pg_database WHERE datname = 'clock_test_db'`
    );
    
    if (result.length === 0) {
      // Create test database if it doesn't exist
      await rootConnection.query('CREATE DATABASE clock_test_db');
      console.log('✓ Test database created');
    } else {
      console.log('✓ Test database already exists');
    }
    
    await rootConnection.destroy();
  } catch (error) {
    console.error('Error setting up test database:', error);
    if (rootConnection.isInitialized) {
      await rootConnection.destroy();
    }
    throw error;
  }
}

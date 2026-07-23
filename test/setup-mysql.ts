// Set MySQL test environment variables before any modules load
process.env.DB_TYPE = 'mysql';
process.env.DB_DATABASE = 'wraplab_test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-key-e2e';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-e2e';
process.env.NODE_ENV = 'test';
process.env.THROTTLE_LIMIT = '1000'; // disable rate limiting for tests

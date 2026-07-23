import { DataSource } from 'typeorm';

/**
 * Creates minimal SQLite-compatible tables for E2E testing.
 * Column names must match TypeORM entity @Column definitions exactly.
 */
export async function createTestSchema(dataSource: DataSource): Promise<void> {
  const queries = [
    // ---- Store & Staff ----
    `CREATE TABLE IF NOT EXISTS store (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(200) NOT NULL,
      address VARCHAR(500),
      phone VARCHAR(20),
      region VARCHAR(100),
      logo VARCHAR(500),
      status VARCHAR(20) DEFAULT 'active',
      location TEXT,
      business_hours TEXT,
      services_offered TEXT,
      capacity_config TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      current_store_id INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'staff',
      avatar VARCHAR(500),
      status VARCHAR(20) DEFAULT 'active',
      token_version INTEGER DEFAULT 0,
      wechat_openid VARCHAR(100),
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS staff_store (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      role_in_store VARCHAR(20) DEFAULT 'staff',
      assigned_at DATETIME NOT NULL DEFAULT (datetime('now')),
      created_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS store_location (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      lat REAL,
      lng REAL,
      address VARCHAR(500),
      province VARCHAR(100),
      city VARCHAR(100),
      district VARCHAR(100),
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )`,

    // ---- Vehicle hierarchy ----
    `CREATE TABLE IF NOT EXISTS car_brand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      logo VARCHAR(500),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS car_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      year_start INTEGER,
      year_end INTEGER,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS car_model (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      year INTEGER NOT NULL,
      body_type VARCHAR(50),
      model_3d_url VARCHAR(500),
      usdz_url VARCHAR(500),
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS car_part (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL,
      part_code VARCHAR(20) NOT NULL,
      area_m2 DECIMAL(6,4) DEFAULT 0,
      name VARCHAR(100) NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )`,

    // ---- Color hierarchy ----
    `CREATE TABLE IF NOT EXISTS color_brand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(500),
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS color_swatch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      hex VARCHAR(7) NOT NULL,
      rgb_r INTEGER NOT NULL DEFAULT 0,
      rgb_g INTEGER NOT NULL DEFAULT 0,
      rgb_b INTEGER NOT NULL DEFAULT 0,
      price_per_m2 DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS material (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(500),
      price_multiplier DECIMAL(4,2) DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,

    // ---- Configuration & Quote ----
    `CREATE TABLE IF NOT EXISTS configuration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      model_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      name VARCHAR(200),
      note TEXT,
      customer_name VARCHAR(100),
      customer_phone VARCHAR(20),
      status VARCHAR(20) DEFAULT 'draft',
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS part_color (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      configuration_id INTEGER NOT NULL,
      part_code VARCHAR(20) NOT NULL,
      color_swatch_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS quote (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      configuration_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      total_price DECIMAL(12,2) NOT NULL,
      campaign_id INTEGER,
      discount_amount DECIMAL(12,2) DEFAULT 0,
      final_price DECIMAL(12,2),
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      deleted_at DATETIME
    )`,

    // ---- Misc ----
    `CREATE TABLE IF NOT EXISTS sms_code (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone VARCHAR(20) NOT NULL,
      code VARCHAR(10) NOT NULL,
      type VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'unused',
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    )`,
  ];

  for (const query of queries) {
    await dataSource.query(query);
  }
}

export async function dropTestSchema(dataSource: DataSource): Promise<void> {
  const tables = [
    'quote',
    'part_color',
    'configuration',
    'car_part',
    'car_model',
    'car_series',
    'car_brand',
    'material',
    'color_swatch',
    'color_brand',
    'staff_store',
    'sms_code',
    'store_location',
    'staff',
    'store',
  ];
  for (const t of tables) {
    await dataSource.query(`DROP TABLE IF EXISTS ${t}`);
  }
}

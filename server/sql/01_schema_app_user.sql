-- =============================================================================
-- Run as `app_user_prod` (or any user that already has rights on this schema).
-- Prerequisite: database exists and user has privileges (see 00_provision...).
-- DB_NAME in server/.env must match: samsarukhanyan_portfolio
-- =============================================================================

USE samsarukhanyan_portfolio;

CREATE TABLE IF NOT EXISTS site_copy (
  str_key VARCHAR(191) NOT NULL,
  en TEXT NOT NULL,
  ru TEXT NOT NULL,
  hy TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (str_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: seed from repo — `cd server && npm run seed` (uses server/.env)

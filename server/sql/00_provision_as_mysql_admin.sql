-- =============================================================================
-- Run this file as a MySQL ADMIN (e.g. linux: `sudo mysql` → root via socket).
-- Application users like `app_user_prod` usually CANNOT run CREATE DATABASE.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS samsarukhanyan_portfolio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Grant your deploy user access ONLY to this schema.
-- If the user was created for another app (e.g. social_network), you only extend grants here.
-- Match host exactly: 'localhost' vs '%' must match how the user was created (`SELECT user,host FROM mysql.user`).
GRANT ALL PRIVILEGES ON samsarukhanyan_portfolio.* TO 'app_user_prod'@'localhost';

FLUSH PRIVILEGES;

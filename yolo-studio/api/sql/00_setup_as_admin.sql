-- Run once as a MySQL admin:  sudo mysql < api/sql/00_setup_as_admin.sql
-- (scripts/setup-db.sh does this and puts the generated password into api/.env)
CREATE DATABASE IF NOT EXISTS yolo_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'yolo_studio'@'localhost' IDENTIFIED BY '__PASSWORD__';
ALTER USER 'yolo_studio'@'localhost' IDENTIFIED BY '__PASSWORD__';
GRANT ALL PRIVILEGES ON yolo_studio.* TO 'yolo_studio'@'localhost';
FLUSH PRIVILEGES;

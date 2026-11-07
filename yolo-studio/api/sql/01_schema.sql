-- Applied automatically by the API on start (idempotent).
CREATE TABLE IF NOT EXISTS datasets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  task ENUM('detect','segment','classify') NOT NULL DEFAULT 'detect',
  classes JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dataset_id INT NOT NULL,
  filename VARCHAR(80) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  split ENUM('train','val') NOT NULL DEFAULT 'train',
  source VARCHAR(40) NOT NULL DEFAULT 'upload',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- shape: {"type":"box","cx","cy","w","h"} or {"type":"poly","points":[[x,y],...]}, normalised 0..1;
-- NULL for a classification label.
CREATE TABLE IF NOT EXISTS annotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_id INT NOT NULL,
  class_idx INT NOT NULL,
  shape JSON NULL,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS training_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dataset_id INT NULL,
  job_id VARCHAR(80) NOT NULL,
  base_model VARCHAR(200) NOT NULL,
  epochs INT NOT NULL,
  imgsz INT NOT NULL,
  batch INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  metrics JSON NULL,
  best_model VARCHAR(300) NULL,
  error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE SET NULL
);

-- One row per live camera/video session: what ran and what it saw.
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  engine VARCHAR(20) NOT NULL,
  model VARCHAR(200) NOT NULL,
  task VARCHAR(20) NULL,
  source VARCHAR(20) NOT NULL,
  frames INT NOT NULL DEFAULT 0,
  avg_ms DOUBLE NULL,
  fps DOUBLE NULL,
  counts JSON NULL,
  unique_tracks JSON NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

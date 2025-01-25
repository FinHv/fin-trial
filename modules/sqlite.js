const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const config = require('../config.json');

const connect = async () => {
  const db = await open({
    filename: config.paths.databaseFile,
    driver: sqlite3.Database,
  });

  // Initialize database schema
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      username TEXT PRIMARY KEY,
      group_name TEXT NOT NULL,
      ratio INTEGER DEFAULT 0,
      flags TEXT DEFAULT '',
      bytes_uploaded INTEGER DEFAULT 0,
      wkup_bytes INTEGER DEFAULT 0, -- Total bytes uploaded for the week
      dayup_bytes INTEGER DEFAULT 0, -- Total bytes uploaded for the day
      added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      stats_reset_date DATETIME DEFAULT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      status INTEGER DEFAULT 1, -- 1 = TRIAL, 2 = QUOTA
      passed_trial INTEGER DEFAULT 0, -- 0 = NOT PASSED TRIAL, 1 = PASSED TRIAL
      days_remaining INTEGER DEFAULT NULL, -- Days remaining for trial or quota
      day_files INTEGER DEFAULT 0, -- Files uploaded in a day
      wkup_files INTEGER DEFAULT 0 -- Total files uploaded
    );
  `);

  console.log(`[INFO] Connected to SQLite database at ${config.paths.databaseFile} and ensured schema exists.`);
  return db;
};

module.exports = { connect };

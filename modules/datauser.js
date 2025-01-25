const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const { formatSize, getDaysUntilEndOfWeek, getDaysRemaining } = require('./utils');


// Define status constants
const STATUS_DISABLED = 0;
const STATUS_TRIAL = 1;
const STATUS_QUOTA = 2;
const STATUS_BOTH = 3;


// Parse a single user file
const parseUserFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const userData = {};

  lines.forEach((line) => {
    const [key, ...values] = line.split(/\s+/);
    switch (key) {
      case 'GROUP':
        userData.group = values[0];
        break;
      case 'FLAGS':
        userData.flags = values[0];
        userData.skip = values[0].includes('6'); // Mark user for skipping if FLAGS contains 6
        console.log(`[DEBUG] User FLAGS: ${values[0]} | Skip: ${userData.skip}`);
        break;
      case 'RATIO':
        userData.ratio = parseInt(values[0], 10);
        break;
      case 'WKUP':
        userData.wkup = {
          files: parseInt(values[0], 10),
          bytes: parseInt(values[1], 10),
        };
        break;
      case 'ADDED':
        userData.added = new Date(parseInt(values[0], 10) * 1000).toISOString(); // Convert to ISO format
        break;
      case 'DAYUP':
        userData.dayup = {
          files: parseInt(values[0], 10),
          bytes: parseInt(values[1], 10),
        };
        break;
    }
  });

  console.log(`[PARSE] Parsed user data:`, userData);
  return userData;
};


// Initialize database with all users
const initializeDatabase = async (db) => {
  const { usersDir } = config.paths;
  const userFiles = fs.readdirSync(usersDir);

  console.log(`[INFO] Found ${userFiles.length} user files in ${usersDir}`);

  const userSkip = config.settings?.userSkip || [];
  const excludedGroups = config.settings?.excludedGroups || [];

for (const file of userFiles) {

  if (file.endsWith('.lock')) {
    console.log(`[SKIP] Skipping lock file: ${file}`);
    continue;
  }

  const filePath = path.join(usersDir, file);
  const username = file;

  if (userSkip.includes(username)) {
    console.log(`[SKIP] Skipping user: ${username}`);
    continue;
  }

  const userData = parseUserFile(filePath);

if (userData.skip) {
  console.log(`[SKIP] Skipping user ${username} due to FLAGS containing 6`);

  // Remove user from the database if they exist
  try {
    await db.run(`DELETE FROM user_stats WHERE username = ?`, [username]);
    console.log(`[DB] Removed user ${username} from database due to FLAGS containing 6`);
  } catch (error) {
    console.error(`[ERROR] Failed to remove user ${username} from database`, error.message);
  }

  continue; // Skip further processing
}

  if (excludedGroups.includes(userData.group)) {
    console.log(`[SKIP] Skipping user ${username} due to excluded group: ${userData.group}`);
    continue;
  }


  // Rest of the logic for database initialization
  const groupName = userData.group || 'Unknown';
  const bytesUploaded = userData.wkup?.bytes || 0;
  const wkupBytes = userData.wkup?.bytes || 0;
  const dayupBytes = userData.dayup?.bytes || 0;
  const dayFiles = userData.dayup?.files || 0;
  const wkupFiles = userData.wkup?.files || 0;

  const defaultStatus = STATUS_QUOTA; // Default all users to QUOTA
  const daysRemaining = getDaysUntilEndOfWeek(); // Start all users in quota with a fresh week

  try {
    await db.run(` 
      INSERT INTO user_stats (username, group_name, ratio, flags, bytes_uploaded, wkup_bytes, dayup_bytes, added_date, stats_reset_date, last_updated, status, passed_trial, days_remaining, day_files, wkup_files)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        group_name = excluded.group_name,
        ratio = excluded.ratio,
        flags = excluded.flags,
        bytes_uploaded = excluded.bytes_uploaded,
        wkup_bytes = excluded.wkup_bytes,
        dayup_bytes = excluded.dayup_bytes,
        added_date = excluded.added_date,
        stats_reset_date = excluded.stats_reset_date,
        last_updated = CURRENT_TIMESTAMP,
        status = excluded.status,
        passed_trial = excluded.passed_trial,
        days_remaining = excluded.days_remaining,
        day_files = excluded.day_files,
        wkup_files = excluded.wkup_files;
    `, [
      username,
      groupName,
      userData.ratio || 0,
      userData.flags || '',
      bytesUploaded,
      wkupBytes,
      dayupBytes,
      userData.added,
      defaultStatus,
      0, // passed_trial = 0 by default
      daysRemaining,
      dayFiles,
      wkupFiles,
    ]);

    console.log(`[DB] Initialized stats for user: ${username}`);
  } catch (error) {
    console.error(`[ERROR] Failed to initialize stats for user: ${username}`, error.message);
  }
}

console.log(`[INFO] Database initialization complete.`);
};



// Update user stats in the database periodically
const updateUserStats = async (db) => {
  console.log(`[INFO] Updating user stats...`);
  await initializeDatabase(db); // Reuse the same logic to ensure updates are accurate
};

module.exports = {
  initializeDatabase,
  updateUserStats,
};

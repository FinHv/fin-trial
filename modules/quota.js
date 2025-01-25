const fileOps = require('./fileoperations'); // Import file operations utility
const config = require('../config.json');
const { formatSize, getDaysUntilEndOfWeek, getDaysRemaining, getTimeRemaining } = require('./utils');

// Define status constants
const STATUS_DISABLED = 0;
const STATUS_TRIAL = 1;
const STATUS_QUOTA = 2;
const STATUS_BOTH = 3;

/**
 * Fetches the top uploaders from the database.
 * @param {object} db - The SQLite database connection.
 * @param {number} limit - Number of top uploaders to fetch.
 * @param {number} status - Filter by status (1 = trial, 2 = quota).
 * @returns {Promise<Array>} - List of top uploaders.
 */
const getTopUploaders = async (db, limit = 20, status = 2) => {
  return await db.all(`
    SELECT username, group_name, bytes_uploaded, added_date, days_remaining
    FROM user_stats
    WHERE status = ?
    ORDER BY bytes_uploaded DESC
    LIMIT ?;
  `, [status, limit]);
};

/**
 * Updates the user's status in the database.
 * @param {object} db - The SQLite database connection.
 * @param {string} username - The username to update.
 * @param {number} status - The new status value (1 = trial, 2 = quota).
 * @param {boolean} passed - Whether the user passed the trial/quota.
 * @param {number} daysRemaining - Days remaining for the user.
 */
const updateUserStatus = async (db, username, status, passed, daysRemaining) => {
  await db.run(`
    UPDATE user_stats
    SET status = ?, passed_trial = ?, days_remaining = ?, last_updated = CURRENT_TIMESTAMP
    WHERE username = ?;
  `, [status, passed ? 1 : 0, daysRemaining, username]);
};

/**
 * Processes trial logic for users.
 * @param {object} db - The SQLite database connection.
 */
const processTrials = async (db) => {
  if (!config.trialConfig.enabled) return;

  console.log(`[INFO] Processing trial users...`);

  const trialUsers = await db.all(`
    SELECT username, bytes_uploaded, added_date, days_remaining
    FROM user_stats
    WHERE status = 1;
  `);

  const minQuotaKB = parseFloat(config.trialConfig.quotaGB) * 1024 ** 2;

  for (const user of trialUsers) {
    const daysRemaining = Math.max(getDaysRemaining(user.added_date, config.trialConfig.daysDefault), 0);

    if (daysRemaining <= 0) {
      const passed = user.bytes_uploaded >= minQuotaKB;

      if (passed) {
        await updateUserStatus(db, user.username, STATUS_QUOTA, true, getDaysUntilEndOfWeek());
        console.log(`[TRIAL] User ${user.username} passed trial and promoted to quota.`);
      } else {
        const userFilePath = `${config.paths.usersDir}/${user.username}`;

        try {
          fileOps.appendFlagsToUserFile(userFilePath, config.trialConfig.failSetFlagsTrial, '/tmp');
          console.log(`[TRIAL] Added delete flag (${config.trialConfig.failSetFlagsTrial}) to ${user.username}.`);
        } catch (error) {
          console.error(`[ERROR] Failed to update FLAGS for ${user.username} during trial failure: ${error.message}`);
        }

        try {
          const stats = `Uploaded: ${formatSize(user.bytes_uploaded)}`;
          fileOps.createGoodbyeFile(config.paths.byeFiles, user.username, "Trial failure", stats, false);
          console.log(`[BYE] Created goodbye file for ${user.username} due to trial failure.`);
        } catch (error) {
          console.error(`[ERROR] Failed to create goodbye file for ${user.username}: ${error.message}`);
        }

        await updateUserStatus(db, user.username, STATUS_DISABLED, false, null);
        console.log(`[DISABLED] User ${user.username} has been disabled due to trial failure.`);
      }
    } else {
      await db.run(`
        UPDATE user_stats
        SET days_remaining = ?
        WHERE username = ?;
      `, [daysRemaining, user.username]);

      console.log(`[TRIAL] User ${user.username} trial updated: ${daysRemaining} days remaining.`);
    }
  }
};

/**
 * Processes quota logic for users.
 * @param {object} db - The SQLite database connection.
 */
const processQuotas = async (db) => {
  if (!config.quotaConfig.enabled) return;

  console.log(`[INFO] Processing quota users...`);

  const quotaUsers = await db.all(`
    SELECT username, bytes_uploaded, stats_reset_date, days_remaining
    FROM user_stats
    WHERE status = 2;
  `);

  const minQuotaKB = parseFloat(config.quotaConfig.quotaGB) * 1024 ** 2;

  for (const user of quotaUsers) {
    let daysRemaining = getDaysUntilEndOfWeek();

    if (user.days_remaining !== daysRemaining) {
      await db.run(`
        UPDATE user_stats
        SET days_remaining = ?
        WHERE username = ?;
      `, [daysRemaining, user.username]);

      console.log(`[QUOTA] Fixed days_remaining for user ${user.username} to ${daysRemaining}.`);
    }

    if (daysRemaining <= 0) {
      const passed = user.bytes_uploaded >= minQuotaKB;

      if (!passed) {
        const userFilePath = `${config.paths.usersDir}/${user.username}`;

        if (config.quotaConfig.failBackToTrial) {
          // Move the user back to trial
          await db.run(`
            UPDATE user_stats
            SET status = ?, days_remaining = ?
            WHERE username = ?;
          `, [STATUS_TRIAL, config.trialConfig.daysDefault, user.username]);

          console.log(`[QUOTA] User ${user.username} failed quota and moved back to trial.`);
        } else {
          // Flag the user for deletion
          try {
            fileOps.appendFlagsToUserFile(userFilePath, config.quotaConfig.failSetFlagsQuota, '/tmp');
            console.log(`[FLAGS] Added delete flag (${config.quotaConfig.failSetFlagsQuota}) to ${user.username}.`);
          } catch (error) {
            console.error(`[ERROR] Failed to update FLAGS for ${user.username}: ${error.message}`);
          }

          try {
            const stats = `Uploaded: ${formatSize(user.bytes_uploaded)}`;
            fileOps.createGoodbyeFile(config.paths.byeFiles, user.username, "Quota failure", stats, false);
            console.log(`[BYE] Created goodbye file for ${user.username} due to quota failure.`);
          } catch (error) {
            console.error(`[ERROR] Failed to create goodbye file for ${user.username}: ${error.message}`);
          }

          await updateUserStatus(db, user.username, STATUS_DISABLED, false, null);
          console.log(`[DISABLED] User ${user.username} has been disabled due to quota failure.`);
        }
      } else {
        await db.run(`
          UPDATE user_stats
          SET days_remaining = ?
          WHERE username = ?;
        `, [getDaysUntilEndOfWeek(), user.username]);

        console.log(`[QUOTA] User ${user.username} passed quota and reset for the next week.`);
      }
    } else {
      console.log(`[QUOTA] User ${user.username} has ${getTimeRemaining()} remaining for this week.`);
    }
  }
};


/**
 * Generates a report for trials and quotas.
 * @param {Array} users - List of users to generate the report for.
 * @param {string} type - "trial" or "quota".
 * @returns {Array<string>} - Formatted report messages.
 */
const generateReport = (users, type) => {
  const configKey = type === 'trial' ? 'trialConfig' : 'quotaConfig';
  const minQuotaGB = parseFloat(config[configKey].quotaGB);
  const minQuotaKB = minQuotaGB * 1024 ** 2;

  if (type === 'quota') {
    const header = `\x02WEEKLY QUOTA:\x02 [ ${users.length} Users - ${getTimeRemaining()} Remaining - (Min \x02${minQuotaGB}GB\x02) ]`;

    const body = users.map((u, i) => {
      const size = formatSize(u.bytes_uploaded);
      const isPassing = u.bytes_uploaded >= minQuotaKB;
      const status = isPassing ? '\x0303\x02PASSING\x02\x0F' : '\x0304\x02FAILING\x02\x0F';
      const color = isPassing ? '\x0303' : '\x0304';

      return `[ ${color}${String(i + 1).padStart(2, '0')}\x0F ] ${u.username}/${u.group_name} ( \x02${size} Up\x02 ) is currently ${status}.`;
    });

    return [header, ...body];
  }

  if (type === 'trial') {
    const header = `\x02TRIAL QUOTA:\x02 [ Trial List - ${users.length} Trialing - (Min \x02${minQuotaGB}GB\x02) ]`;

    const body = users.map((u, i) => {
      const size = formatSize(u.bytes_uploaded);
      const isPassing = u.bytes_uploaded >= minQuotaKB;
      const status = isPassing ? '\x0303\x02PASSING\x02\x0F' : '\x0304\x02FAILING\x02\x0F';
      const color = isPassing ? '\x0303' : '\x0304';

      const daysRemaining = Math.max(getDaysRemaining(u.added_date, config.trialConfig.daysDefault), 0);

      return `[ ${color}${String(i + 1).padStart(2, '0')}\x0F ] ${u.username}/trial ( \x02${size} Up\x02 ) is currently ${status}. (${daysRemaining} Days Remaining)`;
    });

    return [header, ...body];
  }

  throw new Error(`Invalid report type: ${type}`);
};

/**
 * Combines quota and trial reports.
 * @param {Array} quotaUsers - Users in quota.
 * @param {Array} trialUsers - Users in trial.
 * @returns {Array<string>} - Combined report.
 */
const generateCombinedReport = (quotaUsers, trialUsers) => {
  const quotaReport = generateReport(quotaUsers, 'quota');
  const trialReport = generateReport(trialUsers, 'trial');

  return [...quotaReport, '', ...trialReport];
};

module.exports = {
  getTopUploaders,
  updateUserStatus,
  processTrials,
  processQuotas,
  generateReport,
  generateCombinedReport,
};

const fs = require('fs').promises; // Use promises for async file operations
const path = require('path');
const fileOps = require('./fileoperations'); // Import file operations utility
const config = require('../config.json');
const { formatSize, getDaysUntilEndOfWeek, getDaysRemaining, getTimeRemaining, formatRemainingTime, getDaysRemainingFromTrialStart, getTopUploaders } = require('./utils');
const { updateUserStatus } = require('./utils');

// Define status constants
const STATUS_DISABLED = 0;
const STATUS_TRIAL = 1;
const STATUS_QUOTA = 2;
const STATUS_BOTH = 3;

/**
 * Safely moves a file between directories, handling cross-device issues.
 * @param {string} source - Source file path.
 * @param {string} destination - Destination file path.
 */
const safelyMoveFile = async (source, destination) => {
  try {
    await fs.copyFile(source, destination);
    await fs.unlink(source);
    console.log(`[FILEOPS] Moved ${source} to ${destination}`);
  } catch (error) {
    console.error(`[ERROR] Failed to move ${source} to ${destination}: ${error.message}`);
    throw error;
  }
};

/**
 * Processes trial logic for users.
 * @param {object} db - The SQLite database connection.
 */
const processTrials = async (db) => {
  if (!config.trialConfig.enabled) {
    console.log(`[INFO] Trial processing is disabled in the configuration.`);
    return;
  }

  console.log(`[INFO] Processing trial users...`);

  const trialUsers = await db.all(`
    SELECT username, bytes_uploaded, trial_start_date, days_remaining
    FROM user_stats
    WHERE status = 1;
  `);

  console.log(`[DEBUG] Found ${trialUsers.length} trial users in the database.`);

  const minQuotaKB = parseFloat(config.trialConfig.quotaGB) * 1024 ** 2;

  for (const user of trialUsers) {
    console.log(`[DEBUG] Processing user: ${user.username}`);
    console.log(`[DEBUG] User details: ${JSON.stringify(user)}`);

    if (!user.trial_start_date || isNaN(user.trial_start_date)) {
      console.error(
        `[ERROR] Invalid trial_start_date for user ${user.username}. Value: ${user.trial_start_date}`
      );
      continue;
    }

    const trialStartDateUnix = parseInt(user.trial_start_date, 10);
    console.log(`[DEBUG] trial_start_date (Unix): ${trialStartDateUnix}`);

    const daysRemaining = Math.max(
      Math.floor(
        getDaysRemainingFromTrialStart(trialStartDateUnix, config.trialConfig.daysDefault)
      ),
      0
    ); // Ensure daysRemaining is an integer and non-negative

    console.log(`[DEBUG] Calculated daysRemaining for ${user.username}: ${daysRemaining}`);

    if (daysRemaining <= 0) {
      const passed = user.bytes_uploaded >= minQuotaKB;
      console.log(`[DEBUG] User ${user.username} passed trial quota: ${passed}`);

      if (passed) {
        await updateUserStatus(
          db,
          user.username,
          STATUS_QUOTA,
          true,
          getDaysUntilEndOfWeek(),
          'Promoted to quota after passing trial'
        );
        console.log(`[TRIAL] User ${user.username} passed trial and promoted to quota.`);
      } else if (config.quotaConfig.failBackToTrial) {
        const trialDays = config.trialConfig.daysDefault;
        await updateUserStatus(
          db,
          user.username,
          STATUS_TRIAL,
          false,
          trialDays,
          'Moved back to trial after failing trial'
        );
        console.log(
          `[TRIAL] User ${user.username} failed trial and moved back to trial with ${trialDays} days.`
        );
      } else {
        const userFilePath = path.join(config.paths.usersDir, user.username);
        try {
          await fileOps.appendFlagsToUserFile(
            userFilePath,
            config.trialConfig.failSetFlagsTrial,
            config.paths.tmpDir
          );
          console.log(
            `[TRIAL] Added delete flag (${config.trialConfig.failSetFlagsTrial}) to ${user.username}.`
          );
        } catch (error) {
          console.error(
            `[ERROR] Failed to update FLAGS for ${user.username} during trial failure: ${error.message}`
          );
        }

        try {
          const stats = `Uploaded: ${formatSize(user.bytes_uploaded)}`;
          await fileOps.createGoodbyeFile(
            config.paths.byeFiles,
            user.username,
            'Trial failure',
            stats,
            false
          );
          console.log(
            `[BYE] Created goodbye file for ${user.username} due to trial failure.`
          );
        } catch (error) {
          console.error(
            `[ERROR] Failed to create goodbye file for ${user.username}: ${error.message}`
          );
        }

        await updateUserStatus(
          db,
          user.username,
          STATUS_DISABLED,
          false,
          null,
          'Disabled after failing trial'
        );
        console.log(
          `[DISABLED] User ${user.username} has been disabled due to trial failure.`
        );
      }
    } else {
      await db.run(
        `
        UPDATE user_stats
        SET days_remaining = ?
        WHERE username = ?;
      `,
        [daysRemaining, user.username]
      );
      console.log(
        `[TRIAL] User ${user.username} trial updated: ${daysRemaining} days remaining.`
      );
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
    const currentDaysRemaining = getDaysUntilEndOfWeek();

    if (user.days_remaining !== currentDaysRemaining) {
      await db.run(`
        UPDATE user_stats
        SET days_remaining = ?
        WHERE username = ?;
      `, [currentDaysRemaining, user.username]);
      console.log(`[QUOTA] Fixed days_remaining for user ${user.username} to ${currentDaysRemaining}.`);
    }

    if (currentDaysRemaining <= 0) {
      const passed = user.bytes_uploaded >= minQuotaKB;

      if (!passed) {
        if (config.quotaConfig.failBackToTrial) {
          const trialDays = config.trialConfig.daysDefault;
          await updateUserStatus(db, user.username, STATUS_TRIAL, false, trialDays, 'Moved back to trial after failing quota');
          console.log(`[QUOTA] User ${user.username} failed quota and moved back to trial with ${trialDays} days.`);
        } else {
          const userFilePath = path.join(config.paths.usersDir, user.username);
          try {
            await fileOps.appendFlagsToUserFile(userFilePath, config.quotaConfig.failSetFlagsQuota, config.paths.tmpDir);
            console.log(`[FLAGS] Added delete flag (${config.quotaConfig.failSetFlagsQuota}) to ${user.username}.`);
          } catch (error) {
            console.error(`[ERROR] Failed to update FLAGS for ${user.username}: ${error.message}`);
          }

          try {
            const stats = `Uploaded: ${formatSize(user.bytes_uploaded)}`;
            await fileOps.createGoodbyeFile(config.paths.byeFiles, user.username, "Quota failure", stats, false);
            console.log(`[BYE] Created goodbye file for ${user.username} due to quota failure.`);
          } catch (error) {
            console.error(`[ERROR] Failed to create goodbye file for ${user.username}: ${error.message}`);
          }

          await updateUserStatus(db, user.username, STATUS_DISABLED, false, null, 'Disabled after failing quota');
          console.log(`[DISABLED] User ${user.username} has been disabled due to quota failure.`);
        }
      } else {
        await updateUserStatus(db, user.username, STATUS_QUOTA, true, getDaysUntilEndOfWeek(), 'Passed quota and reset for next week');
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
    console.log(`[DEBUG] Processing user for report: ${u.username}. Trial start: ${u.trial_start_date}, Days remaining: ${u.days_remaining}`);
    const size = formatSize(u.bytes_uploaded);
    const isPassing = u.bytes_uploaded >= minQuotaKB;
    const status = isPassing ? '\x0303\x02PASSING\x02\x0F' : '\x0304\x02FAILING\x02\x0F';
    const color = isPassing ? '\x0303' : '\x0304';

    const trialStartDateUnix = parseInt(u.trial_start_date, 10);
    const daysRemaining = Math.max(
      getDaysRemainingFromTrialStart(trialStartDateUnix, config.trialConfig.daysDefault),
      0
    );

    console.log(`[DEBUG] User ${u.username}: Calculated daysRemaining: ${daysRemaining}`);

    const remainingTime = daysRemaining > 0 ? formatRemainingTime(daysRemaining) : 'Expired';
    return `[ ${color}${String(i + 1).padStart(2, '0')}\x0F ] ${u.username}/trial ( \x02${size} Up\x02 ) is currently ${status}. (${remainingTime})`;
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

const config = require('../config.json');
const { formatSize } = require('./utils');

/**
 * Fetches the top daily uploaders from the database.
 * @param {object} db - The SQLite database connection.
 * @param {number} limit - Number of top uploaders to fetch.
 * @returns {Promise<Array>} - List of top daily uploaders.
 */
const getTopDayUploaders = async (db, limit = 10) => {
  const users = await db.all(`
    SELECT username, day_files, dayup_bytes
    FROM user_stats
    ORDER BY dayup_bytes DESC
    LIMIT ?;
  `, [limit]);

  console.log('[DEBUG] Users fetched for Top Day Uploaders:', users); // Log fetched users
  return users;
};


/**
 * Generates the "Top Uploaders For The Day" report.
 * @param {Array} users - List of top daily uploaders.
 * @returns {Array<string>} - Formatted report lines.
 */

const generateDayUploadReport = (users) => {
  if (!Array.isArray(users) || users.length === 0) {
    console.error('[ERROR] No users found for daily upload report.');
    return [`No uploads recorded for the day.`];
  }

  const report = [];
  let totalFiles = 0;
  let totalBytes = 0;

  report.push(`\x02\x0310TOP UPLOADERS FOR THE DAY\x02\x03: [ \x02${users.length}\x02 Users ]`);

  users.forEach((user, index) => {
    totalFiles += user.day_files;
    totalBytes += user.dayup_bytes;

    const size = formatSize(user.dayup_bytes);
    report.push(
      `[ \x02\x0306${String(index + 1).padStart(2, '0')}\x02\x03 ] \x02${user.username}\x02 - (\x02${user.day_files}\x02 Files) - (\x02${size}\x02)`
    );
  });

  const totalSize = formatSize(totalBytes);
  report.push(
    `\x02\x0310TOTAL UPLOADS FOR THE DAY\x02\x03: ( \x02${totalFiles}\x02 Files ) - ( \x02${totalSize}\x02 )`
  );

  return report;
};


/**
 * Displays the "Top Uploaders For The Day" report at configured intervals.
 * @param {object} db - The SQLite database connection.
 */
const scheduleDayUploadReport = (db, sendReportCallback) => {
  if (!config.settings.showTopDayUp) {
    console.log('[INFO] "showTopDayUp" is disabled in the configuration.');
    return;
  }

  const announceChannels = config.settings.announceTopDayChan || [];
  const blowfishKey = config.settings.BlowfishKeyTopDayChan;

  if (!Array.isArray(announceChannels) || announceChannels.length === 0) {
    console.error('[ERROR] announceTopDayChan is not defined or is not an array.');
    return;
  }

  if (!blowfishKey) {
    console.error('[ERROR] BlowfishKeyTopDayChan is not defined in the configuration.');
    return;
  }

  console.log(
    `[INFO] Scheduling "Top Uploaders For The Day" report every ${
      config.settings.showTopDayUpInterval / 3600000
    } hours.`
  );

  setInterval(async () => {
    console.log('[INFO] Generating "Top Uploaders For The Day" report...');
    try {
      const users = await getTopDayUploaders(db);

      if (!Array.isArray(users) || users.length === 0) {
        console.log('[INFO] No uploads recorded for the day.');
        return;
      }

      const report = generateDayUploadReport(users);

      announceChannels.forEach((channel) => {
        // Ensure Blowfish key is associated with the channel
        if (!blowfishKey) {
          console.error(`[ERROR] Blowfish key is undefined for channel: ${channel}`);
          return;
        }

        sendReportCallback(channel, blowfishKey, report);
      });
    } catch (error) {
      console.error('[ERROR] Failed to generate daily upload report:', error.message);
    }
  }, config.settings.showTopDayUpInterval);
};




module.exports = {
  getTopDayUploaders,
  generateDayUploadReport,
  scheduleDayUploadReport,
};

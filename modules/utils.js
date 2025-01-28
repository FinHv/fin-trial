const { fishEncrypt, fishDecrypt } = require('./fish');

/**
 * Calculates the time remaining until the end of the week in days, hours, and minutes.
 * @returns {string} - The remaining time in the format "X days, Y hours, Z minutes".
 */
const getTimeRemaining = () => {
  const now = new Date();
  const endOfWeek = new Date();
  const dayOfWeek = now.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6

  // Set end of week to next Sunday at midnight
  endOfWeek.setDate(now.getDate() + (7 - dayOfWeek) % 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const timeRemainingMs = endOfWeek - now;

  const days = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${days} days, ${hours} hours, ${minutes} minutes`;
};


/**
 * Fetches the top uploaders from the database.
 * @param {object} db - The SQLite database connection.
 * @param {number} limit - Number of top uploaders to fetch.
 * @param {number} status - Filter by status (1 = trial, 2 = quota).
 * @returns {Promise<Array>} - List of top uploaders.
 */
const getTopUploaders = async (db, limit = 20, status = 2) => {
  const query = `
    SELECT username, group_name, bytes_uploaded, added_date, days_remaining, trial_start_date
    FROM user_stats
    WHERE status = ?
    ORDER BY bytes_uploaded DESC
    LIMIT ?;
  `;

  const result = await db.all(query, [status, limit]);

  console.log(`[DEBUG] getTopUploaders: Retrieved users for status ${status}:`, result);

  return result;
};


/**
 * Calculates days remaining until the next reset based on the given dates.
 * @param {string} addedDate - The date the user was added.
 * @param {string|null} resetDate - The last reset date, if available.
 * @returns {number} - Days remaining until the next reset.
 */
const getDaysUntilNextReset = (addedDate, resetDate) => {
  const lastReset = resetDate ? new Date(resetDate) : new Date(addedDate);
  const nextReset = new Date(lastReset);
  nextReset.setDate(lastReset.getDate() + 7); // Add 7 days
  const now = new Date();
  return Math.ceil((nextReset - now) / (1000 * 60 * 60 * 24));
};

/**
 * Formats the remaining time into "X days, Y hours, Z minutes" format.
 * @param {number} daysRemaining - Remaining time in fractional days.
 * @returns {string} - Formatted time as "X days, Y hours, Z minutes".
 */
const formatRemainingTime = (daysRemaining) => {
  const days = Math.floor(daysRemaining);
  const hours = Math.floor((daysRemaining % 1) * 24);
  const minutes = Math.floor(((daysRemaining % 1) * 24 - hours) * 60);

  return `${days} days, ${hours} hours, ${minutes} minutes`;
};


/**
 * Converts KB to human-readable format.
 * @param {number} kb - The size in KB.
 * @returns {string} - Formatted size string.
 */
const formatSize = (kb) => {
  const bytes = kb * 1024; // Convert KB to bytes
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)}TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
};

/**
 * Calculates the time remaining until the end of the week (Sunday midnight).
 * @returns {number} - Days remaining as a plain number.
 */
const getDaysUntilEndOfWeek = () => {
  const now = new Date();
  const endOfWeek = new Date(now);
  const dayOfWeek = now.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6

  // Set end of week to next Sunday at midnight
  endOfWeek.setDate(now.getDate() + (7 - dayOfWeek) % 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const timeRemainingMs = endOfWeek - now;

  const days = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
  return days; // Return plain number
};

/**
 * Updates the user's status in the database.
 * @param {object} db - The SQLite database connection.
 * @param {string} username - The username to update.
 * @param {number} status - The new status value (1 = trial, 2 = quota).
 * @param {boolean} passed - Whether the user passed the trial/quota.
 * @param {number} daysRemaining - Days remaining for the user.
 * @param {string} [reason='System update'] - Reason for the status update.
 */
const updateUserStatus = async (db, username, status, passed, daysRemaining, reason = 'System update') => {
  await db.run(`
    UPDATE user_stats
    SET status = ?, passed_trial = ?, days_remaining = ?, last_updated = CURRENT_TIMESTAMP
    WHERE username = ?;
  `, [status, passed ? 1 : 0, daysRemaining, username]);

  console.log(`[STATUS UPDATE] User ${username} updated to status ${status} with ${daysRemaining} days remaining. Reason: ${reason}`);
};

/**
 * Calculates days remaining for a trial or quota period.
 * @param {string} startDate - ISO date string representing the start date.
 * @param {number} duration - Duration in days.
 * @returns {number} - Days remaining.
 */
const getDaysRemaining = (startDate, duration) => {
  const now = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + duration);
  return Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
};

/**
 * Calculates the days remaining from a trial start date.
 * @param {number} trialStartDateUnix - Unix timestamp for the trial start date.
 * @param {number} trialDays - Total trial period in days.
 * @returns {number} - Days remaining.
 */
const getDaysRemainingFromTrialStart = (trialStartDate, trialDays) => {
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
  const trialEndTime = trialStartDate + trialDays * 24 * 60 * 60; // Calculate end time in seconds
  const timeRemaining = trialEndTime - now;

  if (timeRemaining <= 0) return 0;

  const daysRemaining = timeRemaining / (24 * 60 * 60); // Convert seconds to days
  return daysRemaining;
};

/**
 * Sends a command to the specified socket, with optional Blowfish encryption.
 * @param {Socket} socket - The socket connection to send the command to.
 * @param {string} cmd - The command to send.
 * @param {string} [blowfishKey=null] - Optional Blowfish encryption key.
 */
const sendCommand = (socket, cmd, blowfishKey = null) => {
  try {
    // Validate inputs
    if (!socket) {
      throw new Error('Invalid socket connection.');
    }
    if (typeof cmd !== 'string' || !cmd.trim()) {
      throw new Error('Invalid cmd: Command must be a non-empty string.');
    }
    if (blowfishKey) {
      if (typeof blowfishKey !== 'string') {
        throw new Error('Invalid blowfishKey: Must be a string.');
      }
      if (blowfishKey.length < 4 || blowfishKey.length > 56) {
        throw new Error('Invalid blowfishKey: Must be 4-56 characters long.');
      }
    }

    let messageToSend = cmd;

    // Encrypt if blowfishKey is provided
    if (blowfishKey && cmd.startsWith('PRIVMSG')) {
      if (!cmd.includes(':')) {
        throw new Error('Invalid cmd format: Missing message body.');
      }
      const [prefix, message] = cmd.split(/:(.+)/);

      if (!message || !message.trim()) {
        throw new Error('Invalid cmd: Message body must not be empty.');
      }

      const encryptedMessage = fishEncrypt(message, blowfishKey);

      if (encryptedMessage) {
        messageToSend = `${prefix}:${encryptedMessage}`;
        console.debug(`[DEBUG] Encrypted Message Sent: ${encryptedMessage}`);
      } else {
        throw new Error('Encryption failed. Unable to send message.');
      }
    }

    // Send the message
    const finalMessage = `${messageToSend}\r\n`;
    socket.write(finalMessage, 'utf8');
    //console.debug(`[SEND] ${messageToSend}`);
  } catch (error) {
    console.error(`[ERROR] Failed to send command: ${error.message}`);
  }
};

module.exports = {
  sendCommand,
  formatSize,
  getDaysUntilEndOfWeek,
  getDaysRemaining,
  getTimeRemaining,
  updateUserStatus,
  formatRemainingTime,
  getDaysRemainingFromTrialStart,
  getTopUploaders
};

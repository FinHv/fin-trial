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

const getDaysUntilNextReset = (addedDate, resetDate) => {
  const lastReset = resetDate ? new Date(resetDate) : new Date(addedDate);
  const nextReset = new Date(lastReset);
  nextReset.setDate(lastReset.getDate() + 7); // Add 7 days
  const now = new Date();
  return Math.ceil((nextReset - now) / (1000 * 60 * 60 * 24));
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
 * @returns {string} - Days and hours remaining.
 */
const getDaysUntilEndOfWeek = () => {
  const now = new Date();
  const endOfWeek = new Date(now);
  const dayOfWeek = now.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6

  // Set end of week to next Sunday at midnight
  endOfWeek.setDate(now.getDate() + (7 - dayOfWeek) % 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const timeRemainingMs = endOfWeek - now;

  // Calculate days and hours remaining
  const days = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} Days Remaining`;
  }
  return `${hours} Hours Remaining`;
};

/**
 * Calculates days remaining for trial or quota period.
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
    console.debug(`[SEND] ${messageToSend}`);
  } catch (error) {
    console.error(`[ERROR] Failed to send command: ${error.message}`);
  }
};

module.exports = {
  sendCommand,
  formatSize,
  getDaysUntilEndOfWeek,
  getDaysRemaining,
  getTimeRemaining
};

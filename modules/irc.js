const tls = require('tls');
const { fishDecrypt, fishEncrypt } = require('./fish');
const { sendCommand, updateUserStatus, getTopUploaders } = require('./utils');
const { generateCombinedReport } = require('./quota');
const { scheduleDayUploadReport } = require('./topup');
const fileOps = require('./fileoperations');
const config = require('../config.json');

// Define status constants
const STATUS_DISABLED = 0;
const STATUS_TRIAL = 1;
const STATUS_QUOTA = 2;
const STATUS_BOTH = 3;

/**
 * Logs messages with a timestamp and log level.
 * @param {string} level - The log level (INFO, WARNING, ERROR).
 * @param {string} message - The log message.
 */
const logWithTimestamp = (level, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// Ensure mandatory configuration fields are present
const validateConfig = () => {
  const requiredFields = [
    { key: 'server.channels', value: config.server.channels },
    { key: 'settings.staffUsers', value: config.settings.staffUsers },
    { key: 'settings.staffChan', value: config.settings.staffChan },
    { key: 'settings.BlowfishKeyTopDayChan', value: config.settings.BlowfishKeyTopDayChan },
  ];

  requiredFields.forEach(({ key, value }) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      logWithTimestamp('ERROR', `Missing or invalid configuration: ${key}`);
      throw new Error(`Missing or invalid configuration: ${key}`);
    }
  });

  logWithTimestamp('INFO', 'Configuration validation passed.');
};

validateConfig();

// Utility to check if the user is staff
const isStaffUser = (nick) => config.settings.staffUsers.includes(nick);

// Function to get the blowfish key for a given channel
const getBlowfishKeyForChannel = (channel) => {
  const channelConfig = config.server.channels.find((chan) => chan.name === channel);
  if (channelConfig) {
    return channelConfig.blowfishKey;
  }

  if (config.settings.staffChan.includes(channel)) {
    return config.settings.blowfishKeyStaffChan;
  }

  if (config.settings.announceTopDayChan.includes(channel)) {
    return config.settings.BlowfishKeyTopDayChan;
  }

  return null;
};

// Start the bot
const startBot = (db) => {
  const { host, port, ssl, nickname, connectstring } = config.server;
  const options = {
    host,
    port,
    rejectUnauthorized: false,
  };

  const socket = ssl ? tls.connect(options) : require('net').connect(options);
  socket.setEncoding('utf8');

  socket.on('connect', () => {
    logWithTimestamp('INFO', `Connecting to IRC server at ${host}:${port}`);
    sendCommand(socket, `PASS ${connectstring}`);
    sendCommand(socket, `NICK ${nickname}`);
    sendCommand(socket, `USER ${nickname} 0 * :StatsBot`);

    config.server.channels.forEach(({ name }) => {
      logWithTimestamp('INFO', `Joining channel: ${name}`);
      sendCommand(socket, `JOIN ${name}`);
    });

    config.settings.staffChan.forEach((channel) => {
      logWithTimestamp('INFO', `Joining staff channel: ${channel}`);
      sendCommand(socket, `JOIN ${channel}`);
    });

    logWithTimestamp('INFO', 'Connected to IRC');
  });

  socket.on('data', async (data) => {
    if (data.startsWith('PING :')) {
      sendCommand(socket, `PONG :${data.substring(6)}`);
      return;
    }

    const lines = data.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.includes('PRIVMSG')) continue;

      const match = trimmedLine.match(/^:(\S+?)!\S+ PRIVMSG (\S+) :(.+)$/);
      if (!match) continue;

      const [_, sender, channel, message] = match;

      const blowfishKey = getBlowfishKeyForChannel(channel);
      if (!blowfishKey) {
        logWithTimestamp('WARNING', `Blowfish key is undefined for channel: ${channel}`);
        continue;
      }

      let decryptedMessage;
      try {
        decryptedMessage = message.startsWith('+OK ') ? fishDecrypt(message, blowfishKey) : message;
      } catch (err) {
        logWithTimestamp('ERROR', `Blowfish decryption failed: ${err.message}`);
        continue;
      }

      const senderNick = sender.split('!')[0];
      const isStaffChannel = config.settings.staffChan.includes(channel);

      if (!config.server.channels.some((chan) => chan.name === channel) && !isStaffChannel) {
        sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt('This command is not allowed in this channel.', blowfishKey)}`);
        logWithTimestamp('ERROR', `Command issued in unauthorized channel: ${channel}`);
        continue;
      }

      // Handle "!top" command
      if (decryptedMessage.trim() === '!top') {
        try {
          const quotaUsers = await getTopUploaders(db, 25, STATUS_QUOTA);
          const trialUsers = await getTopUploaders(db, 25, STATUS_TRIAL);
          const combinedReport = generateCombinedReport(quotaUsers, trialUsers);

          combinedReport.forEach((line) => {
            sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt(line, blowfishKey)}`);
          });

          logWithTimestamp('INFO', '!top command processed successfully');
        } catch (error) {
          logWithTimestamp('ERROR', `Failed to process !top command: ${error.message}`);
        }
      }

      // Handle staff-only "!ft" commands
      if (isStaffChannel && isStaffUser(senderNick)) {
        if (decryptedMessage.startsWith('!ft')) {
          const parts = decryptedMessage.split(' ');
          const command = parts[1];
          const username = parts[2];
          const argument = parts[3];

          if (!username) {
            sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt('Usage: !ft <trial|quota|extend|delete> <username> [<days>]', blowfishKey)}`);
            continue;
          }

try {


if (command === 'trial') {
  const nowUnix = Math.floor(Date.now() / 1000); // Current time in Unix timestamp format

  await db.run(`
    UPDATE user_stats
    SET status = ?, passed_trial = ?, days_remaining = ?, trial_start_date = ?, last_updated = CURRENT_TIMESTAMP
    WHERE username = ?;
  `, [STATUS_TRIAL, 0, config.trialConfig.daysDefault, nowUnix, username]);

  const trialStartDateISO = new Date(nowUnix * 1000).toISOString();

  sendCommand(
    socket,
    `PRIVMSG ${channel} :${fishEncrypt(
      `User ${username} updated to trial with ${config.trialConfig.daysDefault} days. Trial start date has been set to ${trialStartDateISO}.`,
      blowfishKey
    )}`
  );
  logWithTimestamp('INFO', `User ${username} updated to trial. Trial start date: ${trialStartDateISO}`);
} else if (command === 'quota') {
    // Update the user's status to quota
    await updateUserStatus(db, username, STATUS_QUOTA, true, null, 'Manual action via !ft quota');
    sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt(`User ${username} updated to quota.`, blowfishKey)}`);
  } else if (command === 'extend') {
    const daysToReplace = parseInt(argument, 10);
    if (isNaN(daysToReplace) || daysToReplace <= 0) {
      sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt('Invalid number of days. Please specify a positive integer.', blowfishKey)}`);
      continue;
    }

    // Update the trial period with the specified number of days and reset the trial start date
    const nowUnix = Math.floor(Date.now() / 1000); // Current Unix timestamp
    const trialStartDateISO = new Date(nowUnix * 1000).toISOString();

    await db.run(`
      UPDATE user_stats
      SET days_remaining = ?, trial_start_date = ?, last_updated = CURRENT_TIMESTAMP
      WHERE username = ? AND status = ?;
    `, [daysToReplace, nowUnix, username, STATUS_TRIAL]);

    sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt(`User ${username}'s trial updated to ${daysToReplace} days remaining. Trial start date has been reset to ${trialStartDateISO}.`, blowfishKey)}`);
    logWithTimestamp('INFO', `User ${username} trial updated to ${daysToReplace} days. New trial start date: ${trialStartDateISO}`);
  } else if (command === 'delete') {
    const userFilePath = path.join(config.paths.usersDir, username);
    const tmpDir = path.join(config.paths.tmpDir, `${username}.tmp`);
    await fileOps.appendFlagsToUserFile(userFilePath, '6', tmpDir);
    sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt(`User ${username} marked for deletion.`, blowfishKey)}`);
  } else {
    sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt('Invalid command. Use "trial", "quota", "extend", or "delete".', blowfishKey)}`);
  }
} catch (error) {
  logWithTimestamp('ERROR', `Failed to process command ${command} for ${username}: ${error.message}`);
}


        }
      }
    }
  });

  // Schedule automatic "Top Uploaders For The Day" report
  if (config.settings.showTopDayUp) {
    console.log('[INFO] Scheduling automatic daily upload report...');
    scheduleDayUploadReport(db, (channel, blowfishKey, report) => {
      report.forEach((line) => {
        sendCommand(socket, `PRIVMSG ${channel} :${fishEncrypt(line, blowfishKey)}`);
      });
    });
  }

  return socket;
};

module.exports = { startBot };

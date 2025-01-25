const fs = require('fs');
const path = require('path');

/**
 * Reads a user file and returns its content.
 * @param {string} filePath - Path to the user file.
 * @returns {string} - Content of the user file.
 */
const readUserFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`User file does not exist: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
};

/**
 * Writes content to a user file.
 * @param {string} filePath - Path to the user file.
 * @param {string} content - Content to write.
 */
const writeUserFile = (filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf-8');
};

/**
 * Appends flags to a user file.
 * @param {string} userFile - Path to the user file.
 * @param {string} flags - Flags to append.
 * @param {string} tmpDir - Path to the temporary directory.
 */
const appendFlagsToUserFile = (userFile, flags, tmpDir) => {
  const content = readUserFile(userFile);
  const lines = content.split('\n');

  // Filter out existing FLAGS line and append new FLAGS
  const filteredContent = lines.filter((line) => !line.startsWith('FLAGS '));
  const currentFlags = lines.find((line) => line.startsWith('FLAGS '))?.split(' ')[1] || '';
  const newFlags = `FLAGS ${flags}${currentFlags}`;

  // Create temporary file for updates
  const tmpFilePath = path.join(tmpDir, `${path.basename(userFile)}.tmp`);
  fs.writeFileSync(tmpFilePath, [...filteredContent, newFlags].join('\n'), 'utf-8');

  // Overwrite original file
  fs.renameSync(tmpFilePath, userFile);
};

/**
 * Creates a goodbye file for a user.
 * @param {string} byeFilesDir - Directory to store goodbye files.
 * @param {string} username - Username for the goodbye file.
 * @param {string} reason - Reason for the goodbye.
 * @param {string} stats - User stats to include.
 * @param {boolean} isTopUpFail - Whether the failure was due to top-up.
 */
const createGoodbyeFile = (byeFilesDir, username, reason, stats, isTopUpFail) => {
  const byeFilePath = path.join(byeFilesDir, `${username}.bye`);
  const lines = [
    `You were deleted because of failed quota.`,
    `Stats: ${stats}`,
  ];

  if (isTopUpFail) {
    lines.push(`Although, the reason was the top-up: ${reason}`);
  }

  fs.writeFileSync(byeFilePath, lines.join('\n'), 'utf-8');
  fs.chmodSync(byeFilePath, 0o666);
};

/**
 * Deletes a temporary file if it exists.
 * @param {string} filePath - Path to the temporary file.
 */
const deleteTempFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  readUserFile,
  writeUserFile,
  appendFlagsToUserFile,
  createGoodbyeFile,
  deleteTempFile,
};

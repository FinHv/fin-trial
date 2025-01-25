const crypto = require('crypto');

/**
 * Pads the message with null bytes (\0) to a multiple of 8 bytes.
 */
const padMessage = (message) => {
  const blockSize = 8;
  const padding = blockSize - (Buffer.byteLength(message, 'utf8') % blockSize);
  //console.log('--- Padding Info ---');
  //console.log('Original Message:', message);
  //console.log('Original Message Length (Bytes):', Buffer.byteLength(message, 'utf8'));
  //console.log('Padding Size (Bytes):', padding);
  const paddedMessage = Buffer.concat([Buffer.from(message, 'utf8'), Buffer.alloc(padding, 0)]);
  //console.log('Padded Message (Hex):', paddedMessage.toString('hex'));
  return paddedMessage;
};

const adjustMessageLengthForBase64 = (message) => {
    const messageBuffer = Buffer.from(message, 'utf8');
    const paddingNeeded = (3 - (messageBuffer.length % 3)) % 3;

    // Add dummy bytes if padding is needed
    if (paddingNeeded > 0) {
        return Buffer.concat([messageBuffer, Buffer.alloc(paddingNeeded, 0)]).toString('utf8');
    }

    return message; // No adjustment needed
};

/**
 * Removes trailing null bytes (\0) from the decrypted message.
 */
const unpadMessage = (message) => {
  //console.log('--- Unpadding Info ---');
  //console.log('Message Before Unpadding:', message);
  const unpaddedMessage = message.replace(/\0+$/, '');
  //console.log('Message After Unpadding:', unpaddedMessage);
  return unpaddedMessage;
};

/**
 * Custom Base64 encoding for FiSH 10.
 */
const fishBase64Encode = (buffer) => {
    return buffer.toString('base64'); // Keep `=` as-is, no replacement
};


/**
 * Custom Base64 decoding for FiSH 10.
 */
const fishBase64Decode = (base64) => {
  //console.log('--- Base64 Decoding Info ---');
  //console.log('Base64 Message to Decode:', base64);
  const decodedBuffer = Buffer.from(base64.replace(/\*/g, '='), 'base64');
  //console.log('Decoded Buffer (Hex):', decodedBuffer.toString('hex'));
  return decodedBuffer;
};

/**
 * Prepares the key for Blowfish encryption.
 * Ensures the key length is valid (4 to 56 bytes).
 */
const prepareKey = (key) => {
  //console.log('--- Key Preparation Info ---');
  //console.log('Original Key:', key);
  const maxKeyLength = 56;
  const keyBuffer = Buffer.from(key, 'utf8');
  //console.log('Key Buffer Length (Bytes):', keyBuffer.length);
  const preparedKey =
    keyBuffer.length > maxKeyLength ? keyBuffer.slice(0, maxKeyLength) : keyBuffer;
  //console.log('Prepared Key (Hex):', preparedKey.toString('hex'));
  return preparedKey;
};

/**
 * Encrypts a message using FiSH 10-compatible Blowfish in CBC mode.
 */
const fishEncrypt = (message, key) => {
    try {
        // Adjust message length to avoid Base64 padding
        const adjustedMessage = adjustMessageLengthForBase64(message);

        const iv = crypto.randomBytes(8); // Generate random IV
        const preparedKey = prepareKey(key);
        const cipher = crypto.createCipheriv('bf-cbc', preparedKey, iv);
        cipher.setAutoPadding(false);

        const paddedMessage = padMessage(adjustedMessage);
        const encrypted = Buffer.concat([cipher.update(paddedMessage), cipher.final()]);
        const finalMessage = Buffer.concat([iv, encrypted]);

        const base64Message = fishBase64Encode(finalMessage);

        //console.log('--- Encryption Debug Info ---');
        //console.log('Original Message:', message);
        //console.log('Adjusted Message:', adjustedMessage);
        //console.log('Message Length:', adjustedMessage.length);
        //console.log('Generated IV (Hex):', iv.toString('hex'));
        //console.log('Padded Message (Hex):', paddedMessage.toString('hex'));
        //console.log('Encrypted Data (Hex):', encrypted.toString('hex'));
        //console.log('Final Base64 Message:', base64Message);

        return `+OK *${base64Message}`;
    } catch (error) {
        console.error('Encryption failed:', error.message);
        return null;
    }
};

/**
 * Decrypts a message encrypted with FiSH 10-compatible Blowfish in CBC mode.
 */
// Function to decrypt FiSH (Blowfish-CBC) messages
const fishDecrypt = (encryptedMessage, blowfishKey) => {
  if (!encryptedMessage.startsWith('+OK ')) {
    console.warn('[WARN] Invalid FiSH encrypted message format.');
    return null;
  }

  try {
    // Remove "+OK " prefix and replace asterisks if present
    const base64Data = encryptedMessage.substring(4).replace(/\*/g, '');
    const encryptedData = Buffer.from(base64Data, 'base64');

    // Extract the IV (first 8 bytes) and ciphertext
    const iv = encryptedData.slice(0, 8);
    const ciphertext = encryptedData.slice(8);

    // Create a Blowfish cipher in CBC mode with no padding
    const decipher = crypto.createDecipheriv('bf-cbc', Buffer.from(blowfishKey), iv);
    decipher.setAutoPadding(false);

    // Decrypt the ciphertext
    let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    // Trim any null padding
    return decrypted.replace(/\0+$/, '');
  } catch (error) {
    console.error('[ERROR] Blowfish decryption failed:', error.message);
    return null;
  }
};

module.exports = { fishEncrypt, fishDecrypt };

const sqlite = require('./modules/sqlite');
const { initializeDatabase, updateUserStats } = require('./modules/datauser.js');
const { processTrials, processQuotas } = require('./modules/quota');
const { startBot } = require('./modules/irc');
const config = require('./config.json');

(async () => {
  const db = await sqlite.connect();

  console.log(`[INFO] Initializing database...`);
  await initializeDatabase(db);

  console.log(`[INFO] Starting periodic user stats update and processing...`);
  setInterval(async () => {
    try {
      console.log(`[INFO] Updating user stats...`);
      await updateUserStats(db);

      console.log(`[INFO] Processing trial users...`);
      await processTrials(db);

      console.log(`[INFO] Processing quota users...`);
      await processQuotas(db);
    } catch (error) {
      console.error(`[ERROR] Failed during periodic processing:`, error.message);
    }
  }, config.settings.updateInterval);

  console.log(`[INFO] Starting IRC bot...`);
  startBot(db); // Only pass the database connection
})();

/**
 * Migration script: syncs all Sequelize models to the database.
 * Uses { alter: true } to add new columns without dropping existing data.
 *
 * Run via: npm run db:migrate
 */

import sequelize from '../config/database.js';
import '../models/index.js'; // registers all model associations

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    await sequelize.sync({ alter: true });
    console.log('All tables migrated successfully.');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

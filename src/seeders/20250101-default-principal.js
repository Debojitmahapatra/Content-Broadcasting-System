/**
 * Seeder: Default Principal Account
 *
 * Creates the default principal account if it doesn't already exist.
 * Run via: npm run db:seed
 *
 * Credentials:
 *   Email:    principal@grubpac.com
 *   Password: Admin@1234
 */

import bcrypt from 'bcrypt';
import sequelize from '../config/database.js';
import User from '../models/User.js';

const DEFAULT_PRINCIPAL = {
  name: 'Principal Admin',
  email: 'principal@grubpac.com',
  password: 'Admin@1234',
  role: 'principal',
};

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Sync tables (create if not exist, no force drop)
    await sequelize.sync({ alter: false });
    console.log('Tables synced.');

    const existing = await User.findOne({ where: { email: DEFAULT_PRINCIPAL.email } });

    if (existing) {
      console.log(`Principal already exists: ${DEFAULT_PRINCIPAL.email}`);
    } else {
      const password_hash = await bcrypt.hash(DEFAULT_PRINCIPAL.password, 10);
      await User.create({
        name: DEFAULT_PRINCIPAL.name,
        email: DEFAULT_PRINCIPAL.email,
        password_hash,
        role: DEFAULT_PRINCIPAL.role,
      });
      console.log(`Default principal created: ${DEFAULT_PRINCIPAL.email}`);
      console.log(`Password: ${DEFAULT_PRINCIPAL.password}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Seeder failed:', err.message);
    process.exit(1);
  }
}

seed();

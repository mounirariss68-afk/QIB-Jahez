/** `npm run seed` — rebuild the world from scratch. */
import { reseed } from './index.js';
import { pool } from '../db.js';
reseed().then(async () => { await pool.end(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });

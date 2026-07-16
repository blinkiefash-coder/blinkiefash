import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const run = async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    await c.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS dark_store_id UUID');
    try {
      await c.query(`ALTER TABLE vendors
        ADD CONSTRAINT vendors_dark_store_id_fkey
        FOREIGN KEY (dark_store_id) REFERENCES dark_stores(id)
        ON DELETE SET NULL`);
    } catch {
      // ignore if exists
    }

    const jayVendorRes = await c.query(
      'SELECT id, email FROM vendors WHERE email ILIKE $1 LIMIT 1',
      ['jayjagganath@gmail.com']
    );
    if (!jayVendorRes.rows.length) throw new Error('Vendor not found: jayjagganath@gmail.com');
    const jayVendor = jayVendorRes.rows[0];

    const cuttackStoreRes = await c.query(
      "SELECT id, name, city FROM dark_stores WHERE is_active = true AND city ILIKE 'cuttack' ORDER BY name LIMIT 1"
    );
    if (!cuttackStoreRes.rows.length) throw new Error('No active Cuttack dark store found');
    const cuttackStore = cuttackStoreRes.rows[0];

    await c.query(
      'UPDATE vendors SET dark_store_id = $1, updated_at = NOW() WHERE id = $2',
      [cuttackStore.id, jayVendor.id]
    );

    const nikeVendorRes = await c.query(
      'SELECT id, email, store_name, city, address, lat, lng FROM vendors WHERE email ILIKE $1 OR email ILIKE $2 LIMIT 1',
      ['nike.patia', 'nike.patia@gmail.com']
    );
    if (!nikeVendorRes.rows.length) throw new Error('Vendor not found: nike.patia');
    const nikeVendor = nikeVendorRes.rows[0];

    const nikeStoreName = (nikeVendor.store_name || '').trim() || 'Nike Patia Dark Store';
    const nikeCity = (nikeVendor.city || '').trim() || 'Patia';
    const nikeAddress = (nikeVendor.address || '').trim() || 'Patia';

    let nikeStoreRes = await c.query(
      'SELECT id, name, city FROM dark_stores WHERE name ILIKE $1 AND city ILIKE $2 LIMIT 1',
      [nikeStoreName, nikeCity]
    );

    if (!nikeStoreRes.rows.length) {
      nikeStoreRes = await c.query(
        `INSERT INTO dark_stores (name, city, address, lat, lng, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, name, city`,
        [nikeStoreName, nikeCity, nikeAddress, nikeVendor.lat, nikeVendor.lng]
      );
    }

    const nikeStore = nikeStoreRes.rows[0];

    await c.query(
      'UPDATE vendors SET dark_store_id = $1, updated_at = NOW() WHERE id = $2',
      [nikeStore.id, nikeVendor.id]
    );

    const verify = await c.query(
      `SELECT v.email, v.store_name, v.dark_store_id,
              ds.name AS dark_store_name, ds.city AS dark_store_city
       FROM vendors v
       LEFT JOIN dark_stores ds ON ds.id = v.dark_store_id
       WHERE v.email ILIKE $1 OR v.email ILIKE $2 OR v.email ILIKE $3
       ORDER BY v.email`,
      ['jayjagganath@gmail.com', 'nike.patia', 'nike.patia@gmail.com']
    );

    await c.query('COMMIT');
    console.log('UPDATED_LINKS');
    console.log(JSON.stringify(verify.rows, null, 2));
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
};

await run();

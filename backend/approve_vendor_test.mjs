import { pool } from './db.js';

const email = 'testvendor1783939498@blinkie.local';
const client = await pool.connect();

try {
  await client.query('BEGIN');

  const s = await client.query(
    'SELECT id, user_id FROM sellers WHERE lower(email)=lower($1) LIMIT 1',
    [email]
  );

  if (!s.rows.length) {
    throw new Error('Seller not found');
  }

  const sellerId = s.rows[0].id;
  const userId = s.rows[0].user_id;

  await client.query(
    "UPDATE sellers SET is_approved=true, is_operational=true, status='approved', updated_at=NOW() WHERE id=$1",
    [sellerId]
  );

  if (userId) {
    await client.query(
      "UPDATE users SET is_active=true, role='vendor', updated_at=NOW() WHERE id=$1",
      [userId]
    );
  }

  await client.query('COMMIT');

  const out = await client.query(
    `SELECT s.id as seller_id, s.email, s.status, s.is_approved, s.is_operational, s.user_id,
            u.is_active as user_is_active, u.role as user_role
     FROM sellers s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [sellerId]
  );

  console.log(JSON.stringify({ success: true, record: out.rows[0] }, null, 2));
} catch (e) {
  await client.query('ROLLBACK');
  console.error(e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}

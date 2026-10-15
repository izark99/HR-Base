// Writable columns per table. Anything not listed here is ignored on POST/PUT,
// so leave status can only change through /approve and /reject.
const TABLES = {
  departments: ['name', 'parent_id', 'manager_id'],
  employees: ['code', 'full_name', 'email', 'phone', 'dob', 'gender', 'department_id', 'position', 'join_date', 'status', 'note'],
  contracts: ['employee_id', 'type', 'start_date', 'end_date', 'salary', 'note'],
  leaves: ['employee_id', 'type', 'from_date', 'to_date', 'days', 'reason'],
};

const json = (data, status = 200) => Response.json(data, { status });

// Cloudflare Access puts the signed-in email here. Without Access in front, it is "anonymous".
const userOf = (req) => req.headers.get('Cf-Access-Authenticated-User-Email') || 'anonymous';

function pick(table, body) {
  const cols = TABLES[table].filter((c) => c in body);
  return { cols, vals: cols.map((c) => (body[c] === '' ? null : body[c])) };
}

async function api(req, env, parts) {
  const [table, id, action] = parts;
  const db = env.DB;

  if (table === 'me') return json({ email: userOf(req) });

  if (table === 'stats') {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const [byStatus, byDept, expiring, pending] = await db.batch([
      db.prepare('SELECT status, COUNT(*) n FROM employees GROUP BY status'),
      db.prepare(`SELECT COALESCE(d.name, '(Chưa gán)') name, COUNT(*) n FROM employees e
                  LEFT JOIN departments d ON d.id = e.department_id
                  WHERE e.status != 'resigned' GROUP BY e.department_id ORDER BY n DESC`),
      db.prepare(`SELECT c.*, e.full_name FROM contracts c JOIN employees e ON e.id = c.employee_id
                  WHERE c.end_date BETWEEN ? AND ? ORDER BY c.end_date`).bind(today, in30),
      db.prepare(`SELECT COUNT(*) n FROM leaves WHERE status = 'pending'`),
    ]);
    return json({ byStatus: byStatus.results, byDept: byDept.results, expiring: expiring.results, pendingLeaves: pending.results[0].n });
  }

  if (!TABLES[table]) return json({ error: 'not found' }, 404);

  if (table === 'leaves' && id && (action === 'approve' || action === 'reject') && req.method === 'POST') {
    const r = await db
      .prepare(`UPDATE leaves SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'`)
      .bind(action === 'approve' ? 'approved' : 'rejected', userOf(req), id)
      .run();
    return r.meta.changes ? json({ ok: true }) : json({ error: 'Đơn không tồn tại hoặc đã xử lý' }, 409);
  }

  if (req.method === 'GET') {
    const { results } = await db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    return json(results);
  }

  if (req.method === 'POST' && !id) {
    const { cols, vals } = pick(table, await req.json());
    if (!cols.length) return json({ error: 'empty body' }, 400);
    const r = await db
      .prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .bind(...vals)
      .run();
    return json({ id: r.meta.last_row_id }, 201);
  }

  if (req.method === 'PUT' && id) {
    const { cols, vals } = pick(table, await req.json());
    if (!cols.length) return json({ error: 'empty body' }, 400);
    await db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`).bind(...vals, id).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && id) {
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url.pathname.slice(5).split('/').filter(Boolean));
    } catch (e) {
      // D1 constraint errors (duplicate code, bad date range...) come back as 400 with the message.
      return json({ error: String(e.message || e) }, 400);
    }
  },
};

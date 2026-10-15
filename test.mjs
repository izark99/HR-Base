// Smoke test against a running `npm run dev` (default http://localhost:8787).
import assert from 'node:assert/strict';
const B = process.env.BASE || 'http://localhost:8787';
const call = async (p, method = 'GET', body) => {
  const r = await fetch(B + '/api/' + p, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};
const code = 'T' + Date.now();
const dep = await call('departments', 'POST', { name: 'Phòng Test' });
assert.equal(dep.status, 201);
const emp = await call('employees', 'POST', { code, full_name: 'Nguyễn Test', department_id: dep.data.id, status: 'active', hacked: 'x' });
assert.equal(emp.status, 201);
assert.equal((await call('employees', 'POST', { code, full_name: 'Dup', status: 'active' })).status, 400, 'duplicate code rejected');
assert.equal((await call('leaves', 'POST', { employee_id: emp.data.id, type: 'Phép năm', from_date: '2026-10-20', to_date: '2026-10-19', days: 1 })).status, 400, 'bad range rejected');
const lv = await call('leaves', 'POST', { employee_id: emp.data.id, type: 'Phép năm', from_date: '2026-10-20', to_date: '2026-10-21', days: 2, status: 'approved' });
assert.equal((await call('leaves')).data.find((l) => l.id === lv.data.id).status, 'pending', 'status not settable via POST');
assert.equal((await call(`leaves/${lv.data.id}/approve`, 'POST')).status, 200);
assert.equal((await call(`leaves/${lv.data.id}/reject`, 'POST')).status, 409, 'cannot re-decide');
const s = await call('stats');
assert.ok(s.data.byDept.some((d) => d.name === 'Phòng Test'));
assert.equal((await call('nope')).status, 404);
await call(`employees/${emp.data.id}`, 'DELETE');
await call(`departments/${dep.data.id}`, 'DELETE');
console.log('ok');

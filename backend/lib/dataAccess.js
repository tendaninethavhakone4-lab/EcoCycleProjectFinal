// Live Supabase data layer. Mock fallback removed — DB must be configured.
const { supabase, USE_MOCK } = require("./supabase");

const live = !USE_MOCK && !!supabase;

function ensureLive() {
  if (!live) throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env and restart.");
}

async function selectAll(table, { orderBy, ascending = true, limit } = {}) {
  ensureLive();
  let q = supabase.from(table).select("*");
  if (orderBy) q = q.order(orderBy, { ascending });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) { console.error(`[db.selectAll ${table}]`, error.message); return []; }
  return data || [];
}

async function selectOne(table, match) {
  ensureLive();
  let q = supabase.from(table).select("*");
  Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v); });
  const { data, error } = await q.maybeSingle();
  if (error && error.code !== "PGRST116") console.error(`[db.selectOne ${table}]`, error.message);
  return data || null;
}

async function insert(table, row) {
  ensureLive();
  const { data, error } = await supabase.from(table).insert(row).select().maybeSingle();
  if (error) { console.error(`[db.insert ${table}]`, error.message); throw error; }
  return data;
}

async function update(table, match, patch) {
  ensureLive();
  let q = supabase.from(table).update(patch);
  Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v); });
  const { data, error } = await q.select().maybeSingle();
  if (error) { console.error(`[db.update ${table}]`, error.message); throw error; }
  return data;
}

async function remove(table, match) {
  ensureLive();
  let q = supabase.from(table).delete();
  Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v); });
  const { error } = await q;
  if (error) { console.error(`[db.remove ${table}]`, error.message); throw error; }
  return true;
}

async function audit(actor, action, resource, ip = "0.0.0.0") {
  if (!live) return;
  const { error } = await supabase.from("audit_log").insert({ actor, action, resource, ip });
  if (error) console.error("[audit]", error.message);
}

module.exports = { live, selectAll, selectOne, insert, update, remove, audit, supabase };

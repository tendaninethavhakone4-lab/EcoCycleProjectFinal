// Seeds your Supabase project with demo data so dashboards aren't empty.
// Run: node db/seed.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { supabase, USE_MOCK } = require("../lib/supabase");

if (USE_MOCK || !supabase) {
  console.error("❌ Supabase not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const hash = (p) => bcrypt.hashSync(p, 8);

const users = [
  { name: "Demo User",       email: "user@EcoCycle.app",       role: "user",       branch: "Lagos Central", password_hash: hash("demo1234") },
  { name: "Demo Admin",      email: "admin@EcoCycle.app",      role: "admin",      branch: "Lagos Central", password_hash: hash("demo1234") },
  { name: "Demo Superadmin", email: "superadmin@EcoCycle.app", role: "superadmin", branch: "HQ",            password_hash: hash("demo1234") },
  { name: "Mbongeni Qwabe",  email: "qwabembongeni074@gmail.com", role: "admin",      branch: "Lagos Central", password_hash: hash("Thabiso@12345") },
  { name: "Mbongeni Qwabe",  email: "qwabembongeni4@gmail.com",   role: "superadmin", branch: "HQ",            password_hash: hash("Thabiso@12345") },
];

const branches = [
  { name: "Lagos Central", country: "Nigeria", manager: "Adekunle O.",   status: "active" },
  { name: "Nairobi East",  country: "Kenya",   manager: "Wanjiku M.",    status: "active" },
  { name: "Accra Hub",     country: "Ghana",   manager: "Kofi Mensah",   status: "active" },
  { name: "Cape Town West", country: "South Africa", manager: "Lerato M.", status: "active" },
];

const pickers = [
  { id: "PK-001", name: "Joseph Adekunle", phone: "+2348034449201", branch: "Lagos Central",  status: "active",   total_kg: 328 },
  { id: "PK-002", name: "Mary Kamau",      phone: "+254712345678",  branch: "Nairobi East",   status: "active",   total_kg: 192 },
  { id: "PK-003", name: "Eze Bonaventure", phone: "+2348022345566", branch: "Lagos Central",  status: "inactive", total_kg: 410 },
  { id: "PK-004", name: "Adaeze Okafor",   phone: "+2348081119900", branch: "Lagos Central",  status: "active",   total_kg: 612 },
  { id: "PK-005", name: "Kofi Asante",     phone: "+233244987654",  branch: "Accra Hub",      status: "active",   total_kg: 285 },
  { id: "PK-006", name: "Thandi Nkosi",    phone: "+27821234567",   branch: "Cape Town West", status: "active",   total_kg: 178 },
];

const materials = ["Plastic", "Paper", "Metal", "Glass"];
const prices = { Plastic: 9.0, Paper: 5.5, Metal: 45.0, Glass: 4.5 }; // ZAR per kg

const transactions = [];
for (let i = 0; i < 60; i++) {
  const m = materials[i % 4];
  const w = 8 + Math.floor(Math.random() * 35);
  const picker = pickers[i % pickers.length];
  transactions.push({
    id: "TX-" + (1000 + i),
    picker_id: picker.id,
    material: m,
    weight: w,
    price_per_kg: prices[m],
    amount: +(w * prices[m]).toFixed(2),
    status: i % 11 === 0 ? "pending" : "completed",
    branch: picker.branch,
    created_at: new Date(Date.now() - i * 6 * 3600 * 1000).toISOString(),
  });
}

const sales = [
  { id: "SL-001", material: "Plastic", qty: 200, price_per_kg: 9.80, total: 1960, buyer: "Recycle Co. Lagos",  status: "paid" },
  { id: "SL-002", material: "Paper",   qty: 350, price_per_kg: 6.00, total: 2100, buyer: "Pulp & Print Ltd.",  status: "pending" },
  { id: "SL-003", material: "Metal",   qty:  80, price_per_kg: 47.5, total: 3800, buyer: "MetalWorks Africa",  status: "paid" },
  { id: "SL-004", material: "Glass",   qty: 120, price_per_kg: 5.00, total:  600, buyer: "GlassFoundry SA",    status: "shipped" },
];

const payouts = [
  { id: "PO-001", picker_id: "PK-001", amount: 2664, method: "MobileMoney",  status: "paid" },
  { id: "PO-002", picker_id: "PK-002", amount: 1656, method: "MobileMoney",  status: "paid" },
  { id: "PO-003", picker_id: "PK-004", amount: 5112, method: "BankTransfer", status: "pending" },
  { id: "PO-004", picker_id: "PK-005", amount: 1980, method: "MobileMoney",  status: "paid" },
];

const tickets = [
  { id: "TK-001", user_email: "user@EcoCycle.app", subject: "QR scanner not opening on iOS", message: "Camera permission requested but never opens.", status: "open" },
  { id: "TK-002", user_email: "admin@EcoCycle.app", subject: "Payout export error", message: "CSV export returns empty file.", status: "in_progress", assigned_to: "support@ecocycle.app" },
  { id: "TK-003", user_email: "user@EcoCycle.app", subject: "Wrong material price", message: "Plastic showing R8 should be R9.", status: "resolved" },
];

const alerts = [
  { level: "warn",  message: "Glass stock below threshold (560 kg)" },
  { level: "info",  message: "4 picker verifications pending review" },
  { level: "info",  message: "Weekly payout batch completed" },
  { level: "error", message: "Branch Nairobi East offline for 12 mins" },
];

async function upsert(table, rows, options = {}) {
  if (!rows || !rows.length) return;
  const { data, error } = await supabase.from(table).upsert(rows, options);
  if (error) {
    console.error(`❌ ${table}:`, error.message);
  } else {
    console.log(`✅ ${table}: ${rows.length} rows`);
  }
}

(async () => {
  console.log("🌱 Seeding EcoCycle Supabase project...");
  await upsert("users", users, { onConflict: "email" });
  // Branches table has no unique constraint on name — clear & insert
  await supabase.from("branches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await upsert("branches", branches);
  await upsert("pickers", pickers);
  // Update prices to ZAR
  for (const [material, price_per_kg] of Object.entries(prices)) {
    await supabase.from("prices").upsert({ material, price_per_kg, updated_at: new Date().toISOString() });
  }
  console.log("✅ prices: ZAR rates set");
  await upsert("transactions", transactions);
  await upsert("sales", sales);
  await upsert("payouts", payouts);
  await upsert("support_tickets", tickets);
  await upsert("alerts", alerts);
  console.log("✨ Done.");
  console.log("   Login with: user@EcoCycle.app / demo1234");
  console.log("   Or:         qwabembongeni074@gmail.com / Thabiso@12345 (admin)");
  console.log("   Or:         qwabembongeni4@gmail.com   / Thabiso@12345 (superadmin)");
  process.exit(0);
})();

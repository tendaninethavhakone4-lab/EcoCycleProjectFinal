// Wipe every operational table (keeps tables + default settings).
// Usage:  cd backend && node scripts/wipe-data.js --yes
require("dotenv").config();
const { supabase, USE_MOCK } = require("../lib/supabase");

const TABLES = [
  "audit_log", "alerts", "support_tickets",
  "payouts", "sales", "transactions",
  "price_history", "inventory", "prices",
  "pickers", "branches", "users",
];

(async () => {
  if (!process.argv.includes("--yes")) {
    console.error("Refusing to wipe without --yes flag.");
    process.exit(1);
  }
  if (USE_MOCK || !supabase) {
    console.error("Supabase is not configured. Check backend/.env");
    process.exit(1);
  }
  for (const t of TABLES) {
    // delete every row by matching a column that exists in every table
    const { error } = await supabase.from(t).delete().not("created_at", "is", null);
    if (error) console.error(`[${t}]`, error.message);
    else console.log(`cleared ${t}`);
  }
  console.log("Done. Add your real data via the Admin/SuperAdmin UI.");
})();

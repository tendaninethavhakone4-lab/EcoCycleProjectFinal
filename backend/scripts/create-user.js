// Create your first REAL superadmin (or any role) account.
// Usage:
//   cd backend
//   node scripts/create-user.js "Full Name" you@domain.co.za "StrongPass!" superadmin
//
// Roles: user | admin | superadmin

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { supabase, USE_MOCK } = require("../lib/supabase");

(async () => {
  if (USE_MOCK || !supabase) {
    console.error("Supabase is not configured. Check backend/.env");
    process.exit(1);
  }
  const [, , name, email, password, role = "user", branch = null, phone = null] = process.argv;
  if (!name || !email || !password) {
    console.error('Usage: node scripts/create-user.js "Name" email@x.co.za password [role] [branch] [phone]');
    process.exit(1);
  }
  const password_hash = bcrypt.hashSync(password, 8);
  const { data, error } = await supabase
    .from("users")
    .upsert({ name, email, role, branch, phone, password_hash, status: "active" }, { onConflict: "email" })
    .select()
    .maybeSingle();
  if (error) { console.error("Failed:", error.message); process.exit(1); }
  console.log("OK:", { id: data.id, email: data.email, role: data.role });
})();

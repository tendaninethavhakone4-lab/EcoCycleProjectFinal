// Branded transactional emails. Two delivery modes:
//   1. Supabase Edge Function `send-email` (preferred, used in prod) — set
//        SUPABASE_FUNCTIONS_URL (e.g. https://<ref>.supabase.co/functions/v1)
//        SUPABASE_FUNCTIONS_KEY (anon or service_role key)
//      The edge function holds RESEND_API_KEY as a Supabase secret.
//   2. Direct Resend — set RESEND_API_KEY locally if no edge function configured.
// Other env:
//   MAIL_FROM        — e.g. "EcoCycle <noreply@mmqtech.co.za>"
//   PUBLIC_BASE_URL  — e.g. http://localhost:4000  (used in email links)

const BRAND = "EcoCycle";
const TAGLINE = "Smart Recycling. Real Rewards.";
const FROM = process.env.MAIL_FROM || `${BRAND} <noreply@mmqtech.co.za>`;
const KEY  = process.env.RESEND_API_KEY;
const BASE = process.env.PUBLIC_BASE_URL || "http://localhost:4000";
const FN_URL = process.env.SUPABASE_FUNCTIONS_URL;
const FN_KEY = process.env.SUPABASE_FUNCTIONS_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function shell(title, bodyHtml, preheader = "") {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BRAND}</title></head>
<body style="margin:0;padding:0;background:#F1F5F4;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#0F172A">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F1F5F4;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08)">

        <!-- header -->
        <tr><td style="background:linear-gradient(135deg,#064E3B 0%,#10B981 60%,#34D399 100%);padding:36px 36px 28px;color:#ffffff">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="vertical-align:middle">
                <div style="display:inline-block;background:rgba(255,255,255,.18);padding:6px 12px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">♻ ${BRAND}</div>
              </td>
              <td align="right" style="vertical-align:middle;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">${TAGLINE}</td>
            </tr>
          </table>
          <div style="font-size:26px;font-weight:800;margin-top:18px;line-height:1.25">${title}</div>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:32px 36px;font-size:15px;line-height:1.6;color:#0F172A">
          ${bodyHtml}
        </td></tr>

        <!-- divider -->
        <tr><td style="padding:0 36px"><div style="height:1px;background:#E2E8F0"></div></td></tr>

        <!-- footer -->
        <tr><td style="padding:22px 36px;background:#F8FAFC;color:#64748B;font-size:12px;line-height:1.6">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td>
                <strong style="color:#0F172A">${BRAND}</strong> · Recycling intelligence platform<br>
                Powered by <strong>mmqtech.co.za</strong>
              </td>
              <td align="right" style="font-size:11px;color:#94A3B8">© ${new Date().getFullYear()} ${BRAND}</td>
            </tr>
          </table>
          <div style="margin-top:14px;color:#94A3B8;font-size:11px">You received this email because an account was registered or updated on ${BRAND}. If this wasn't you, please ignore this message.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href, label) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0">
    <tr><td style="background:linear-gradient(135deg,#059669,#10B981);border-radius:12px">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:.01em">${label}</a>
    </td></tr>
  </table>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;color:#64748B;font-size:13px;width:140px">${label}</td>
    <td style="padding:10px 0;font-weight:600;color:#0F172A">${value}</td>
  </tr>`;
}

async function send({ to, subject, html }) {
  if (!to) return { skipped: true };

  if (FN_URL && FN_KEY) {
    try {
      const res = await fetch(`${FN_URL.replace(/\/$/, "")}/send-email`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${FN_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { console.error("[mailer:edge]", res.status, out); return { error: out.error || res.statusText }; }
      console.log("[mailer:edge] sent to", to, "id=", out.id);
      return { id: out.id, via: "edge" };
    } catch (e) {
      console.error("[mailer:edge] failed:", e.message);
      return { error: e.message };
    }
  }

  if (!KEY) {
    console.warn("[mailer] No RESEND_API_KEY and no SUPABASE_FUNCTIONS_URL — skipping email to", to);
    return { skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { console.error("[mailer]", res.status, out); return { error: out.message || res.statusText }; }
    console.log("[mailer:resend] sent to", to, "id=", out.id);
    return { id: out.id, via: "resend" };
  } catch (e) {
    console.error("[mailer] failed:", e.message);
    return { error: e.message };
  }
}

// ---------- templates ----------

function pendingEmail(user) {
  const html = shell("Registration received",
    `<p style="margin:0 0 14px">Hi <strong>${user.name || "there"}</strong>,</p>
     <p>Thanks for registering on <strong>${BRAND}</strong>. Your account is now <span style="color:#059669;font-weight:700">pending administrator approval</span>. You'll receive another email the moment it's activated &mdash; usually within a few hours.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
       <tr><td style="padding:16px 20px;background:#F8FAFC;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B">Registration details</td></tr>
       <tr><td style="padding:6px 20px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
         ${detailRow("Full name", user.name || "&mdash;")}
         ${detailRow("Email", user.email || "&mdash;")}
         ${detailRow("Role", (user.role || "user"))}
         ${user.branch ? detailRow("Branch", user.branch) : ""}
         ${user.phone ? detailRow("Phone", user.phone) : ""}
       </table></td></tr>
     </table>
     <p style="color:#64748B;font-size:13px;margin:0">In the meantime, feel free to browse our public site or reply to this email if you have any questions.</p>`,
    "Your EcoCycle account is pending approval"
  );
  return { subject: `${BRAND} — registration received`, html };
}

function approvedEmail(user) {
  const html = shell("You're approved &mdash; welcome aboard",
    `<p style="margin:0 0 14px">Hi <strong>${user.name || "there"}</strong>,</p>
     <p>Great news! Your <strong>${BRAND}</strong> account has been <span style="color:#059669;font-weight:700">approved</span>. You can sign in straight away with the password you chose during registration.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
       <tr><td style="padding:16px 20px;background:#ECFDF5;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#047857">Account active</td></tr>
       <tr><td style="padding:6px 20px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
         ${detailRow("Full name", user.name || "&mdash;")}
         ${detailRow("Email", user.email || "&mdash;")}
         ${detailRow("Role", (user.role || "user"))}
         ${user.branch ? detailRow("Branch", user.branch) : ""}
         ${user.phone ? detailRow("Phone", user.phone) : ""}
       </table></td></tr>
     </table>
     ${btn(`${BASE}/AuthScreens/LoginPage.html`, "Sign in to " + BRAND + " →")}
     <p style="color:#64748B;font-size:13px;margin:18px 0 0">Tip: bookmark the sign-in page so you can jump back in anytime.</p>`,
    "Your EcoCycle account is now active"
  );
  return { subject: `Your ${BRAND} account has been approved`, html };
}

function adminInviteEmail(user, tempPassword) {
  const html = shell("You've been invited as " + (user.role === "superadmin" ? "a SuperAdmin" : "an Administrator"),
    `<p style="margin:0 0 14px">Hi <strong>${user.name || "there"}</strong>,</p>
     <p>A SuperAdmin has just created a <strong>${user.role || "admin"}</strong> account for you on <strong>${BRAND}</strong>. Use the credentials below to sign in &mdash; you'll be asked to set your own password on first login.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
       <tr><td style="padding:16px 20px;background:#F8FAFC;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B">Sign-in credentials</td></tr>
       <tr><td style="padding:6px 20px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
         ${detailRow("Email", user.email)}
         ${user.branch ? detailRow("Branch", user.branch) : ""}
         ${detailRow("Role", user.role || "admin")}
       </table></td></tr>
       <tr><td style="padding:8px 20px 18px">
         <div style="font-size:12px;color:#64748B;margin-bottom:6px">Temporary password</div>
         <div style="font-family:'Cascadia Mono',Consolas,'Courier New',monospace;font-size:18px;font-weight:700;letter-spacing:.04em;color:#064E3B;background:#ECFDF5;border:1px dashed #6EE7B7;padding:14px 18px;border-radius:10px;text-align:center">${tempPassword}</div>
       </td></tr>
     </table>
     ${btn(`${BASE}/AuthScreens/LoginPage.html`, "Sign in & set your password →")}
     <p style="color:#B45309;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px 16px;font-size:13px;margin:18px 0 0">
       <strong>Security:</strong> the temporary password above expires the moment you set a new one. If you didn't expect this invite, please ignore this email.
     </p>`,
    "Welcome to EcoCycle — your admin account is ready"
  );
  return { subject: `You've been invited to ${BRAND}`, html };
}

module.exports = { send, approvedEmail, adminInviteEmail, pendingEmail };

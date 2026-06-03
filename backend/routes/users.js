const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

const SECRET = process.env.JWT_SECRET || 'ecocycle_secret_key_change_later';

const { sendWelcomeEmail, sendForgotPasswordEmail } = require('../services/email');
const { authRequired, requireRole } = require('../middleware/auth');
const db = require('../lib/dataAccess');
const { supabase } = require('../lib/supabase');

const PROFILE_BUCKET = 'profile-photos';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    photo_url: user.photo_url || null,
    photo: user.photo_url || null,
    role: user.role === 'user' ? 'employee' : user.role,
    branch: user.branch || null,
    status: user.status,
  };
}

async function recordAudit(req, action, area, details = {}) {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: req.user?.id || null,
        actor_name: req.user?.name || null,
        actor_email: req.user?.email || null,
        action,
        area,
        details,
        created_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error('[auth.audit.record]', err.message);
  }
}

async function findUserByEmail(email) {
  return db.selectOne('users', { email: email.toLowerCase() });
}

function passwordValidationError(password, label = 'Password') {
  if (typeof password !== 'string' || password.length < 8) {
    return `${label} must be at least 8 characters.`;
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return `${label} must include both letters and numbers.`;
  }

  return null;
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }

  const passwordError = passwordValidationError(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await findUserByEmail(normalizedEmail);

    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await db.insert('users', {
      name: name.trim(),
      email: normalizedEmail,
      role: 'user',
      status: 'active',
      password_hash: passwordHash,
    });

    sendWelcomeEmail(newUser.email, newUser.name)
      .catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json({
      message: 'Account created successfully!',
      user: publicUser(newUser),
    });
  } catch (err) {
    console.error('[auth.register]', err.message);
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter your email and password.' });
  }

  try {
    const user = await findUserByEmail(email.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status && user.status !== 'active') {
      return res.status(403).json({ error: 'This account is not active yet.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await db.update('users', { id: user.id }, { last_login: new Date().toISOString() });

    const responseUser = publicUser(user);
    const token = jwt.sign(responseUser, SECRET, { expiresIn: '7d' });

    res.json({ token, user: responseUser });
  } catch (err) {
    console.error('[auth.login]', err.message);
    res.status(500).json({ error: 'Could not log in. Please try again.' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await db.selectOne('users', { id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[auth.me]', err.message);
    res.status(500).json({ error: 'Could not load your profile.' });
  }
});

router.get('/users', authRequired, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const users = await db.selectAll('users', { orderBy: 'created_at', ascending: false });
    res.json({ users: users.map(publicUser) });
  } catch (err) {
    console.error('[auth.users]', err.message);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

router.post('/users', authRequired, requireRole('superadmin'), async (req, res) => {
  const {
    name,
    email,
    phone,
    role = 'admin',
    branch,
    password,
  } = req.body;

  const normalizedRole = String(role || 'admin').toLowerCase().replace(/[\s_-]/g, '');

  if (!name || !email) {
    return res.status(400).json({ error: 'Please enter the admin name and email.' });
  }

  if (!['admin', 'superadmin'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'Role must be admin or superadmin.' });
  }

  const temporaryPassword = password || `EcoCycle${Math.floor(100000 + Math.random() * 900000)}!`;
  const passwordError = passwordValidationError(temporaryPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await db.insert('users', {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : null,
      role: normalizedRole === 'superadmin' ? 'superadmin' : 'admin',
      branch: branch || null,
      status: 'active',
      password_hash: passwordHash,
      must_change_password: true,
      created_at: new Date().toISOString(),
    });

    await recordAudit(req, 'Created admin account', 'Admin Management', {
      targetUserId: user.id,
      targetEmail: user.email,
      role: user.role,
      branch: user.branch,
    });

    res.status(201).json({
      message: `${user.name} was created successfully.`,
      user: publicUser(user),
      temporaryPassword,
    });
  } catch (err) {
    console.error('[auth.users.create]', err.message);
    res.status(500).json({ error: err.message || 'Could not create admin account.' });
  }
});

router.put('/users/:id', authRequired, requireRole('superadmin'), async (req, res) => {
  const { name, email, phone, role, branch, status } = req.body;
  const patch = {};

  if (name !== undefined) patch.name = String(name).trim();
  if (email !== undefined) patch.email = String(email).toLowerCase().trim();
  if (phone !== undefined) patch.phone = phone ? String(phone).trim() : null;
  if (branch !== undefined) patch.branch = branch || null;
  if (status !== undefined) patch.status = status || 'active';
  if (role !== undefined) {
    const normalizedRole = String(role || '').toLowerCase().replace(/[\s_-]/g, '');
    if (!['admin', 'superadmin'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'Role must be admin or superadmin.' });
    }
    patch.role = normalizedRole === 'superadmin' ? 'superadmin' : 'admin';
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'No changes were provided.' });
  }

  if (String(req.params.id) === String(req.user.id) && patch.status && patch.status !== 'active') {
    return res.status(400).json({ error: 'You cannot deactivate your own account while logged in.' });
  }

  try {
    if (patch.email) {
      const existing = await findUserByEmail(patch.email);
      if (existing && String(existing.id) !== String(req.params.id)) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
    }

    patch.updated_at = new Date().toISOString();
    const user = await db.update('users', { id: req.params.id }, patch);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await recordAudit(req, 'Updated admin account', 'Admin Management', {
      targetUserId: user.id,
      targetEmail: user.email,
      changedFields: Object.keys(patch).filter(key => key !== 'updated_at'),
    });

    res.json({
      message: `${user.name} was updated successfully.`,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('[auth.users.update]', err.message);
    res.status(500).json({ error: err.message || 'Could not update admin account.' });
  }
});

router.delete('/users/:id', authRequired, requireRole('superadmin'), async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'You cannot deactivate your own account while logged in.' });
  }

  try {
    const user = await db.update('users', { id: req.params.id }, {
      status: 'inactive',
      updated_at: new Date().toISOString(),
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await recordAudit(req, 'Deactivated admin account', 'Admin Management', {
      targetUserId: user.id,
      targetEmail: user.email,
    });

    res.json({
      message: `${user.name} has been deactivated.`,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('[auth.users.deactivate]', err.message);
    res.status(500).json({ error: err.message || 'Could not deactivate admin account.' });
  }
});

const DEFAULT_ROLE_PERMISSIONS = [
  { role: 'admin', permission_key: 'view_transactions', allowed: true },
  { role: 'admin', permission_key: 'edit_picker_profiles', allowed: true },
  { role: 'admin', permission_key: 'access_income_board', allowed: true },
  { role: 'admin', permission_key: 'export_data', allowed: false },
];

router.get('/role-permissions', authRequired, requireRole('superadmin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role, permission_key, allowed, updated_at, updated_by')
      .eq('role', 'admin')
      .order('permission_key');

    if (error) throw error;

    const saved = new Map((data || []).map(item => [item.permission_key, item]));
    const permissions = DEFAULT_ROLE_PERMISSIONS.map(item => ({
      ...item,
      ...(saved.get(item.permission_key) || {}),
    }));

    res.json({ permissions });
  } catch (err) {
    console.error('[auth.role_permissions.get]', err.message);
    res.status(500).json({ error: err.message || 'Could not load role permissions.' });
  }
});

router.put('/role-permissions', authRequired, requireRole('superadmin'), async (req, res) => {
  const { permissions } = req.body;

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'No permissions were provided.' });
  }

  const rows = DEFAULT_ROLE_PERMISSIONS.map(item => ({
    role: 'admin',
    permission_key: item.permission_key,
    allowed: Boolean(permissions[item.permission_key]),
    updated_by: req.user.id,
    updated_at: new Date().toISOString(),
  }));

  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .upsert(rows, { onConflict: 'role,permission_key' })
      .select('role, permission_key, allowed, updated_at, updated_by');

    if (error) throw error;

    await recordAudit(req, 'Updated role permissions', 'Permissions & Roles', {
      role: 'admin',
      permissions: rows.reduce((acc, row) => {
        acc[row.permission_key] = row.allowed;
        return acc;
      }, {}),
    });

    res.json({
      message: 'Role permissions saved to database.',
      permissions: data || rows,
    });
  } catch (err) {
    console.error('[auth.role_permissions.update]', err.message);
    res.status(500).json({ error: err.message || 'Could not save role permissions.' });
  }
});

router.get('/audit-logs', authRequired, requireRole('superadmin'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_id, actor_name, actor_email, action, area, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ logs: data || [] });
  } catch (err) {
    console.error('[auth.audit_logs.get]', err.message);
    res.status(500).json({ error: err.message || 'Could not load audit logs.' });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const users = await db.selectAll('users', { orderBy: 'created_at', ascending: false });
    const pending = users
      .filter(u => u.status === 'pending')
      .map(publicUser);

    res.json({ pending });
  } catch (err) {
    console.error('[auth.pending]', err.message);
    res.status(500).json({ error: 'Could not load pending accounts.' });
  }
});

router.put('/approve/:id', async (req, res) => {
  try {
    const user = await db.update('users', { id: req.params.id }, {
      status: 'active',
      approved_at: new Date().toISOString(),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      message: `${user.name}'s account has been approved. They can now log in.`,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('[auth.approve]', err.message);
    res.status(500).json({ error: 'Could not approve account.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please enter your email address.' });
  }

  try {
    const user = await findUserByEmail(email.trim());

    if (user) {
      const resetToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await sendForgotPasswordEmail(user.email, resetToken);
    }

    res.json({
      message: 'If an account with that email exists you will receive a reset link shortly.',
    });
  } catch (err) {
    console.error('[auth.forgot-password]', err.message);
    res.status(500).json({ error: 'Could not send password reset email.' });
  }
});

router.post('/reset-password', async (req, res) => {
  res.status(501).json({ error: 'Password reset links are not stored yet. Please ask an admin to reset your password.' });
});

router.post('/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }

  const passwordError = passwordValidationError(newPassword, 'New password');
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const user = await db.selectOne('users', { id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update('users', { id: user.id }, { password_hash: passwordHash });

    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    console.error('[auth.change-password]', err.message);
    res.status(500).json({ error: 'Could not change password.' });
  }
});

router.put('/profile', authRequired, async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name && !email && phone === undefined) {
    return res.status(400).json({ error: 'Please provide profile details to update.' });
  }

  try {
    const patch = {};
    if (name) patch.name = name.trim();
    if (email) patch.email = email.toLowerCase().trim();
    if (phone !== undefined) patch.phone = phone ? String(phone).trim() : null;

    if (patch.email) {
      const existing = await findUserByEmail(patch.email);
      if (existing && existing.id !== req.user.id) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
    }

    const user = await db.update('users', { id: req.user.id }, patch);
    res.json({ message: 'Profile updated successfully!', user: publicUser(user) });
  } catch (err) {
    console.error('[auth.profile]', err.message);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

router.post('/profile/photo', authRequired, async (req, res) => {
  const { image, fileName } = req.body;

  if (!image || !String(image).startsWith('data:image/')) {
    return res.status(400).json({ error: 'Please choose a valid image file.' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase is not configured.' });
  }

  try {
    const match = String(image).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Image upload format is invalid.' });
    }

    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const maxBytes = 2 * 1024 * 1024;

    if (buffer.length > maxBytes) {
      return res.status(400).json({ error: 'Photo is too large. Please choose an image smaller than 2 MB.' });
    }

    const extension =
      contentType.includes('png') ? 'png' :
      contentType.includes('webp') ? 'webp' :
      contentType.includes('gif') ? 'gif' :
      'jpg';

    const safeName = String(fileName || 'profile')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-');

    const baseName = safeName.replace(/\.[^.]+$/, '') || 'profile';
    const path = `${req.user.id}/${Date.now()}-${baseName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_BUCKET)
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    const photoUrl = data.publicUrl;

    const user = await db.update('users', { id: req.user.id }, { photo_url: photoUrl });

    res.json({
      message: 'Profile photo uploaded successfully.',
      photo_url: photoUrl,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('[auth.profile.photo]', err.message);
    res.status(500).json({ error: err.message || 'Could not upload profile photo.' });
  }
});

async function findRelatedPicker(user) {
  const pickers = await db.selectAll('pickers');
  const email = String(user.email || '').toLowerCase();
  const name = String(user.name || '').toLowerCase();

  return pickers.find(picker =>
    String(picker.email || '').toLowerCase() === email ||
    String(picker.name || '').toLowerCase() === name
  ) || null;
}

router.post('/account/deactivate', authRequired, async (req, res) => {
  try {
    const user = await db.update('users', { id: req.user.id }, {
      status: 'inactive',
      updated_at: new Date().toISOString(),
    });

    res.json({
      message: 'Your account has been deactivated.',
      user: publicUser(user),
    });
  } catch (err) {
    console.error('[auth.account.deactivate]', err.message);
    res.status(500).json({ error: 'Could not deactivate account.' });
  }
});

router.post('/account/delete-request', authRequired, async (req, res) => {
  try {
    const user = await db.update('users', { id: req.user.id }, {
      status: 'delete_requested',
      updated_at: new Date().toISOString(),
    });

    res.json({
      message: 'Your account deletion request has been saved for admin review.',
      user: publicUser(user),
    });
  } catch (err) {
    console.error('[auth.account.delete-request]', err.message);
    res.status(500).json({ error: 'Could not request account deletion.' });
  }
});

router.post('/account/reset-rewards', authRequired, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase is not configured.' });
  }

  try {
    const user = await db.selectOne('users', { id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const picker = await findRelatedPicker(user);
    if (!picker) {
      return res.json({
        message: 'No linked picker rewards profile was found for this account.',
        reset: false,
      });
    }

    const xpResult = await supabase
      .from('reward_xp_events')
      .delete()
      .eq('picker_id', picker.id);

    const redemptionResult = await supabase
      .from('reward_redemptions')
      .delete()
      .eq('picker_id', picker.id);

    if (xpResult.error && xpResult.error.code !== '42P01') throw xpResult.error;
    if (redemptionResult.error && redemptionResult.error.code !== '42P01') throw redemptionResult.error;

    res.json({
      message: 'Rewards and redemption records were reset for the linked picker profile.',
      reset: true,
    });
  } catch (err) {
    console.error('[auth.account.reset-rewards]', err.message);
    res.status(500).json({ error: err.message || 'Could not reset rewards.' });
  }
});

router.get('/pickers', authRequired, (req, res) => {
  const adminRoute = require('./admin');
  const pickers = adminRoute.pickers || [];
  res.json({ pickers });
});

module.exports = router;

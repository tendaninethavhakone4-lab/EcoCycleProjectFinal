const express = require('express');
const router = express.Router();

const { authRequired, requireRole } = require('../middleware/auth');
const db = require('../lib/dataAccess');

const DEFAULTS = {
  xp_per_kg: 15,
  daily_checkin_xp: 50,
  xp_per_level: 1000,
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateOnly(value) {
  return value ? new Date(value).toISOString().split('T')[0] : null;
}

function calculateLevel(xp, xpPerLevel) {
  return Math.floor(number(xp) / number(xpPerLevel, DEFAULTS.xp_per_level)) + 1;
}

function calculateStreak(dateValues) {
  const dates = [...new Set((dateValues || []).filter(Boolean))]
    .sort((a, b) => new Date(b) - new Date(a));

  if (!dates.length) return 0;

  let cursor = new Date(dates[0]);
  let streak = 0;
  const dateSet = new Set(dates);

  while (dateSet.has(cursor.toISOString().split('T')[0])) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function sameUtcDay(value, compare = new Date()) {
  return dateOnly(value) === compare.toISOString().split('T')[0];
}

function startOfUtcWeek(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy;
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function normalizeMaterial(value) {
  return String(value || '').toLowerCase();
}

function pickerZone(picker) {
  return picker?.zone || picker?.assigned_zone || picker?.branch || picker?.region || picker?.area || 'Unassigned';
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().replace(/[\s_-]/g, '');
}

async function getSettings() {
  const rows = await db.selectAll('reward_settings');
  return rows.reduce((settings, row) => {
    settings[row.id] = number(row.value, DEFAULTS[row.id] || 0);
    return settings;
  }, { ...DEFAULTS });
}

async function getActiveRows(table) {
  const rows = await db.selectAll(table);
  return rows.filter(row => row.is_active !== false);
}

function earnedBadges(allBadges, xp, totalKg) {
  return allBadges
    .filter(badge => number(xp) >= number(badge.xp_required) && number(totalKg) >= number(badge.kg_required))
    .map(badge => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      rarity: badge.rarity,
      earned: new Date().toISOString().split('T')[0],
    }));
}

async function buildRewards() {
  const [settings, pickers, transactions, xpEvents, badges, storeItems, redemptions] = await Promise.all([
    getSettings(),
    db.selectAll('pickers'),
    db.selectAll('transactions', { orderBy: 'created_at', ascending: false }),
    db.selectAll('reward_xp_events', { orderBy: 'created_at', ascending: false }),
    getActiveRows('reward_badges'),
    getActiveRows('reward_store_items'),
    db.selectAll('reward_redemptions', { orderBy: 'requested_at', ascending: false }),
  ]);

  const totals = new Map();

  function ensurePicker(pickerId, fallbackName, createdAt) {
    if (!pickerId) return null;
    if (!totals.has(pickerId)) {
      totals.set(pickerId, {
        picker_id: pickerId,
        picker_name: fallbackName || pickerId,
        picker_email: null,
        zone: 'Unassigned',
        totalKg: 0,
        transactionCount: 0,
        recyclingXp: 0,
        bonusXp: 0,
        spentXp: 0,
        lastActive: createdAt || null,
        activeDates: new Set(),
      });
    }
    return totals.get(pickerId);
  }

  pickers.forEach(picker => {
    const row = ensurePicker(picker.id, picker.name, picker.created_at);
    if (row) {
      row.picker_email = picker.email || null;
      row.zone = pickerZone(picker);
    }
  });

  transactions.forEach(txn => {
    const picker = pickers.find(row => row.id === txn.picker_id);
    const row = ensurePicker(txn.picker_id, picker?.name, txn.created_at);
    if (!row) return;
    if (picker?.email) row.picker_email = picker.email;
    if (picker) row.zone = pickerZone(picker);

    const weight = number(txn.weight || txn.quantity);
    row.totalKg += weight;
    row.transactionCount += 1;
    row.recyclingXp += Math.round(weight * settings.xp_per_kg);
    if (dateOnly(txn.created_at)) row.activeDates.add(dateOnly(txn.created_at));

    if (!row.lastActive || new Date(txn.created_at) > new Date(row.lastActive)) {
      row.lastActive = txn.created_at;
    }
  });

  xpEvents.forEach(event => {
    const picker = pickers.find(row => row.id === event.picker_id);
    const row = ensurePicker(event.picker_id, picker?.name, event.created_at);
    if (!row) return;
    if (picker) row.zone = pickerZone(picker);

    row.bonusXp += number(event.xp);
    if (dateOnly(event.created_at)) row.activeDates.add(dateOnly(event.created_at));
    if (!row.lastActive || new Date(event.created_at) > new Date(row.lastActive)) {
      row.lastActive = event.created_at;
    }
  });

  redemptions
    .filter(redemption => ['pending', 'approved'].includes(String(redemption.status || '').toLowerCase()))
    .forEach(redemption => {
      const row = ensurePicker(redemption.picker_id, null, redemption.requested_at);
      if (row) row.spentXp += number(redemption.xp_cost);
    });

  const transactionsByPicker = new Map();
  transactions.forEach(txn => {
    if (!txn.picker_id) return;
    if (!transactionsByPicker.has(txn.picker_id)) transactionsByPicker.set(txn.picker_id, []);
    transactionsByPicker.get(txn.picker_id).push(txn);
  });

  const leaderboard = [...totals.values()]
    .map(row => {
      const earnedXp = row.recyclingXp + row.bonusXp;
      const xp = Math.max(0, earnedXp - row.spentXp);
      const level = calculateLevel(xp, settings.xp_per_level);
      const streak = calculateStreak([...row.activeDates]);
      return {
        rank: 0,
        picker_id: row.picker_id,
        picker_name: row.picker_name,
        picker_email: row.picker_email,
        zone: row.zone,
        xp,
        earnedXp,
        spentXp: row.spentXp,
        recyclingXp: row.recyclingXp,
        bonusXp: row.bonusXp,
        level,
        streak,
        totalKg: row.totalKg,
        transactionCount: row.transactionCount,
        lastActive: dateOnly(row.lastActive),
        badges: earnedBadges(badges, xp, row.totalKg),
        challenges: buildPickerChallenges(row, transactionsByPicker.get(row.picker_id) || []),
        weeklyXpTrend: buildWeeklyXpTrend(transactionsByPicker.get(row.picker_id) || [], settings),
      };
    })
    .sort((a, b) => b.xp - a.xp)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const activity = [
    ...xpEvents.map(event => ({
      type: 'xp',
      title: `${number(event.xp).toLocaleString()} XP`,
      description: event.reason,
      picker_id: event.picker_id,
      created_at: event.created_at,
    })),
    ...transactions.slice(0, 20).map(txn => {
      const picker = pickers.find(row => row.id === txn.picker_id);
      const weight = number(txn.weight || txn.quantity);
      return {
        type: 'transaction',
        title: `+${Math.round(weight * settings.xp_per_kg).toLocaleString()} XP - Transaction Logged`,
        description: `${picker?.name || 'Picker'} collected ${weight.toLocaleString()} kg`,
        picker_id: txn.picker_id,
        created_at: txn.created_at,
      };
    }),
    ...redemptions.map(redemption => ({
      type: 'redemption',
      title: 'Reward Redeemed',
      description: `${redemption.reward_name} - ${number(redemption.xp_cost).toLocaleString()} XP`,
      picker_id: redemption.picker_id,
      created_at: redemption.requested_at,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    settings,
    leaderboard,
    leaderboardViews: buildLeaderboardViews(leaderboard),
    departmentRankings: buildDepartmentRankings(leaderboard),
    communityStats: buildCommunityStats(leaderboard),
    badges,
    storeItems,
    redemptions,
    activity: activity.slice(0, 20),
  };
}

function buildPickerChallenges(row, pickerTransactions) {
  const now = new Date();
  const weekStart = startOfUtcWeek(now);
  const monthStart = startOfUtcMonth(now);
  const dailyTarget = 10;
  const weeklyPlasticTarget = 5;
  const streakTarget = 3;
  const monthlyTarget = 50;

  const todayKg = pickerTransactions
    .filter(txn => sameUtcDay(txn.created_at, now))
    .reduce((sum, txn) => sum + number(txn.weight || txn.quantity), 0);

  const weeklyPlasticKg = pickerTransactions
    .filter(txn => new Date(txn.created_at) >= weekStart)
    .filter(txn => normalizeMaterial(txn.material_name || txn.material || txn.material_type).includes('plastic'))
    .reduce((sum, txn) => sum + number(txn.weight || txn.quantity), 0);

  const monthlyKg = pickerTransactions
    .filter(txn => new Date(txn.created_at) >= monthStart)
    .reduce((sum, txn) => sum + number(txn.weight || txn.quantity), 0);

  const streak = number(row.streak);

  return [
    {
      id: 'daily-10kg',
      type: 'daily',
      title: 'Collect 10 kg Today',
      description: `Record 10 kg in a single day (${Math.min(todayKg, dailyTarget).toLocaleString()}/${dailyTarget} kg)`,
      progress: Math.min(todayKg, dailyTarget),
      target: dailyTarget,
      xp: 75,
      completed: todayKg >= dailyTarget,
    },
    {
      id: 'weekly-plastic',
      type: 'weekly',
      title: 'Plastic Pioneer',
      description: `Collect 5 kg of plastic this week (${Math.min(weeklyPlasticKg, weeklyPlasticTarget).toLocaleString()}/${weeklyPlasticTarget} kg)`,
      progress: Math.min(weeklyPlasticKg, weeklyPlasticTarget),
      target: weeklyPlasticTarget,
      xp: 100,
      completed: weeklyPlasticKg >= weeklyPlasticTarget,
    },
    {
      id: 'paper-streak',
      type: 'daily',
      title: 'Paper Master',
      description: `Collect for 3 active days in a row (${Math.min(streak, streakTarget)}/${streakTarget})`,
      progress: Math.min(streak, streakTarget),
      target: streakTarget,
      xp: 200,
      completed: streak >= streakTarget,
    },
    {
      id: 'monthly-legend',
      type: 'monthly',
      title: 'Monthly Legend',
      description: `Collect 50 kg this month (${Math.min(monthlyKg, monthlyTarget).toLocaleString()}/${monthlyTarget} kg)`,
      progress: Math.min(monthlyKg, monthlyTarget),
      target: monthlyTarget,
      xp: 500,
      completed: monthlyKg >= monthlyTarget,
    },
  ];
}

function buildWeeklyXpTrend(pickerTransactions, settings) {
  const weekStart = startOfUtcWeek(new Date());
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = days.map((day, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + index);
    const dateKey = date.toISOString().split('T')[0];
    const xp = pickerTransactions
      .filter(txn => dateOnly(txn.created_at) === dateKey)
      .reduce((sum, txn) => sum + Math.round(number(txn.weight || txn.quantity) * settings.xp_per_kg), 0);

    return { day, date: dateKey, xp };
  });

  return {
    values,
    totalXp: values.reduce((sum, row) => sum + row.xp, 0),
  };
}

function buildDepartmentRankings(leaderboard) {
  const zones = new Map();

  leaderboard.forEach(entry => {
    const zone = entry.zone || 'Unassigned';
    if (!zones.has(zone)) {
      zones.set(zone, {
        zone,
        xp: 0,
        pickerCount: 0,
        avgXp: 0,
      });
    }

    const row = zones.get(zone);
    row.xp += number(entry.xp);
    row.pickerCount += 1;
  });

  return [...zones.values()]
    .map(row => ({
      ...row,
      avgXp: row.pickerCount ? Math.round(row.xp / row.pickerCount) : 0,
    }))
    .sort((a, b) => b.xp - a.xp)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildCommunityStats(leaderboard) {
  const top = leaderboard[0] || null;
  const totalXp = leaderboard.reduce((sum, entry) => sum + number(entry.xp), 0);
  const averageXp = leaderboard.length ? Math.round(totalXp / leaderboard.length) : 0;

  return {
    top,
    averageXp,
    pickerCount: leaderboard.length,
  };
}

function buildLeaderboardViews(leaderboard) {
  return {
    overall: leaderboard,
    weekly: leaderboard
      .map(entry => ({ ...entry, xp: number(entry.weeklyXpTrend?.totalXp), rank: 0 }))
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({ ...entry, rank: index + 1 })),
    monthly: leaderboard
      .map(entry => ({
        ...entry,
        xp: number(entry.challenges?.find(challenge => challenge.id === 'monthly-legend')?.progress) * 15,
        rank: 0,
      }))
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({ ...entry, rank: index + 1 })),
    improved: leaderboard
      .map(entry => ({ ...entry, xp: number(entry.bonusXp) + number(entry.weeklyXpTrend?.totalXp), rank: 0 }))
      .sort((a, b) => b.xp - a.xp)
      .map((entry, index) => ({ ...entry, rank: index + 1 })),
  };
}

router.get('/', authRequired, async (req, res) => {
  try {
    const data = await buildRewards();
    res.json({
      ...data,
      canAdminRewards: ['admin', 'superadmin'].includes(normalizeRole(req.user?.role)),
    });
  } catch (err) {
    console.error('[rewards.load]', err.message);
    res.status(500).json({ error: 'Could not load rewards from the database.' });
  }
});

router.get('/:picker_id', authRequired, async (req, res) => {
  try {
    const data = await buildRewards();
    const rewards = data.leaderboard.find(row => row.picker_id === req.params.picker_id);
    if (!rewards) return res.status(404).json({ error: 'No rewards found for this picker.' });
    res.json({ rewards });
  } catch (err) {
    console.error('[rewards.detail]', err.message);
    res.status(500).json({ error: 'Could not load picker rewards.' });
  }
});

router.post('/add', authRequired, async (req, res) => {
  try {
    const { picker_id, xp, reason } = req.body;
    if (!picker_id || xp === undefined || xp === null || xp === '') {
      return res.status(400).json({ error: 'picker_id and xp are required.' });
    }
    if (number(xp) === 0) return res.status(400).json({ error: 'XP cannot be zero.' });

    await db.insert('reward_xp_events', {
      picker_id,
      xp: number(xp),
      reason: reason || 'Bonus XP',
      source: 'manual',
      created_by: req.user?.id || null,
    });

    const data = await buildRewards();
    res.json({
      message: `${number(xp).toLocaleString()} XP saved successfully.`,
      rewards: data.leaderboard.find(row => row.picker_id === picker_id),
    });
  } catch (err) {
    console.error('[rewards.add]', err.message);
    res.status(500).json({ error: err.message || 'Could not add XP.' });
  }
});

router.post('/daily-checkin', authRequired, async (req, res) => {
  try {
    const { picker_id } = req.body;
    if (!picker_id) return res.status(400).json({ error: 'picker_id is required.' });

    const today = new Date().toISOString().split('T')[0];
    const existing = await db.selectAll('reward_xp_events', { orderBy: 'created_at', ascending: false });
    const alreadyClaimed = existing.some(event =>
      event.picker_id === picker_id &&
      event.source === 'daily_checkin' &&
      dateOnly(event.created_at) === today
    );

    if (alreadyClaimed) {
      return res.status(400).json({ error: 'Daily check-in was already claimed today.' });
    }

    const settings = await getSettings();
    await db.insert('reward_xp_events', {
      picker_id,
      xp: settings.daily_checkin_xp,
      reason: 'Daily check-in',
      source: 'daily_checkin',
      created_by: req.user?.id || null,
    });

    res.json({ message: 'Daily check-in saved.', xp: settings.daily_checkin_xp });
  } catch (err) {
    console.error('[rewards.daily-checkin]', err.message);
    res.status(500).json({ error: err.message || 'Could not save daily check-in.' });
  }
});

router.post('/redeem', authRequired, async (req, res) => {
  try {
    const { picker_id, reward_item_id, reward_name, xp_cost } = req.body;
    if (!picker_id) return res.status(400).json({ error: 'picker_id is required.' });

    let reward = null;
    if (reward_item_id) reward = await db.selectOne('reward_store_items', { id: reward_item_id });
    if (!reward && reward_name) {
      const items = await db.selectAll('reward_store_items');
      reward = items.find(item => item.name.toLowerCase() === String(reward_name).toLowerCase());
    }
    if (!reward && (!reward_name || !xp_cost)) {
      return res.status(400).json({ error: 'Choose a reward first.' });
    }

    const data = await buildRewards();
    const entry = data.leaderboard.find(row => row.picker_id === picker_id);
    const cost = number(reward?.xp_cost || xp_cost);
    if (!entry || entry.xp < cost) {
      return res.status(400).json({ error: 'Not enough XP for this reward.' });
    }

    const redemption = await db.insert('reward_redemptions', {
      picker_id,
      reward_item_id: reward?.id || null,
      reward_name: reward?.name || reward_name,
      xp_cost: cost,
      status: 'pending',
    });

    res.json({ message: 'Reward redemption requested.', redemption });
  } catch (err) {
    console.error('[rewards.redeem]', err.message);
    res.status(500).json({ error: err.message || 'Could not redeem reward.' });
  }
});

router.put('/redemptions/:id/status', authRequired, async (req, res) => {
  try {
    const { status } = req.body;
    const normalizedStatus = String(status || '').toLowerCase();

    if (!['approved', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }

    const redemption = await db.selectOne('reward_redemptions', { id: req.params.id });
    if (!redemption) return res.status(404).json({ error: 'Redemption request not found.' });
    if (redemption.status !== 'pending') {
      return res.status(400).json({ error: 'This redemption has already been reviewed.' });
    }

    const updated = await db.update('reward_redemptions', { id: req.params.id }, {
      status: normalizedStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user?.id || null,
    });

    res.json({
      message: `Redemption ${normalizedStatus}.`,
      redemption: updated,
    });
  } catch (err) {
    console.error('[rewards.redemption.status]', err.message);
    res.status(500).json({ error: err.message || 'Could not update redemption.' });
  }
});

module.exports = router;

const router = require('express').Router();

const { authRequired, requireRole } = require('../middleware/auth');
const db = require('../lib/dataAccess');

function generatePickerId() {
  return 'EC-' + Date.now();
}

function toClientPicker(row) {
  return {
    id: row.id,
    first_name: row.name?.split(' ')[0] || '',
    last_name: row.name?.split(' ').slice(1).join(' ') || '',
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    id_number: row.id_number || '',
    branch: row.branch || '',
    zone: row.branch || '',
    status: row.status || 'active',
    total_kg: Number(row.total_kg || 0),
    total_paid: Number(row.total_paid || 0),
    kg: Number(row.total_kg || 0),
    earnings: Number(row.total_paid || 0),
    material: row.material || '',
    joined: row.created_at ? row.created_at.split('T')[0] : '',
    created_at: row.created_at,
  };
}

async function loadPickers() {
  const rows = await db.selectAll('pickers', { orderBy: 'created_at', ascending: false });
  return rows.map(toClientPicker);
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function branchLabel(branch) {
  return branch?.region || branch?.province || branch?.city || branch?.name || branch?.branch || 'Unassigned';
}

function buildBranchMaps(branches) {
  const byId = new Map();
  const byName = new Map();

  branches.forEach(branch => {
    if (branch.id) byId.set(String(branch.id), branch);
    const names = [
      branch.name,
      branch.branch,
      branch.region,
      branch.province,
      branch.city,
    ].filter(Boolean);

    names.forEach(name => byName.set(normalizeKey(name), branch));
  });

  return { byId, byName };
}

function resolveBranch(row, picker, maps) {
  if (row?.branch_id && maps.byId.has(String(row.branch_id))) return maps.byId.get(String(row.branch_id));
  if (picker?.branch_id && maps.byId.has(String(picker.branch_id))) return maps.byId.get(String(picker.branch_id));

  const possibleNames = [
    row?.branch,
    row?.zone,
    picker?.branch,
    picker?.zone,
  ];

  for (const name of possibleNames) {
    const key = normalizeKey(name);
    if (key && maps.byName.has(key)) return maps.byName.get(key);
  }

  return null;
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function weekStart(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isAfterDate(value, start) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start;
}

function transactionYear(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

function transactionMonth(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().getMonth() : date.getMonth();
}

const environmentalFactors = {
  plastic: { co2PerKg: 1.7, waterPerKg: 24 },
  paper: { co2PerKg: 0.9, waterPerKg: 18 },
  cardboard: { co2PerKg: 0.9, waterPerKg: 18 },
  metal: { co2PerKg: 4.0, waterPerKg: 12 },
  aluminium: { co2PerKg: 8.1, waterPerKg: 14 },
  aluminum: { co2PerKg: 8.1, waterPerKg: 14 },
  glass: { co2PerKg: 0.3, waterPerKg: 4 },
  mixed: { co2PerKg: 1.1, waterPerKg: 10 },
  default: { co2PerKg: 1.2, waterPerKg: 12 },
};

function factorForMaterial(materialName) {
  const name = normalizeKey(materialName);
  const key = Object.keys(environmentalFactors).find(item => name.includes(item));
  return environmentalFactors[key] || environmentalFactors.default;
}

function branchMonthlyTarget(branch) {
  return Number(
    branch?.monthly_target_kg ||
    branch?.monthly_recycling_target ||
    branch?.recycling_target_kg ||
    branch?.target_kg ||
    0
  );
}

router.get('/pickers', authRequired, async (req, res) => {
  try {
    const pickers = await loadPickers();
    res.json({ pickers });
  } catch (err) {
    console.error('[admin.pickers.list]', err.message);
    res.status(500).json({ error: 'Could not load pickers.' });
  }
});

router.post('/pickers', authRequired, requireRole('admin', 'superadmin', 'employee', 'user'), async (req, res) => {
  const {
    first_name,
    last_name,
    name,
    phone,
    zone,
    branch,
    id_number,
    email,
  } = req.body;

  const pickerName = name || `${first_name || ''} ${last_name || ''}`.trim();

  if (!pickerName || !phone || !(zone || branch)) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  try {
    const existingRows = await db.selectAll('pickers');
    const normalizedPhone = String(phone || '').replace(/\s+/g, '');
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Please enter the picker phone number.' });
    }

    const existing = existingRows.find(p => String(p.phone || '').replace(/\s+/g, '') === normalizedPhone);

    if (existing) {
      return res.status(400).json({ error: 'A picker with this phone number already exists.' });
    }

    const picker = await db.insert('pickers', {
      id: generatePickerId(),
      name: pickerName,
      phone: normalizedPhone,
      email: email || null,
      id_number: id_number || null,
      branch: branch || zone,
      status: 'active',
    });

    res.status(201).json({
      message: `${picker.name} registered successfully!`,
      picker: toClientPicker(picker),
    });
  } catch (err) {
    console.error('[admin.pickers.create]', err.message);
    res.status(500).json({ error: 'Could not register picker.' });
  }
});

router.delete('/pickers/:id', authRequired, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const picker = await db.selectOne('pickers', { id: req.params.id });

    if (!picker) {
      return res.status(404).json({ error: 'Picker not found.' });
    }

    await db.remove('pickers', { id: req.params.id });

    res.json({
      message: `${picker.name} has been removed successfully.`,
      picker: toClientPicker(picker),
    });
  } catch (err) {
    console.error('[admin.pickers.delete]', err.message);
    res.status(500).json({ error: 'Could not remove picker.' });
  }
});

router.get('/stats', authRequired, requireRole('admin', 'superadmin', 'employee', 'user'), async (req, res) => {
  try {
    const pickers = await loadPickers();
    const transactions = await db.selectAll('transactions');

    const totalPickers = pickers.length;
    const activePickers = pickers.filter(p => p.status === 'active').length;
    const totalKg = transactions.reduce((sum, t) => sum + Number(t.weight || 0), 0);
    const totalEarnings = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalTransactions = transactions.length;

    res.json({
      totalPickers,
      activePickers,
      totalKg,
      totalEarnings,
      totalTransactions,
    });
  } catch (err) {
    console.error('[admin.stats]', err.message);
    res.status(500).json({ error: 'Could not load dashboard stats.' });
  }
});

router.get('/super-stats', authRequired, requireRole('superadmin'), async (req, res) => {
  try {
    const [pickersRaw, transactions, branches] = await Promise.all([
      db.selectAll('pickers'),
      db.selectAll('transactions'),
      db.selectAll('branches'),
    ]);

    const pickers = pickersRaw.map(toClientPicker);
    const pickerById = new Map(pickersRaw.map(picker => [picker.id, picker]));
    const branchMaps = buildBranchMaps(branches);
    const activeBranches = branches.filter(branch => String(branch.status || 'active').toLowerCase() !== 'inactive');
    const thisMonth = monthStart();
    const thisWeek = weekStart();

    const totals = {
      totalTransactions: transactions.length,
      transactionsThisMonth: transactions.filter(t => isAfterDate(t.created_at, thisMonth)).length,
      transactionsThisWeek: transactions.filter(t => isAfterDate(t.created_at, thisWeek)).length,
      totalKg: transactions.reduce((sum, t) => sum + Number(t.weight || 0), 0),
      totalPayouts: transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
      totalPickers: pickers.length,
      activePickers: pickers.filter(p => String(p.status || 'active').toLowerCase() === 'active').length,
      totalBranches: branches.length,
      activeBranches: activeBranches.length || branches.length,
    };

    const branchGroups = new Map();
    transactions.forEach(transaction => {
      const picker = pickerById.get(transaction.picker_id);
      const branch = resolveBranch(transaction, picker, branchMaps);
      const label = branchLabel(branch) || transaction.branch || picker?.branch || 'Unassigned';
      const key = normalizeKey(label) || 'unassigned';

      if (!branchGroups.has(key)) {
        branchGroups.set(key, {
          name: label,
          kg: 0,
          total: 0,
          count: 0,
          pickerIds: new Set(),
          centreIds: new Set(),
        });
      }

      const group = branchGroups.get(key);
      group.kg += Number(transaction.weight || 0);
      group.total += Number(transaction.amount || 0);
      group.count += 1;
      if (transaction.picker_id) group.pickerIds.add(transaction.picker_id);
      if (branch?.id) group.centreIds.add(branch.id);
    });

    pickersRaw.forEach(picker => {
      const branch = resolveBranch(null, picker, branchMaps);
      const label = branchLabel(branch) || picker.branch || 'Unassigned';
      const key = normalizeKey(label) || 'unassigned';
      if (!branchGroups.has(key)) {
        branchGroups.set(key, {
          name: label,
          kg: 0,
          total: 0,
          count: 0,
          pickerIds: new Set(),
          centreIds: new Set(),
        });
      }
      const group = branchGroups.get(key);
      if (picker.id) group.pickerIds.add(picker.id);
      if (branch?.id) group.centreIds.add(branch.id);
    });

    const regionalPerformance = Array.from(branchGroups.values())
      .map(group => ({
        name: group.name,
        kg: Math.round(group.kg * 100) / 100,
        total: Math.round(group.total * 100) / 100,
        transactions: group.count,
        pickers: group.pickerIds.size,
        centres: group.centreIds.size,
      }))
      .sort((a, b) => b.kg - a.kg || b.transactions - a.transactions)
      .slice(0, 4);

    const transactionSuccessRate = totals.totalTransactions > 0
      ? Math.round((transactions.filter(t => String(t.status || 'completed').toLowerCase() !== 'failed').length / totals.totalTransactions) * 1000) / 10
      : null;

    res.json({
      totals,
      systemHealth: {
        platformUptime: 'Online',
        transactionSuccessRate,
        responseTime: 'Live',
      },
      regionalPerformance,
    });
  } catch (err) {
    console.error('[admin.super-stats]', err.message);
    res.status(500).json({ error: 'Could not load super admin dashboard stats.' });
  }
});

router.get('/super-environmental', authRequired, requireRole('superadmin'), async (req, res) => {
  try {
    const [pickersRaw, transactions, branches] = await Promise.all([
      db.selectAll('pickers'),
      db.selectAll('transactions'),
      db.selectAll('branches'),
    ]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;
    const thisMonth = monthStart(now);
    const pickerById = new Map(pickersRaw.map(picker => [picker.id, picker]));
    const branchMaps = buildBranchMaps(branches);

    const monthlyThisYear = Array(12).fill(0);
    const monthlyLastYear = Array(12).fill(0);
    const materialTotals = {};
    let totalKg = 0;
    let monthKg = 0;
    let co2Kg = 0;
    let waterLitres = 0;

    const branchGroups = new Map();

    transactions.forEach(transaction => {
      const kg = Number(transaction.weight || 0);
      const material = transaction.material || 'Mixed / General';
      const factor = factorForMaterial(material);
      const picker = pickerById.get(transaction.picker_id);
      const branch = resolveBranch(transaction, picker, branchMaps);
      const label = branchLabel(branch) || transaction.branch || picker?.branch || 'Unassigned';
      const key = normalizeKey(label) || 'unassigned';

      totalKg += kg;
      co2Kg += kg * factor.co2PerKg;
      waterLitres += kg * factor.waterPerKg;
      if (isAfterDate(transaction.created_at, thisMonth)) monthKg += kg;

      if (transactionYear(transaction.created_at) === currentYear) {
        monthlyThisYear[transactionMonth(transaction.created_at)] += kg;
      }
      if (transactionYear(transaction.created_at) === previousYear) {
        monthlyLastYear[transactionMonth(transaction.created_at)] += kg;
      }

      if (!materialTotals[material]) materialTotals[material] = { kg: 0, count: 0 };
      materialTotals[material].kg += kg;
      materialTotals[material].count += 1;

      if (!branchGroups.has(key)) {
        branchGroups.set(key, {
          name: label,
          kg: 0,
          transactions: 0,
          pickerIds: new Set(),
          targetKg: branchMonthlyTarget(branch),
        });
      }

      const group = branchGroups.get(key);
      group.kg += kg;
      group.transactions += 1;
      if (transaction.picker_id) group.pickerIds.add(transaction.picker_id);
    });

    pickersRaw.forEach(picker => {
      const branch = resolveBranch(null, picker, branchMaps);
      const label = branchLabel(branch) || picker.branch || 'Unassigned';
      const key = normalizeKey(label) || 'unassigned';
      if (!branchGroups.has(key)) {
        branchGroups.set(key, {
          name: label,
          kg: 0,
          transactions: 0,
          pickerIds: new Set(),
          targetKg: branchMonthlyTarget(branch),
        });
      }
      if (picker.id) branchGroups.get(key).pickerIds.add(picker.id);
    });

    const maxRegionKg = Math.max(...Array.from(branchGroups.values()).map(group => group.kg), 1);
    const regionalPerformance = Array.from(branchGroups.values())
      .map(group => {
        const target = group.targetKg || maxRegionKg;
        const percentOfGoal = target ? Math.min(100, Math.round((group.kg / target) * 100)) : 0;
        return {
          name: group.name,
          kg: Math.round(group.kg * 100) / 100,
          transactions: group.transactions,
          pickers: group.pickerIds.size,
          targetKg: target,
          percentOfGoal,
        };
      })
      .sort((a, b) => b.kg - a.kg || b.transactions - a.transactions)
      .slice(0, 4);

    const sortingRate = transactions.length
      ? Math.round((transactions.filter(t => t.material_id || t.material).length / transactions.length) * 100)
      : 0;

    res.json({
      totals: {
        totalKg: Math.round(totalKg * 100) / 100,
        monthKg: Math.round(monthKg * 100) / 100,
        co2Kg: Math.round(co2Kg * 100) / 100,
        waterLitres: Math.round(waterLitres),
        activePickers: pickersRaw.filter(p => String(p.status || 'active').toLowerCase() === 'active').length,
        regionsReporting: branchGroups.size,
        sortingRate,
        transactions: transactions.length,
      },
      monthly: {
        currentYear,
        previousYear,
        thisYear: monthlyThisYear.map(value => Math.round(value * 100) / 100),
        lastYear: monthlyLastYear.map(value => Math.round(value * 100) / 100),
      },
      materialTotals,
      regionalPerformance,
    });
  } catch (err) {
    console.error('[admin.super-environmental]', err.message);
    res.status(500).json({ error: 'Could not load super admin environmental dashboard.' });
  }
});

module.exports = router;

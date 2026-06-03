const express = require('express');
const router = express.Router();

const { authRequired } = require('../middleware/auth');
const { sendTransactionSMS } = require('../services/sms');
const db = require('../lib/dataAccess');

const materialChoices = {
  1: { name: 'Plastic (PET)', pricePerKg: 12 },
  2: { name: 'Plastic (HDPE)', pricePerKg: 10 },
  3: { name: 'Paper / Cardboard', pricePerKg: 8 },
  4: { name: 'Metal (Aluminium)', pricePerKg: 25 },
  5: { name: 'Glass', pricePerKg: 6 },
  6: { name: 'Mixed / General', pricePerKg: 5 },
};

function generateTxnId() {
  return 'TX-' + Date.now();
}

async function pickerMap() {
  const pickers = await db.selectAll('pickers');
  return new Map(pickers.map(picker => [picker.id, picker]));
}

async function resolveBranchId(picker, zone) {
  if (picker?.branch_id) return picker.branch_id;

  const branches = await db.selectAll('branches');
  if (!branches.length) return null;

  const branchName = (picker?.branch || zone || '').toLowerCase();
  const matched = branches.find(branch =>
    String(branch.id || '').toLowerCase() === branchName ||
    String(branch.name || '').toLowerCase() === branchName ||
    branchName.includes(String(branch.name || '').toLowerCase()) ||
    String(branch.name || '').toLowerCase().includes(branchName)
  );

  return (matched || branches[0]).id;
}

async function resolveMaterial(material_id, materialName) {
  const fallback = materialChoices[Number(material_id)];
  const wantedName = (materialName || fallback?.name || '').toLowerCase();
  const materials = await db.selectAll('materials');

  const matched = materials.find(material => {
    const id = String(material.id || '').toLowerCase();
    const name = String(material.name || material.material || '').toLowerCase();
    return id === String(material_id || '').toLowerCase() || name === wantedName;
  });

  if (!matched) return null;

  return {
    id: matched.id,
    name: matched.name || matched.material || fallback?.name || materialName,
    pricePerKg: Number(matched.price_per_kg || matched.pricePerKg || fallback?.pricePerKg || 0),
  };
}

function toClientTransaction(row, picker) {
  return {
    id: row.id,
    picker_id: row.picker_id,
    picker_name: picker?.name || row.picker_id || 'Unknown picker',
    material: row.material,
    pricePerKg: Number(row.price_per_kg || 0),
    quantity: Number(row.weight || 0),
    total: Number(row.amount || 0),
    zone: picker?.zone || row.branch || '',
    branch: row.branch || picker?.branch || '',
    notes: row.notes || '',
    status: row.status || 'completed',
    recorded_by: row.recorded_by || 'Employee',
    created_at: row.created_at,
  };
}

router.get('/', authRequired, async (req, res) => {
  try {
    const [transactions, pickers] = await Promise.all([
      db.selectAll('transactions', { orderBy: 'created_at', ascending: false }),
      pickerMap(),
    ]);

    const rows = transactions.map(txn => toClientTransaction(txn, pickers.get(txn.picker_id)));

    res.json({
      transactions: rows,
      total: rows.length,
    });
  } catch (err) {
    console.error('[transactions.list]', err.message);
    res.status(500).json({ error: 'Could not load transactions.' });
  }
});

router.post('/', authRequired, async (req, res) => {
  const {
    picker_id,
    picker_name,
    material_id,
    material,
    quantity,
    zone,
    notes,
  } = req.body;

  if (!picker_id || !material_id || !quantity) {
    return res.status(400).json({
      error: 'Please fill in all required fields - picker, material and quantity are required.',
    });
  }

  if (isNaN(quantity) || Number(quantity) <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number.' });
  }

  const materialInfo = await resolveMaterial(material_id, material);
  if (!materialInfo) {
    return res.status(400).json({
      error: 'Selected material was not found in the database. Check the materials table before recording a transaction.',
    });
  }

  if (!materialInfo.pricePerKg) {
    return res.status(400).json({
      error: 'Selected material does not have a valid price in the database.',
    });
  }

  const pricePerKg = materialInfo.pricePerKg;
  const materialName = materialInfo.name;
  const total = Math.round(Number(quantity) * pricePerKg * 100) / 100;

  try {
    const picker = await db.selectOne('pickers', { id: picker_id });
    if (!picker) {
      return res.status(400).json({
        error: 'Selected picker was not found in the database. Register the picker again, then record the transaction.',
      });
    }

    const branchId = await resolveBranchId(picker, zone);
    if (!branchId) {
      return res.status(400).json({
        error: 'No branch exists in the database. Create a branch first, then record the transaction.',
      });
    }

    const row = await db.insert('transactions', {
      id: generateTxnId(),
      picker_id,
      branch_id: branchId,
      material_id: materialInfo.id,
      material: materialName,
      weight: Number(quantity),
      price_per_kg: pricePerKg,
      amount: total,
      status: 'completed',
      notes: notes || '',
    });

    const transaction = toClientTransaction(row, picker || { name: picker_name, zone });

    sendTransactionSMS(
      transaction.picker_name,
      req.body.picker_phone || picker?.phone || '',
      transaction.material,
      transaction.quantity,
      transaction.total
    ).catch(err => console.error('SMS notification failed:', err.message));

    res.status(201).json({
      message: `Transaction recorded successfully! Total payout: R${total}`,
      transaction,
    });
  } catch (err) {
    console.error('[transactions.create]', err.message);
    res.status(500).json({ error: err.message || 'Could not record transaction.' });
  }
});

router.get('/picker/:id', authRequired, async (req, res) => {
  try {
    const pickers = await pickerMap();
    const allTransactions = await db.selectAll('transactions', { orderBy: 'created_at', ascending: false });
    const transactions = allTransactions
      .filter(t => t.picker_id === req.params.id)
      .map(t => toClientTransaction(t, pickers.get(t.picker_id)));

    const totalKg = transactions.reduce((sum, t) => sum + t.quantity, 0);
    const totalEarnings = transactions.reduce((sum, t) => sum + t.total, 0);

    res.json({
      picker_id: req.params.id,
      transactions,
      summary: {
        totalTransactions: transactions.length,
        totalKg,
        totalEarnings,
      },
    });
  } catch (err) {
    console.error('[transactions.picker]', err.message);
    res.status(500).json({ error: 'Could not load picker transactions.' });
  }
});

router.get('/summary', authRequired, async (req, res) => {
  try {
    const transactions = await db.selectAll('transactions');

    const totalTransactions = transactions.length;
    const totalKg = transactions.reduce((sum, t) => sum + Number(t.weight || 0), 0);
    const totalPayouts = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const byMaterial = {};
    transactions.forEach(t => {
      if (!byMaterial[t.material]) {
        byMaterial[t.material] = { kg: 0, total: 0, count: 0 };
      }
      byMaterial[t.material].kg += Number(t.weight || 0);
      byMaterial[t.material].total += Number(t.amount || 0);
      byMaterial[t.material].count += 1;
    });

    res.json({
      totalTransactions,
      totalKg,
      totalPayouts,
      byMaterial,
    });
  } catch (err) {
    console.error('[transactions.summary]', err.message);
    res.status(500).json({ error: 'Could not load transaction summary.' });
  }
});

module.exports = router;
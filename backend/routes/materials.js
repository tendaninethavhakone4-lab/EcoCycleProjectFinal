const express = require('express');
const router = express.Router();

const { authRequired, requireRole } = require('../middleware/auth');
const db = require('../lib/dataAccess');

function normalizeMaterial(row) {
  return {
    id: row.id,
    name: row.name || row.material || 'Material',
    material: row.material || row.name || 'Material',
    pricePerKg: Number(row.price_per_kg || row.pricePerKg || row.rate || 0),
    price_per_kg: Number(row.price_per_kg || row.pricePerKg || row.rate || 0),
    unit: row.unit || 'kg',
    active: row.active !== false && row.is_active !== false,
    category: row.category || null,
    updated_at: row.updated_at || row.created_at || null,
  };
}

async function loadMaterials() {
  const rows = await db.selectAll('materials');
  return rows
    .map(normalizeMaterial)
    .sort((a, b) => a.name.localeCompare(b.name));
}

router.get('/', authRequired, async (req, res) => {
  try {
    const materials = await loadMaterials();
    res.json({ materials });
  } catch (err) {
    console.error('[materials.list]', err.message);
    res.status(500).json({ error: 'Could not load materials from the database.' });
  }
});

router.get('/:id/history', authRequired, async (req, res) => {
  try {
    const material = await db.selectOne('materials', { id: req.params.id });
    if (!material) return res.status(404).json({ error: 'Material not found.' });

    const name = material.name || material.material || req.params.id;
    const { data, error } = await db.supabase
      .from('price_history')
      .select('*')
      .eq('material', name)
      .order('changed_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[materials.history]', error.message);
      return res.json({ history: [] });
    }

    res.json({ history: data || [] });
  } catch (err) {
    console.error('[materials.history]', err.message);
    res.status(500).json({ error: 'Could not load price history.' });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const material = await db.selectOne('materials', { id: req.params.id });

    if (!material) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    res.json({ material: normalizeMaterial(material) });
  } catch (err) {
    console.error('[materials.detail]', err.message);
    res.status(500).json({ error: 'Could not load material.' });
  }
});

router.put('/:id', authRequired, requireRole('admin', 'superadmin'), async (req, res) => {
  const { name, material, pricePerKg, price_per_kg, active, is_active, unit, category } = req.body;

  const price = price_per_kg !== undefined ? price_per_kg : pricePerKg;
  if (price !== undefined && (Number.isNaN(Number(price)) || Number(price) < 0)) {
    return res.status(400).json({ error: 'Price must be a positive number.' });
  }

  try {
    const existing = await db.selectOne('materials', { id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Material not found.' });

    const patch = {};
    if (name !== undefined) patch.name = String(name).trim();
    if (material !== undefined) patch.material = String(material).trim();
    if (price !== undefined) patch.price_per_kg = Number(price);
    if (unit !== undefined) patch.unit = unit || 'kg';
    if (category !== undefined) patch.category = category || null;
    if (active !== undefined) patch.is_active = Boolean(active);
    if (is_active !== undefined) patch.is_active = Boolean(is_active);
    patch.updated_at = new Date().toISOString();

    const oldPrice = Number(existing.price_per_kg || existing.pricePerKg || existing.rate || 0);
    const updated = await db.update('materials', { id: req.params.id }, patch);
    const updatedName = updated.name || updated.material || existing.name || existing.material || 'Material';

    if (price !== undefined && oldPrice !== Number(price)) {
      const { error } = await db.supabase.from('price_history').insert({
        material: updatedName,
        old_price: oldPrice,
        new_price: Number(price),
        changed_by: req.user?.email || req.user?.name || 'Admin',
      });
      if (error) console.error('[materials.history.insert]', error.message);
    }

    res.json({
      message: `${updatedName} updated successfully.`,
      material: normalizeMaterial(updated),
    });
  } catch (err) {
    console.error('[materials.update]', err.message);
    res.status(500).json({ error: err.message || 'Could not update material.' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();

const { authRequired } = require('../middleware/auth');
const db = require('../lib/dataAccess');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const FALLBACK_COORDS = {
  soweto: { lat: -26.2678, lng: 27.8585 },
  johannesburg: { lat: -26.2041, lng: 28.0473 },
  alexandra: { lat: -26.1047, lng: 28.0980 },
  germiston: { lat: -26.2294, lng: 28.1743 },
  tembisa: { lat: -25.9963, lng: 28.2268 },
  diepsloot: { lat: -25.9336, lng: 28.0127 },
  'orange farm': { lat: -26.4833, lng: 27.8667 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
  durban: { lat: -29.8587, lng: 31.0218 },
  pretoria: { lat: -25.7479, lng: 28.2293 },
};

let geocodeCache = new Map();

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function cleanName(value, fallback = 'Unknown') {
  return String(value || '').trim() || fallback;
}

function geocodeName(value) {
  return cleanName(value, 'Johannesburg')
    .replace(/\bzone\s*[a-z0-9-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackFor(placeName) {
  const text = String(placeName || '').toLowerCase();
  const key = Object.keys(FALLBACK_COORDS).find(name => text.includes(name));
  return key ? FALLBACK_COORDS[key] : FALLBACK_COORDS.johannesburg;
}

async function geocodePlace(placeName) {
  const name = cleanName(placeName, 'Johannesburg, South Africa');
  if (geocodeCache.has(name)) return geocodeCache.get(name);

  if (!GOOGLE_MAPS_API_KEY) {
    const fallback = fallbackFor(name);
    geocodeCache.set(name, fallback);
    return fallback;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', name);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url);
    const data = await response.json();
    const location = data.results?.[0]?.geometry?.location;
    const coords = location || fallbackFor(name);
    geocodeCache.set(name, coords);
    return coords;
  } catch (err) {
    console.error('[locations.geocode]', err.message);
    const fallback = fallbackFor(name);
    geocodeCache.set(name, fallback);
    return fallback;
  }
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function findBranchForPicker(picker, branches) {
  const pickerBranch = String(picker.branch || '').toLowerCase();
  return branches.find(branch => {
    const branchName = String(branch.name || '').toLowerCase();
    const branchId = String(branch.id || '').toLowerCase();
    return pickerBranch === branchName
      || pickerBranch === branchId
      || (pickerBranch && branchName.includes(pickerBranch))
      || (branchName && pickerBranch.includes(branchName));
  });
}

function transactionBranchName(txn, picker, branches) {
  const branchById = branches.find(branch => String(branch.id) === String(txn.branch_id));
  return cleanName(txn.branch || branchById?.name || picker?.branch, 'Unassigned');
}

async function buildMapData() {
  const [branches, pickers, transactions] = await Promise.all([
    db.selectAll('branches'),
    db.selectAll('pickers'),
    db.selectAll('transactions', { orderBy: 'created_at', ascending: false }),
  ]);

  const pickerById = new Map(pickers.map(picker => [picker.id, picker]));
  const txByBranch = new Map();
  const todayTx = transactions.filter(txn => isToday(txn.created_at));

  transactions.forEach(txn => {
    const picker = pickerById.get(txn.picker_id);
    const name = transactionBranchName(txn, picker, branches);
    if (!txByBranch.has(name)) {
      txByBranch.set(name, { kg: 0, amount: 0, count: 0, todayKg: 0 });
    }
    const stats = txByBranch.get(name);
    stats.kg += num(txn.weight);
    stats.amount += num(txn.amount);
    stats.count += 1;
    if (isToday(txn.created_at)) stats.todayKg += num(txn.weight);
  });

  const regionNames = new Set([
    ...branches.map(branch => cleanName(branch.name, 'Unassigned')),
    ...pickers.map(picker => cleanName(picker.branch, 'Unassigned')),
  ]);

  const regions = await Promise.all([...regionNames].map(async name => {
    const branch = branches.find(row => String(row.name || '').toLowerCase() === name.toLowerCase());
    const branchPickers = pickers.filter(picker => cleanName(picker.branch, 'Unassigned').toLowerCase() === name.toLowerCase());
    const stats = txByBranch.get(name) || { kg: 0, amount: 0, count: 0, todayKg: 0 };

    const coords = branch?.lat && branch?.lng
      ? { lat: num(branch.lat), lng: num(branch.lng) }
      : await geocodePlace(`${geocodeName(name)}, ${branch?.city || branch?.country || 'South Africa'}`);

    const target = Math.max(stats.kg * 1.2, branchPickers.length * 250, 1000);
    const progress = target ? Math.round((stats.kg / target) * 100) : 0;
    const status = progress >= 80 ? 'good' : progress >= 40 ? 'warning' : 'alert';

    return {
      id: branch?.id || slug(name),
      name,
      city: branch?.city || '',
      country: branch?.country || 'South Africa',
      lat: coords.lat,
      lng: coords.lng,
      pickers: branchPickers.length,
      activePickers: branchPickers.filter(picker => picker.status === 'active').length,
      kg: Math.round(stats.kg * 100) / 100,
      todayKg: Math.round(stats.todayKg * 100) / 100,
      amount: Math.round(stats.amount * 100) / 100,
      transactions: stats.count,
      target: Math.round(target * 100) / 100,
      depots: 1,
      status,
      color: status === 'good' ? '#2E7D32' : status === 'warning' ? '#F59E0B' : '#E53935',
    };
  }));

  const pickerMarkers = await Promise.all(pickers
    .filter(picker => picker.status !== 'inactive')
    .slice(0, 200)
    .map(async picker => {
      const branch = findBranchForPicker(picker, branches);
      const branchCoords = branch?.lat && branch?.lng
        ? { lat: num(branch.lat), lng: num(branch.lng) }
        : await geocodePlace(`${geocodeName(picker.branch || 'Johannesburg')}, South Africa`);

      return {
        id: picker.id,
        name: picker.name,
        branch: picker.branch || branch?.name || 'Unassigned',
        status: picker.status || 'active',
        totalKg: num(picker.total_kg),
        totalPaid: num(picker.total_paid),
        lat: picker.lat ? num(picker.lat) : branchCoords.lat + (Math.random() - 0.5) * 0.025,
        lng: picker.lng ? num(picker.lng) : branchCoords.lng + (Math.random() - 0.5) * 0.025,
      };
    }));

  const depots = regions.map(region => ({
    id: region.id,
    name: `${region.name} Depot`,
    lat: region.lat,
    lng: region.lng,
    status: region.status,
    todayKg: region.todayKg,
    totalKg: region.kg,
    activePickers: region.activePickers,
  }));

  return {
    regions: regions.sort((a, b) => b.kg - a.kg),
    depots,
    pickers: pickerMarkers,
    summary: {
      activePickers: pickers.filter(picker => picker.status === 'active').length,
      totalPickers: pickers.length,
      totalKg: transactions.reduce((sum, txn) => sum + num(txn.weight), 0),
      todayKg: todayTx.reduce((sum, txn) => sum + num(txn.weight), 0),
      activeDepots: branches.filter(branch => (branch.status || 'active') === 'active').length || depots.length,
      criticalAlerts: regions.filter(region => region.status === 'alert').length,
      totalTransactions: transactions.length,
    },
    source: GOOGLE_MAPS_API_KEY ? 'Supabase + Google Maps Geocoding' : 'Supabase + fallback coordinates',
    mapProvider: GOOGLE_MAPS_API_KEY ? 'google' : 'openstreetmap',
  };
}

router.get('/', authRequired, async (req, res) => {
  try {
    res.json(await buildMapData());
  } catch (err) {
    console.error('[locations.list]', err.message);
    res.status(500).json({ error: 'Could not load map location data.' });
  }
});

router.get('/map-config', authRequired, (req, res) => {
  res.json({
    provider: GOOGLE_MAPS_API_KEY ? 'google' : 'openstreetmap',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
});

router.get('/region/:id', authRequired, async (req, res) => {
  try {
    const data = await buildMapData();
    const region = data.regions.find(row => String(row.id) === String(req.params.id));
    if (!region) return res.status(404).json({ error: 'Region not found.' });
    res.json({ region });
  } catch (err) {
    console.error('[locations.region]', err.message);
    res.status(500).json({ error: 'Could not load region data.' });
  }
});

router.get('/depots', authRequired, async (req, res) => {
  try {
    const data = await buildMapData();
    res.json({ depots: data.depots });
  } catch (err) {
    console.error('[locations.depots]', err.message);
    res.status(500).json({ error: 'Could not load depot data.' });
  }
});

module.exports = router;

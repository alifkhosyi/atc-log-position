-- ============================================================
-- bulk_seed_personnel_unit.sql
-- ──────────────────────────────────────────────────────────
-- Auto-seed personnel.unit untuk SEMUA cabang berdasarkan
-- n_personnel per unit di airport-configs.json.
--
-- Strategi per cabang:
--   1. Order personnel by name (alfabetis)
--   2. First N_TWR personnel → unit = 'TWR'
--   3. Next N_APP personnel → unit = 'APP' (kalau ada)
--   4. Sisanya → unit = unit terakhir (overflow ke APP/ACC)
--
-- Idempotent: HANYA update personnel yang unit IS NULL.
-- Re-run aman, tapi tidak akan re-balance kalau sudah ada nilai.
--
-- Setelah dijalankan: engine roster akan apply baseline untuk
-- cabang yang count match. Cabang dengan personnel actual ≠
-- JSON n_personnel akan dapat warning di app, BUKAN silent
-- fallback ke greedy (Fix B di handoff).
-- ============================================================

BEGIN;

-- ───── WITT · Aceh ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WITT' AND is_active = true AND unit IS NULL;

-- ───── WAPP · Ambon ─────
UPDATE personnel SET unit = 'TWR'  -- first 9 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAPP' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 9
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAPP' AND is_active = true AND unit IS NULL;

-- ───── WICC · Bandung ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WICC' AND is_active = true AND unit IS NULL;

-- ───── WAOO · Banjarmasin ─────
UPDATE personnel SET unit = 'TWR'  -- first 9 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAOO' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 9
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAOO' AND is_active = true AND unit IS NULL;

-- ───── WADY · Banyuwangi ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WADY' AND is_active = true AND unit IS NULL;

-- ───── WIDD · Batam ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIDD' AND is_active = true AND unit IS NULL;

-- ───── WIGG · Bengkulu ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIGG' AND is_active = true AND unit IS NULL;

-- ───── WAQT · Berau ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAQT' AND is_active = true AND unit IS NULL;

-- ───── WABB · Biak ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WABB' AND is_active = true AND unit IS NULL;

-- ───── WADB · Bima ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WADB' AND is_active = true AND unit IS NULL;

-- ───── WALL · Balikpapan ─────
UPDATE personnel SET unit = 'TWR'  -- first 12 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WALL' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 12
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WALL' AND is_active = true AND unit IS NULL;

-- ───── WAHL · Cilacap ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAHL' AND is_active = true AND unit IS NULL;

-- ───── WADD · Denpasar ─────
UPDATE personnel SET unit = 'APP'  -- first 40 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WADD' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 40
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WADD' AND is_active = true AND unit IS NULL;

-- ───── WATE · Ende ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WATE' AND is_active = true AND unit IS NULL;

-- ───── WIMB · Gunung Sitoli ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIMB' AND is_active = true AND unit IS NULL;

-- ───── WAMG · Gorontalo ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAMG' AND is_active = true AND unit IS NULL;

-- ───── WIHH · Halim ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIHH' AND is_active = true AND unit IS NULL;

-- ───── WIJJ · Jambi ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIJJ' AND is_active = true AND unit IS NULL;

-- ───── WIII · Jatsc ACC ─────
UPDATE personnel SET unit = 'ACC'
  WHERE branch_code = 'WIII' AND is_active = true AND unit IS NULL;

-- ───── WIII · Jatsc APP ─────
UPDATE personnel SET unit = 'APP'  -- first 100 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WIII' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 100
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WIII' AND is_active = true AND unit IS NULL;

-- ───── WAWW · Kendari ─────
UPDATE personnel SET unit = 'TWR'  -- first 9 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAWW' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 9
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAWW' AND is_active = true AND unit IS NULL;

-- ───── WICA · Kertajati ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WICA' AND is_active = true AND unit IS NULL;

-- ───── WIOK · Ketapang ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIOK' AND is_active = true AND unit IS NULL;

-- ───── WATT · Kupang ─────
UPDATE personnel SET unit = 'TWR'  -- first 10 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WATT' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 10
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WATT' AND is_active = true AND unit IS NULL;

-- ───── WATO · Labuan Bajo ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WATO' AND is_active = true AND unit IS NULL;

-- ───── WILL · Lampung ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WILL' AND is_active = true AND unit IS NULL;

-- ───── WADL · Lombok ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WADL' AND is_active = true AND unit IS NULL;

-- ───── WAFW · Luwuk ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAFW' AND is_active = true AND unit IS NULL;

-- ───── WAQM · Malinau ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAQM' AND is_active = true AND unit IS NULL;

-- ───── WAMM · Manado ─────
UPDATE personnel SET unit = 'TWR'  -- first 13 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAMM' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 13
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAMM' AND is_active = true AND unit IS NULL;

-- ───── WAUU · Manokwari ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAUU' AND is_active = true AND unit IS NULL;

-- ───── WIDM · Matak ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIDM' AND is_active = true AND unit IS NULL;

-- ───── WAAA · Matsc ─────
UPDATE personnel SET unit = 'ACC'  -- first 133 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAAA' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 133
  );
UPDATE personnel SET unit = 'APP'  -- first 30 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAAA' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 30
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAAA' AND is_active = true AND unit IS NULL;

-- ───── WATC · Maumere ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WATC' AND is_active = true AND unit IS NULL;

-- ───── WIMM · Medan ─────
UPDATE personnel SET unit = 'APP'  -- first 48 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WIMM' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 48
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WIMM' AND is_active = true AND unit IS NULL;

-- ───── WAKK · Merauke ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAKK' AND is_active = true AND unit IS NULL;

-- ───── WABI · Nabire ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WABI' AND is_active = true AND unit IS NULL;

-- ───── WAJO · Oksibil ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAJO' AND is_active = true AND unit IS NULL;

-- ───── WIKK · Pangkal Pinang ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIKK' AND is_active = true AND unit IS NULL;

-- ───── WIEE · Padang ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIEE' AND is_active = true AND unit IS NULL;

-- ───── WAGG · Palangkaraya ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAGG' AND is_active = true AND unit IS NULL;

-- ───── WAFF · Palu ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAFF' AND is_active = true AND unit IS NULL;

-- ───── WICN · Pangandaran ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WICN' AND is_active = true AND unit IS NULL;

-- ───── WAGI · Pangkalan Bun ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAGI' AND is_active = true AND unit IS NULL;

-- ───── WIBB · Pekanbaru ─────
UPDATE personnel SET unit = 'TWR'  -- first 12 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WIBB' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 12
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WIBB' AND is_active = true AND unit IS NULL;

-- ───── WIPP · Palembang ─────
UPDATE personnel SET unit = 'APP'  -- first 43 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WIPP' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 43
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WIPP' AND is_active = true AND unit IS NULL;

-- ───── WIOO · Pontianak ─────
UPDATE personnel SET unit = 'TWR'  -- first 12 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WIOO' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 12
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WIOO' AND is_active = true AND unit IS NULL;

-- ───── WIBJ · Rengat ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIBJ' AND is_active = true AND unit IS NULL;

-- ───── WALS · Samarinda ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WALS' AND is_active = true AND unit IS NULL;

-- ───── WAGS · Sampit ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAGS' AND is_active = true AND unit IS NULL;

-- ───── WARR · Surabaya ─────
UPDATE personnel SET unit = 'APP'  -- first 40 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WARR' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 40
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WARR' AND is_active = true AND unit IS NULL;

-- ───── WAHS · Semarang ─────
UPDATE personnel SET unit = 'TWR'  -- first 9 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAHS' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 9
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAHS' AND is_active = true AND unit IS NULL;

-- ───── WAJJ · Sentani ─────
UPDATE personnel SET unit = 'APP'  -- first 36 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAJJ' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 36
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAJJ' AND is_active = true AND unit IS NULL;

-- ───── WAHQ · Solo ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAHQ' AND is_active = true AND unit IS NULL;

-- ───── WASS · Sorong ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WASS' AND is_active = true AND unit IS NULL;

-- ───── WADS · Sumbawa ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WADS' AND is_active = true AND unit IS NULL;

-- ───── WART · Sumenep ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WART' AND is_active = true AND unit IS NULL;

-- ───── WIDN · Tanjung Pinang ─────
UPDATE personnel SET unit = 'APP'  -- first 36 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WIDN' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 36
  );
UPDATE personnel SET unit = 'TWR'  -- overflow ke unit terakhir
  WHERE branch_code = 'WIDN' AND is_active = true AND unit IS NULL;

-- ───── WADT · Tambolaka ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WADT' AND is_active = true AND unit IS NULL;

-- ───── WAKT · Tanah Merah ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAKT' AND is_active = true AND unit IS NULL;

-- ───── WIKT · Tanjung Pandan ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WIKT' AND is_active = true AND unit IS NULL;

-- ───── WAQQ · Tarakan ─────
UPDATE personnel SET unit = 'TWR'  -- first 8 by alfabet
  WHERE id IN (
    SELECT id FROM personnel
     WHERE branch_code = 'WAQQ' AND is_active = true AND unit IS NULL
     ORDER BY name LIMIT 8
  );
UPDATE personnel SET unit = 'APP'  -- overflow ke unit terakhir
  WHERE branch_code = 'WAQQ' AND is_active = true AND unit IS NULL;

-- ───── WAEE · Ternate ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAEE' AND is_active = true AND unit IS NULL;

-- ───── WAYY · Timika ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAYY' AND is_active = true AND unit IS NULL;

-- ───── WAPF · Tual ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAPF' AND is_active = true AND unit IS NULL;

-- ───── WADW · Waingapu ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WADW' AND is_active = true AND unit IS NULL;

-- ───── WAVV · Wamena ─────
UPDATE personnel SET unit = 'TWR'
  WHERE branch_code = 'WAVV' AND is_active = true AND unit IS NULL;


-- ============================================================
-- Verifikasi: lihat distribusi per cabang × unit
-- ============================================================

-- Setelah jalan, output query ini bandingkan dengan JSON n_personnel:
-- SELECT branch_code, unit, COUNT(*) FROM personnel
--   WHERE is_active = true
--   GROUP BY branch_code, unit
--   ORDER BY branch_code, unit;

COMMIT;

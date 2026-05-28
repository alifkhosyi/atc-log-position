#!/usr/bin/env python3
"""
scripts/update_rolling_10cabang.py

Bulk-update rolling config untuk 10 cabang single-unit 2-shift.

Latar belakang:
  E2E test 2-shift (outputs/E2E_TEST_REPORT_2SHIFT.md) identifikasi 11
  cabang FAIL ROLLING_NO_DAYS_MATCH karena baseline pattern produce
  2 personnel/shift, tapi rolling.n_personnel = 3 (default Oksibil yang
  salah untuk cabang ini). Excel sumber confirm CWP = 2.

  10 cabang di-fix di script ini. Tarakan defer (special case CWP=4 +
  16 personnel "1 SET CREW").

Update per cabang:
  - n_personnel: 3 → 2
  - positions: regenerate ke 2-personnel alternating pattern
    (Kontrol/Istirahat ↔ Istirahat/Kontrol), match existing n_slots

Preserve per cabang (cabang-specific operational config):
  - n_slots
  - slot_duration_min
  - slot_durations
  - shift_start_utc
  - shift_end_utc

Run:
  python3 scripts/update_rolling_10cabang.py
"""

import json
import os
import sys

CABANG_TO_FIX = [
    "Aceh", "Bandung", "Jambi", "Kertajati", "Labuan Bajo",
    "Lampung", "Pangkal Pinang", "Palangkaraya", "Palu", "Ternate",
]

# Path resolve dari project root
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
JSON_PATH = os.path.join(
    ROOT, "src", "lib", "airport-data", "data", "airport-configs.json"
)


def generate_2personnel_positions(n_slots):
    """Generate 2-personnel rolling pattern matching n_slots.

    Slot ganjil: [Kontrol, Istirahat]  (P1 Kontrol, P2 Istirahat)
    Slot genap:  [Istirahat, Kontrol]  (swap)

    Net result: setiap personel dapat porsi Kontrol == Istirahat
    (n_slots / 2 each). Tidak ada Asisten (2-personnel pattern).
    """
    return [
        ["Kontrol", "Istirahat"] if i % 2 == 0 else ["Istirahat", "Kontrol"]
        for i in range(n_slots)
    ]


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    targeted = set(CABANG_TO_FIX)
    found = set()
    updated = []
    warnings = []

    for ap in data:
        name = ap.get("airport_name")
        if name not in targeted:
            continue
        found.add(name)

        twr_unit = None
        for u in ap.get("units", []):
            if u.get("unit") == "TWR":
                twr_unit = u
                break

        if not twr_unit:
            warnings.append(f"{name}: no TWR unit, skipped")
            continue

        rolling = twr_unit.get("rolling")
        if not rolling:
            warnings.append(f"{name}: no rolling config, skipped")
            continue

        old_n = rolling.get("n_personnel")
        n_slots = rolling.get("n_slots", 4)
        old_positions_len = len(rolling.get("positions", []))

        # Preserve: n_slots, slot_duration_min, slot_durations,
        #          shift_start_utc, shift_end_utc
        # Update:   n_personnel, positions
        rolling["n_personnel"] = 2
        rolling["positions"] = generate_2personnel_positions(n_slots)

        updated.append({
            "name": name,
            "old_n_personnel": old_n,
            "new_n_personnel": 2,
            "n_slots": n_slots,
            "old_positions_len": old_positions_len,
            "new_positions_len": len(rolling["positions"]),
        })
        print(
            f"✓ {name} TWR: n_personnel {old_n} → 2, "
            f"positions × {n_slots} slots regenerated"
        )

    missing = targeted - found
    if missing:
        warnings.append(
            f"NOT FOUND in airport-configs: {sorted(missing)}"
        )

    if warnings:
        print()
        print("=== Warnings ===")
        for w in warnings:
            print(f"  ⚠ {w}")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print()
    print(f"Updated {len(updated)}/{len(CABANG_TO_FIX)} cabang.")
    print(f"File: {JSON_PATH}")

    if len(updated) != len(CABANG_TO_FIX):
        sys.exit(1)


if __name__ == "__main__":
    main()

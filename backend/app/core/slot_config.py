import os
import json
import re
from typing import Dict, Any

SLOT_CONFIG_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "slot_timings.json"))

DEFAULT_SLOT_CONFIG = {
    "slot1": {
        "header": "Slot 1 • 11:30 AM",
        "sub": "Entry: 11:30 AM – 1:30 PM IST",
        "btn": "Slot 1 (11:30 AM)",
        "startTime": "11:30 AM",
        "cutoffTime": "1:30 PM",
        "startMinutes": 690,
        "cutoffMinutes": 810
    },
    "slot2": {
        "header": "Slot 2 • 4:00 PM",
        "sub": "Entry: 4:00 – 4:30 PM IST",
        "btn": "Slot 2 (4:00 PM)",
        "startTime": "4:00 PM",
        "cutoffTime": "4:30 PM",
        "startMinutes": 960,
        "cutoffMinutes": 990
    },
    "slot3": {
        "header": "Slot 3 • 6:00 PM",
        "sub": "Entry: 6:00 – 7:30 PM IST",
        "btn": "Slot 3 (6:00 PM)",
        "startTime": "6:00 PM",
        "cutoffTime": "7:30 PM",
        "startMinutes": 1080,
        "cutoffMinutes": 1170
    }
}

_IN_MEMORY_CONFIG = None

def parse_time_to_minutes(t_str: str) -> int:
    t_clean = (t_str or "").strip().upper()
    is_pm = "PM" in t_clean
    is_am = "AM" in t_clean
    t_num = re.sub(r"[^\d:]", "", t_clean)
    parts = t_num.split(":")
    hours = int(parts[0]) if parts[0] else 0
    mins = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    if is_pm and hours < 12:
        hours += 12
    elif is_am and hours == 12:
        hours = 0
    return hours * 60 + mins

def get_slot_timings_config() -> Dict[str, Any]:
    global _IN_MEMORY_CONFIG
    if _IN_MEMORY_CONFIG is not None:
        return _IN_MEMORY_CONFIG

    if os.path.exists(SLOT_CONFIG_FILE):
        try:
            with open(SLOT_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "slot1" in data and "slot2" in data:
                    if "slot3" not in data:
                        data["slot3"] = dict(DEFAULT_SLOT_CONFIG["slot3"])
                    _IN_MEMORY_CONFIG = data
                    return _IN_MEMORY_CONFIG
        except Exception:
            pass

    _IN_MEMORY_CONFIG = dict(DEFAULT_SLOT_CONFIG)
    return _IN_MEMORY_CONFIG

def update_slot_timings_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    global _IN_MEMORY_CONFIG
    current = dict(get_slot_timings_config())

    for slot_key in ["slot1", "slot2", "slot3"]:
        if slot_key in payload and isinstance(payload[slot_key], dict):
            s_data = payload[slot_key]
            slot_curr = dict(current.get(slot_key, DEFAULT_SLOT_CONFIG[slot_key]))

            if "startTime" in s_data:
                slot_curr["startTime"] = str(s_data["startTime"]).strip()
                slot_curr["startMinutes"] = parse_time_to_minutes(slot_curr["startTime"])

            if "cutoffTime" in s_data:
                slot_curr["cutoffTime"] = str(s_data["cutoffTime"]).strip()
                slot_curr["cutoffMinutes"] = parse_time_to_minutes(slot_curr["cutoffTime"])

            # Always synchronize display labels with current startTime & cutoffTime
            slot_num = "1" if slot_key == "slot1" else ("2" if slot_key == "slot2" else "3")
            slot_curr["header"] = f"Slot {slot_num} • {slot_curr['startTime']}"
            slot_curr["sub"] = f"Entry: {slot_curr['startTime']} – {slot_curr['cutoffTime']} IST"
            slot_curr["btn"] = f"Slot {slot_num} ({slot_curr['startTime']})"

            current[slot_key] = slot_curr

    _IN_MEMORY_CONFIG = current
    try:
        with open(SLOT_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(_IN_MEMORY_CONFIG, f, indent=2)
    except Exception as e:
        print(f"[ERROR] Failed to save slot_timings.json: {e}")

    return _IN_MEMORY_CONFIG


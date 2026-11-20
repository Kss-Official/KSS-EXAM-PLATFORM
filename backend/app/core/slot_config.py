import os
import json
import re
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger("ExamSecure.SlotConfig")

SLOT_CONFIG_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "slot_timings.json"))
SLOT_SETTING_KEY = "exam_slot_timings"

DEFAULT_SLOT_CONFIG = {
    "slot1": {
        "header": "Slot 1 • 2:00 PM",
        "sub": "Entry: 2:00 PM – 2:30 PM IST",
        "btn": "Slot 1 (2:00 PM)",
        "startTime": "2:00 PM",
        "cutoffTime": "2:30 PM",
        "startMinutes": 840,
        "cutoffMinutes": 870
    },
    "slot2": {
        "header": "Slot 2 • 4:00 PM",
        "sub": "Entry: 4:00 PM – 4:30 PM IST",
        "btn": "Slot 2 (4:00 PM)",
        "startTime": "4:00 PM",
        "cutoffTime": "4:30 PM",
        "startMinutes": 960,
        "cutoffMinutes": 990
    },
    "slot3": {
        "header": "Slot 3 • 6:00 PM",
        "sub": "Entry: 6:00 PM – 6:30 PM IST",
        "btn": "Slot 3 (6:00 PM)",
        "startTime": "6:00 PM",
        "cutoffTime": "6:30 PM",
        "startMinutes": 1080,
        "cutoffMinutes": 1110
    }
}

_IN_MEMORY_CONFIG: Optional[Dict[str, Any]] = None

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

def _read_from_db(db: Optional[Session]) -> Optional[Dict[str, Any]]:
    """Try reading slot configuration directly from PostgreSQL system_settings table."""
    should_close = False
    active_db = db
    if active_db is None:
        try:
            from app.core.database import SessionLocal
            active_db = SessionLocal()
            should_close = True
        except Exception as e:
            logger.debug(f"Could not initialize SessionLocal for slot config: {e}")
            return None

    try:
        from app.models.setting import SystemSetting
        row = active_db.query(SystemSetting).filter(SystemSetting.key == SLOT_SETTING_KEY).first()
        if row and row.value:
            data = json.loads(row.value)
            if isinstance(data, dict) and "slot1" in data and "slot2" in data:
                if "slot3" not in data:
                    data["slot3"] = dict(DEFAULT_SLOT_CONFIG["slot3"])
                return data
    except Exception as e:
        logger.debug(f"Could not read slot timings from database table: {e}")
    finally:
        if should_close and active_db:
            try:
                active_db.close()
            except Exception:
                pass
    return None

def _write_to_db(db: Optional[Session], config_data: Dict[str, Any]) -> bool:
    """Save slot configuration to PostgreSQL system_settings table."""
    should_close = False
    active_db = db
    if active_db is None:
        try:
            from app.core.database import SessionLocal
            active_db = SessionLocal()
            should_close = True
        except Exception as e:
            logger.warning(f"Could not initialize SessionLocal to save slot config: {e}")
            return False

    try:
        from app.models.setting import SystemSetting
        row = active_db.query(SystemSetting).filter(SystemSetting.key == SLOT_SETTING_KEY).first()
        val_str = json.dumps(config_data)
        if not row:
            row = SystemSetting(key=SLOT_SETTING_KEY, value=val_str)
            active_db.add(row)
        else:
            row.value = val_str
        active_db.commit()
        return True
    except Exception as e:
        logger.warning(f"Could not persist slot timings to database: {e}")
        try:
            active_db.rollback()
        except Exception:
            pass
        return False
    finally:
        if should_close and active_db:
            try:
                active_db.close()
            except Exception:
                pass

def get_slot_timings_config(db: Optional[Session] = None) -> Dict[str, Any]:
    global _IN_MEMORY_CONFIG

    # 1. Primary Source of Truth: PostgreSQL database (system_settings table)
    db_data = _read_from_db(db)
    if db_data:
        _IN_MEMORY_CONFIG = db_data
        return _IN_MEMORY_CONFIG

    # 2. In-memory cache (if already loaded during process lifetime)
    if _IN_MEMORY_CONFIG is not None:
        return _IN_MEMORY_CONFIG

    # 3. Persistent JSON file on disk
    if os.path.exists(SLOT_CONFIG_FILE):
        try:
            with open(SLOT_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "slot1" in data and "slot2" in data:
                    if "slot3" not in data:
                        data["slot3"] = dict(DEFAULT_SLOT_CONFIG["slot3"])
                    _IN_MEMORY_CONFIG = data
                    # Best-effort sync to database so future reads hit DB directly
                    _write_to_db(db, _IN_MEMORY_CONFIG)
                    return _IN_MEMORY_CONFIG
        except Exception as e:
            logger.debug(f"Could not read slot_timings.json: {e}")

    # 4. Standard default fallback
    _IN_MEMORY_CONFIG = dict(DEFAULT_SLOT_CONFIG)
    _write_to_db(db, _IN_MEMORY_CONFIG)
    return _IN_MEMORY_CONFIG

def update_slot_timings_config(payload: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
    global _IN_MEMORY_CONFIG
    current = dict(get_slot_timings_config(db))

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

    # 1. Persist to PostgreSQL database (Neon)
    _write_to_db(db, _IN_MEMORY_CONFIG)

    # 2. Persist to local JSON file
    try:
        with open(SLOT_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(_IN_MEMORY_CONFIG, f, indent=2)
    except Exception as e:
        logger.debug(f"Failed to save slot_timings.json (e.g. read-only filesystem): {e}")

    return _IN_MEMORY_CONFIG

"""
Dwell-time analysis engine.
Tracks entry, exit, and dwell durations per customer track per zone.
Handles brief occlusion and missed detections gracefully using configurable ZONE_EXIT_GRACE_SECONDS.
All calculations use exact video timestamps.
"""
from typing import List, Dict, Any, Optional
import numpy as np

class DwellTracker:
    def __init__(
        self,
        tolerance_seconds: float = 0.8,
        min_meaningful_dwell_sec: float = 0.5
    ):
        """
        tolerance_seconds: (ZONE_EXIT_GRACE_SECONDS) Detection gaps under this threshold
        are treated as continuous presence rather than prematurely breaking the session.
        min_meaningful_dwell_sec: Minimum dwell duration to filter transit flickers.
        """
        self.tolerance_seconds = tolerance_seconds
        self.min_meaningful_dwell_sec = min_meaningful_dwell_sec

        # Active sessions: track_id -> {zone_id, entry_time, last_seen_time}
        self.active_sessions: Dict[int, Dict[str, Any]] = {}
        # Completed sessions: list of {track_id, zone_id, entry_time, exit_time, dwell_seconds}
        self.completed_sessions: List[Dict[str, Any]] = []

        # Counts of raw entry and exit events per zone
        self.zone_entry_counts: Dict[str, int] = {}
        self.zone_exit_counts: Dict[str, int] = {}

    def update(self, track_id: int, zone_id: Optional[str], current_time: float):
        """Update track presence in a zone at current timestamp."""
        active = self.active_sessions.get(track_id)

        if active is None:
            if zone_id is not None:
                # Started new session in zone
                self.active_sessions[track_id] = {
                    "zone_id": zone_id,
                    "entry_time": current_time,
                    "last_seen_time": current_time
                }
                self.zone_entry_counts[zone_id] = self.zone_entry_counts.get(zone_id, 0) + 1
            return

        current_active_zone = active["zone_id"]

        if zone_id == current_active_zone:
            # Still in same zone
            active["last_seen_time"] = current_time
        elif zone_id is None:
            # Person temporarily outside or undetected
            gap = current_time - active["last_seen_time"]
            if gap > self.tolerance_seconds:
                # Close session
                dwell = round(active["last_seen_time"] - active["entry_time"], 2)
                if dwell >= self.min_meaningful_dwell_sec:
                    self.completed_sessions.append({
                        "track_id": track_id,
                        "zone_id": current_active_zone,
                        "entry_time": round(active["entry_time"], 2),
                        "exit_time": round(active["last_seen_time"], 2),
                        "dwell_seconds": dwell
                    })
                self.zone_exit_counts[current_active_zone] = self.zone_exit_counts.get(current_active_zone, 0) + 1
                del self.active_sessions[track_id]
        else:
            # Transitioned to a different zone
            dwell = round(active["last_seen_time"] - active["entry_time"], 2)
            if dwell >= self.min_meaningful_dwell_sec:
                self.completed_sessions.append({
                    "track_id": track_id,
                    "zone_id": current_active_zone,
                    "entry_time": round(active["entry_time"], 2),
                    "exit_time": round(active["last_seen_time"], 2),
                    "dwell_seconds": dwell
                })
            self.zone_exit_counts[current_active_zone] = self.zone_exit_counts.get(current_active_zone, 0) + 1

            # Start new session in the new zone
            self.active_sessions[track_id] = {
                "zone_id": zone_id,
                "entry_time": current_time,
                "last_seen_time": current_time
            }
            self.zone_entry_counts[zone_id] = self.zone_entry_counts.get(zone_id, 0) + 1

    def finalize(self):
        """Close any remaining active sessions at end of video."""
        for track_id, active in list(self.active_sessions.items()):
            dwell = round(active["last_seen_time"] - active["entry_time"], 2)
            zone_id = active["zone_id"]
            if dwell >= self.min_meaningful_dwell_sec:
                self.completed_sessions.append({
                    "track_id": track_id,
                    "zone_id": zone_id,
                    "entry_time": round(active["entry_time"], 2),
                    "exit_time": round(active["last_seen_time"], 2),
                    "dwell_seconds": dwell
                })
            self.zone_exit_counts[zone_id] = self.zone_exit_counts.get(zone_id, 0) + 1
        self.active_sessions.clear()

    def get_zone_dwell_statistics(self, zone_id: str) -> Dict[str, Any]:
        """Calculates exact deterministic dwell statistics for a specific zone."""
        sessions = [s for s in self.completed_sessions if s["zone_id"] == zone_id]
        entry_cnt = self.zone_entry_counts.get(zone_id, 0)
        exit_cnt = self.zone_exit_counts.get(zone_id, 0)

        if not sessions:
            return {
                "visits": 0,
                "entry_count": entry_cnt,
                "exit_count": exit_cnt,
                "avg_dwell": 0.0,
                "median_dwell": 0.0,
                "max_dwell": 0.0,
                "min_dwell": 0.0,
                "min_meaningful_dwell": self.min_meaningful_dwell_sec,
                "total_dwell": 0.0
            }

        dwells = [s["dwell_seconds"] for s in sessions]
        return {
            "visits": len(sessions),
            "entry_count": max(entry_cnt, len(sessions)),
            "exit_count": max(exit_cnt, len(sessions)),
            "avg_dwell": round(float(np.mean(dwells)), 2),
            "median_dwell": round(float(np.median(dwells)), 2),
            "max_dwell": round(float(np.max(dwells)), 2),
            "min_dwell": round(float(np.min(dwells)), 2),
            "min_meaningful_dwell": self.min_meaningful_dwell_sec,
            "total_dwell": round(float(np.sum(dwells)), 2)
        }

    def get_overall_dwell_statistics(self) -> Dict[str, Any]:
        """Calculates store-wide dwell statistics."""
        if not self.completed_sessions:
            return {
                "total_visits": 0,
                "avg_dwell": 0.0,
                "median_dwell": 0.0,
                "max_dwell": 0.0,
                "min_dwell": 0.0
            }
        dwells = [s["dwell_seconds"] for s in self.completed_sessions]
        return {
            "total_visits": len(self.completed_sessions),
            "avg_dwell": round(float(np.mean(dwells)), 2),
            "median_dwell": round(float(np.median(dwells)), 2),
            "max_dwell": round(float(np.max(dwells)), 2),
            "min_dwell": round(float(np.min(dwells)), 2)
        }

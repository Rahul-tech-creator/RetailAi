"""
Traffic and Occupancy Engine.
Tracks instantaneous store and zone occupancy, peak occupancy, average occupancy,
traffic density, new entries, and multi-resolution occupancy timelines (1s, 5s, 10s).
"""
from typing import List, Dict, Any, Set, Optional
from collections import defaultdict
import numpy as np

class TrafficTracker:
    def __init__(self, fps: float, duration: float):
        self.fps = max(1.0, fps)
        self.duration = duration
        # Track visitors per zone: zone_id -> set of track_ids
        self.zone_unique_visitors: Dict[str, Set[int]] = defaultdict(set)
        # Frame-by-frame occupancy: frame_idx -> {zone_id -> count}
        self.frame_zone_occupancy: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # Total store occupancy per frame: frame_idx -> count
        self.frame_store_occupancy: Dict[int, int] = defaultdict(int)
        # Timestamps for each frame_idx
        self.frame_timestamps: Dict[int, float] = {}
        # New entries tracking per frame
        self.frame_new_entries: Dict[int, int] = defaultdict(int)
        self.previously_seen_tracks: Set[int] = set()

    def record_frame(self, frame_idx: int, track_zone_map: Dict[int, Optional[str]], timestamp: float):
        """
        Record occupancy and arrivals for a frame.
        track_zone_map: dict of track_id -> zone_id (or None if outside zones)
        """
        self.frame_timestamps[frame_idx] = timestamp
        active_count = len(track_zone_map)
        self.frame_store_occupancy[frame_idx] = active_count

        # Check for newly arrived customer tracks
        current_tracks = set(track_zone_map.keys())
        new_arrivals = current_tracks - self.previously_seen_tracks
        self.frame_new_entries[frame_idx] = len(new_arrivals)
        self.previously_seen_tracks.update(current_tracks)

        for track_id, zone_id in track_zone_map.items():
            if zone_id:
                self.zone_unique_visitors[zone_id].add(track_id)
                self.frame_zone_occupancy[frame_idx][zone_id] += 1

    def calculate_peak_occupancy(self, zone_id: str) -> int:
        """Returns peak simultaneous count observed in a specific zone."""
        max_occ = 0
        for occ_map in self.frame_zone_occupancy.values():
            if zone_id in occ_map:
                if occ_map[zone_id] > max_occ:
                    max_occ = occ_map[zone_id]
        return max_occ

    def calculate_average_occupancy(self, zone_id: str) -> float:
        """Returns average occupancy across the analyzed period."""
        if not self.frame_store_occupancy:
            return 0.0
        zone_counts = [self.frame_zone_occupancy[f].get(zone_id, 0) for f in self.frame_store_occupancy.keys()]
        return round(float(np.mean(zone_counts)), 2) if zone_counts else 0.0

    def calculate_overall_peak_occupancy(self) -> int:
        """Returns peak simultaneous count observed across the camera view."""
        if not self.frame_store_occupancy:
            return 0
        return max(self.frame_store_occupancy.values())

    def calculate_overall_average_occupancy(self) -> float:
        """Returns average store occupancy across all analyzed frames."""
        if not self.frame_store_occupancy:
            return 0.0
        return round(float(np.mean(list(self.frame_store_occupancy.values()))), 2)

    def get_timeline(self, sample_interval_seconds: float = 1.0) -> List[Dict[str, Any]]:
        """
        Generates timeline of store and zone occupancy sampled every interval.
        """
        if not self.frame_timestamps:
            return []

        sorted_frames = sorted(self.frame_timestamps.keys())
        first_frame = sorted_frames[0]
        last_frame = sorted_frames[-1]

        timeline = []
        target_time = 0.0
        max_duration = max(self.duration, self.frame_timestamps.get(last_frame, 0.0))

        # Find closest frame for each interval timestamp
        while target_time <= max_duration:
            # Find frame with timestamp closest to target_time
            closest_frame = min(sorted_frames, key=lambda f: abs(self.frame_timestamps[f] - target_time))
            store_occ = self.frame_store_occupancy.get(closest_frame, 0)
            zone_occs = dict(self.frame_zone_occupancy.get(closest_frame, {}))

            # Accumulate new entries in the window [target_time - interval, target_time]
            entries_in_window = sum(
                self.frame_new_entries.get(f, 0)
                for f in sorted_frames
                if abs(self.frame_timestamps[f] - target_time) <= (sample_interval_seconds / 2.0)
            )

            timeline.append({
                "timestamp": round(target_time, 1),
                "store_occupancy": store_occ,
                "active_tracks": store_occ,
                "new_entries": entries_in_window,
                "zone_occupancy": zone_occs
            })
            target_time += sample_interval_seconds

        return timeline

    def get_multiresolution_timelines(self) -> Dict[str, List[Dict[str, Any]]]:
        """Returns timelines sampled at 1s, 5s, and 10s intervals for flexible UI charts."""
        return {
            "interval_1s": self.get_timeline(1.0),
            "interval_5s": self.get_timeline(5.0),
            "interval_10s": self.get_timeline(10.0)
        }

    def get_zone_traffic_summary(self, zone_id: str, zone_area: float) -> Dict[str, Any]:
        """Calculates traffic volume, average occupancy, peak occupancy, and density for a zone."""
        unique_count = len(self.zone_unique_visitors.get(zone_id, set()))
        peak_occ = self.calculate_peak_occupancy(zone_id)
        avg_occ = self.calculate_average_occupancy(zone_id)
        # Density: unique visitors per 100,000 square pixels of zone area
        density = round((unique_count / (zone_area / 100000.0)), 2) if zone_area > 0 else 0.0

        return {
            "unique_visitors": unique_count,
            "peak_occupancy": peak_occ,
            "avg_occupancy": avg_occ,
            "traffic_density": density
        }

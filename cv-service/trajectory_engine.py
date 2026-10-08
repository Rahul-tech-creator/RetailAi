"""
Trajectory, Flow Map, and Customer Journey Engine.
Extracts smooth foot-point trajectories, image-space relative movement speed (px/sec),
ordered zone transition customer journeys, and zone-to-zone Flow Map transitions.
"""
from typing import List, Dict, Any, Tuple, Optional, Set
from collections import Counter, defaultdict
import math
import numpy as np

class TrajectoryEngine:
    def __init__(self, fps: float):
        self.fps = max(1.0, fps)
        # track_id -> list of {"frame": int, "time": float, "x": float, "y": float, "zone": Optional[str]}
        self.tracks: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        # track_id -> list of observed speeds (px/s)
        self.track_speeds: Dict[int, List[float]] = defaultdict(list)
        # zone_id -> list of observed speeds (px/s)
        self.zone_speeds: Dict[str, List[float]] = defaultdict(list)

    def record_point(
        self,
        track_id: int,
        frame: int,
        timestamp: float,
        footpoint: Tuple[float, float],
        zone_id: Optional[str]
    ):
        """Record point and compute instantaneous image-space speed."""
        history = self.tracks[track_id]
        new_pt = {
            "frame": frame,
            "time": round(timestamp, 2),
            "x": round(footpoint[0], 1),
            "y": round(footpoint[1], 1),
            "zone": zone_id
        }

        if history:
            prev = history[-1]
            dt = timestamp - prev["time"]
            if dt > 0.03:  # minimum delta to avoid division noise
                dx = new_pt["x"] - prev["x"]
                dy = new_pt["y"] - prev["y"]
                distance = math.hypot(dx, dy)
                speed = distance / dt  # pixels per second (image-space)
                # Filter tracking jumps (> 1400 px/s typically ID-switch or border teleport)
                if speed < 1400.0:
                    self.track_speeds[track_id].append(speed)
                    if zone_id:
                        self.zone_speeds[zone_id].append(speed)

        history.append(new_pt)

    def get_track_summary(
        self,
        track_id: int,
        zone_names: Dict[str, str],
        is_valid: bool = True
    ) -> Dict[str, Any]:
        """Summarizes a customer's individual journey, speed, and trajectory for the Track Inspector."""
        pts = self.tracks.get(track_id, [])
        if not pts:
            return {}

        first_seen = pts[0]["time"]
        last_seen = pts[-1]["time"]
        duration = round(last_seen - first_seen, 2)

        # Build clean zone journey (collapse consecutive identical zones)
        journey_zones = []
        zone_dwell_map = defaultdict(float)
        prev_zone = None
        prev_time = first_seen

        for pt in pts:
            z = pt["zone"]
            t = pt["time"]
            if prev_zone:
                zone_dwell_map[prev_zone] += max(0.0, t - prev_time)
            if z and (not journey_zones or journey_zones[-1] != z):
                journey_zones.append(z)
            prev_zone = z
            prev_time = t

        named_journey = [zone_names.get(z, z) for z in journey_zones]

        speeds = self.track_speeds.get(track_id, [])
        avg_speed = round(float(np.mean(speeds)), 1) if speeds else 0.0

        # Subsample trajectory slightly to optimize frontend JSON payload while keeping crisp paths
        trajectory_sampled = [
            {"x": round(p["x"], 1), "y": round(p["y"], 1), "t": round(p["time"], 2), "z": p["zone"]}
            for i, p in enumerate(pts) if (i % 2 == 0 or i == len(pts) - 1)
        ]

        # Zone dwell breakdown for this specific track
        zone_dwells_formatted = {
            zone_names.get(z, z): round(val, 2)
            for z, val in zone_dwell_map.items() if val > 0.2
        }

        return {
            "anonymous_id": f"Customer #{track_id}",
            "track_id": track_id,
            "first_seen": round(first_seen, 2),
            "last_seen": round(last_seen, 2),
            "duration": duration,
            "is_valid_visitor": is_valid,
            "journey_sequence": named_journey,
            "zone_ids_sequence": journey_zones,
            "zone_dwells": zone_dwells_formatted,
            "avg_speed_px_sec": avg_speed,
            "points_count": len(pts),
            "trajectory": trajectory_sampled
        }

    def aggregate_common_journeys(
        self,
        zone_names: Dict[str, str],
        valid_track_ids: Optional[Set[int]] = None
    ) -> List[Dict[str, Any]]:
        """
        Mines frequent customer flow paths from verified tracking data.
        Returns ordered paths with frequency and observed customer counts.
        """
        path_counts = Counter()
        path_durations = defaultdict(list)

        for track_id, pts in self.tracks.items():
            if valid_track_ids is not None and track_id not in valid_track_ids:
                continue

            # Build sequence
            journey_zones = []
            for pt in pts:
                z = pt["zone"]
                if z and (not journey_zones or journey_zones[-1] != z):
                    journey_zones.append(z)

            if journey_zones:
                path_str = " → ".join([zone_names.get(z, z) for z in journey_zones])
                path_counts[path_str] += 1
                dur = pts[-1]["time"] - pts[0]["time"]
                path_durations[path_str].append(dur)

        total_customers = sum(path_counts.values()) or 1
        common_journeys = []

        for path, count in path_counts.most_common(10):
            percentage = round((count / total_customers) * 100.0, 1)
            steps = path.split(" → ")
            avg_dur = round(float(np.mean(path_durations[path])), 1) if path_durations[path] else 0.0
            common_journeys.append({
                "path": path,
                "steps": steps,
                "observed_customers": count,
                "percentage": percentage,
                "avg_duration_sec": avg_dur
            })

        return common_journeys

    def build_flow_map(
        self,
        zones: List[Dict[str, Any]],
        valid_track_ids: Optional[Set[int]] = None
    ) -> Dict[str, Any]:
        """
        Builds visual Flow Map data: directed transitions between zones
        with actual transition counts. Connection thickness represents transition frequency.
        """
        zone_name_map = {z["id"]: z["name"] for z in zones}
        zone_color_map = {z["id"]: z.get("color", "#10B981") for z in zones}

        # Pairwise transitions counter: (from_zone_id, to_zone_id) -> count
        transition_counts = Counter()

        for track_id, pts in self.tracks.items():
            if valid_track_ids is not None and track_id not in valid_track_ids:
                continue

            # Find consecutive distinct zones visited by this track
            visited_zones = []
            for pt in pts:
                z = pt["zone"]
                if z and (not visited_zones or visited_zones[-1] != z):
                    visited_zones.append(z)

            for i in range(len(visited_zones) - 1):
                from_z = visited_zones[i]
                to_z = visited_zones[i + 1]
                if from_z != to_z:
                    transition_counts[(from_z, to_z)] += 1

        total_transitions = sum(transition_counts.values()) or 1

        nodes = [
            {
                "id": z["id"],
                "name": z["name"],
                "category": z.get("category", "General"),
                "color": z.get("color", "#10B981")
            }
            for z in zones
        ]

        links = []
        for (from_z, to_z), count in transition_counts.most_common():
            links.append({
                "source": from_z,
                "target": to_z,
                "source_name": zone_name_map.get(from_z, from_z),
                "target_name": zone_name_map.get(to_z, to_z),
                "count": count,
                "percentage": round((count / total_transitions) * 100.0, 1),
                "stroke_width": max(2, min(14, int(count * 2.5)))
            })

        return {
            "nodes": nodes,
            "links": links,
            "total_transitions": total_transitions
        }

    def get_speed_metrics(self) -> Dict[str, Any]:
        """Returns store-wide and zone-specific relative speed metrics."""
        all_speeds = [s for sl in self.track_speeds.values() for s in sl]
        overall_avg = round(float(np.mean(all_speeds)), 1) if all_speeds else 0.0

        zone_avg_speeds = {}
        for z_id, speeds in self.zone_speeds.items():
            zone_avg_speeds[z_id] = round(float(np.mean(speeds)), 1) if speeds else 0.0

        return {
            "overall_avg_speed_px_sec": overall_avg,
            "zone_avg_speeds": zone_avg_speeds,
            "speed_label": "Image-Space Relative Movement Speed (px/sec)",
            "unit": "px/s",
            "calibration_status": "Uncalibrated monocular camera perspective"
        }

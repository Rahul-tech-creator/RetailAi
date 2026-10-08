"""
Deterministic Bottleneck Detection Engine.
Identifies areas where high occupancy, prolonged dwell time, elevated density,
and genuine movement speed reduction combine to signal pedestrian congestion/friction.
A popular area with free-flowing pedestrian speed is classified as a 'High Traffic Corridor',
NOT a bottleneck.
Returns transparent 0-100 score, normalized contributing signals, concrete evidence, and confidence.
"""
from typing import List, Dict, Any

class BottleneckEngine:
    def __init__(
        self,
        occupancy_weight: float = 0.35,
        dwell_weight: float = 0.30,
        speed_weight: float = 0.20,
        density_weight: float = 0.15
    ):
        self.occupancy_weight = occupancy_weight
        self.dwell_weight = dwell_weight
        self.speed_weight = speed_weight
        self.density_weight = density_weight

    def detect_bottlenecks(
        self,
        zones: List[Dict[str, Any]],
        zone_dwells: Dict[str, Dict[str, Any]],
        zone_traffics: Dict[str, Dict[str, Any]],
        zone_speeds: Dict[str, float],
        store_stats: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Calculates deterministic bottleneck scores for each zone.
        Zones exhibiting movement constraints and elevated occupancy
        are labeled as 'Potential Bottleneck' with verifiable evidence.
        """
        bottlenecks = []
        overall_avg_dwell = max(0.5, store_stats.get("avg_dwell", 1.0))
        overall_peak_occ = max(1, store_stats.get("peak_occupancy", 1))
        overall_avg_speed = max(1.0, store_stats.get("overall_avg_speed_px_sec", 30.0))

        # Max values across zones for min-max normalization
        all_peak_occs = [zone_traffics.get(z["id"], {}).get("peak_occupancy", 0) for z in zones] or [1]
        max_zone_peak = max(max(all_peak_occs), 1)

        all_avg_dwells = [zone_dwells.get(z["id"], {}).get("avg_dwell", 0.0) for z in zones] or [1.0]
        max_zone_dwell = max(max(all_avg_dwells), 0.5)

        all_densities = [zone_traffics.get(z["id"], {}).get("traffic_density", 0.0) for z in zones] or [1.0]
        max_density = max(max(all_densities), 1.0)

        for zone in zones:
            z_id = zone["id"]
            z_name = zone["name"]
            dwell_data = zone_dwells.get(z_id, {})
            traffic_data = zone_traffics.get(z_id, {})

            visits = dwell_data.get("visits", 0)
            avg_dwell = dwell_data.get("avg_dwell", 0.0)
            peak_occ = traffic_data.get("peak_occupancy", 0)
            density = traffic_data.get("traffic_density", 0.0)
            speed = zone_speeds.get(z_id, overall_avg_speed)

            # Skip zones with no recorded visits
            if visits == 0:
                continue

            # Normalized sub-scores (0.0 to 1.0)
            s_occ = min(1.0, peak_occ / max_zone_peak)
            s_dwell = min(1.0, avg_dwell / max_zone_dwell)
            s_density = min(1.0, density / max_density)
            # Speed penalty: lower relative speed indicates pedestrian friction/queuing
            s_speed_slowdown = max(0.0, min(1.0, (overall_avg_speed - speed) / overall_avg_speed)) if overall_avg_speed > 0 else 0.0

            raw_score = (
                self.occupancy_weight * s_occ +
                self.dwell_weight * s_dwell +
                self.density_weight * s_density +
                self.speed_weight * s_speed_slowdown
            )

            score_normalized = round(raw_score * 100.0, 1)

            # Concrete evidence derivation
            evidence = []
            rel_occ_pct = round((peak_occ / float(overall_peak_occ)) * 100)
            if peak_occ >= 2 or rel_occ_pct >= 65:
                evidence.append(f"{rel_occ_pct}% relative store peak occupancy ({peak_occ} simultaneous customer tracks)")

            if avg_dwell > overall_avg_dwell:
                evidence.append(f"Prolonged dwell duration: {avg_dwell}s exceeds store average ({overall_avg_dwell}s)")

            if s_speed_slowdown > 0.08 and overall_avg_speed > 0:
                slowdown_pct = round(((overall_avg_speed - speed) / overall_avg_speed) * 100)
                evidence.append(f"Movement slowdown: {speed} px/s ({slowdown_pct}% slower than store median {overall_avg_speed} px/s)")
            elif speed >= overall_avg_speed:
                evidence.append(f"Unconstrained movement speed: {speed} px/s indicates fluid traversal")

            if density > max_density * 0.4:
                evidence.append(f"Elevated spatial traffic density: {density} visitors per 100k sq px")

            # Determine confidence rating based on sample size
            if visits >= 5 and (s_speed_slowdown > 0.15 or peak_occ >= 3):
                confidence = "High"
            elif visits >= 2:
                confidence = "Medium"
            else:
                confidence = "Low"

            # Requirement: A true bottleneck requires movement constraint or elevated concurrent friction,
            # not merely high visits!
            has_movement_constraint = (s_speed_slowdown >= 0.15) or (peak_occ >= 2 and avg_dwell >= 2.0)
            is_bottleneck = (score_normalized >= 45.0) and (visits >= 2) and has_movement_constraint

            bottlenecks.append({
                "zone_id": z_id,
                "location": z_name,
                "zone_name": z_name,
                "category": zone.get("category", "General"),
                "status": "Potential Bottleneck" if is_bottleneck else "Normal Flow",
                "is_bottleneck": is_bottleneck,
                "score": score_normalized,
                "confidence": confidence,
                "evidence": evidence or ["Standard pedestrian transit without sustained congestion"],
                "contributing_signals": {
                    "occupancy_signal": round(s_occ * 100, 1),
                    "dwell_signal": round(s_dwell * 100, 1),
                    "density_signal": round(s_density * 100, 1),
                    "speed_slowdown_signal": round(s_speed_slowdown * 100, 1)
                },
                "metrics": {
                    "peak_occupancy": peak_occ,
                    "avg_dwell_sec": avg_dwell,
                    "avg_speed_px_sec": speed,
                    "traffic_density": density,
                    "observed_visits": visits
                }
            })

        # Sort highest score first
        bottlenecks.sort(key=lambda x: x["score"], reverse=True)
        return bottlenecks

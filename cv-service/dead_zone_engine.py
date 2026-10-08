"""
Deterministic Dead-Zone Detection Engine.
Identifies under-traversed store areas by evaluating customer activity
relative to other observed regions, zone surface area, observation duration,
and store-wide foot-traffic baseline.
"""
from typing import List, Dict, Any

class DeadZoneEngine:
    def __init__(
        self,
        traffic_share_weight: float = 0.45,
        dwell_share_weight: float = 0.35,
        occupancy_weight: float = 0.20
    ):
        self.traffic_share_weight = traffic_share_weight
        self.dwell_share_weight = dwell_share_weight
        self.occupancy_weight = occupancy_weight

    def detect_dead_zones(
        self,
        zones: List[Dict[str, Any]],
        zone_dwells: Dict[str, Dict[str, Any]],
        zone_traffics: Dict[str, Dict[str, Any]],
        store_stats: Dict[str, Any],
        duration_sec: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Calculates dead-zone severity and relative activity scores.
        Only classifies as Potential Dead Zone if multi-condition evidence is satisfied.
        """
        dead_zones = []
        total_visits = max(1, sum(zone_dwells.get(z["id"], {}).get("visits", 0) for z in zones))
        total_dwell_sum = max(1.0, sum(zone_dwells.get(z["id"], {}).get("total_dwell", 0.0) for z in zones))
        total_unique_visitors = max(1, store_stats.get("unique_visitors", 1))

        # Check for insufficient observation window (< 10s)
        if duration_sec > 0 and duration_sec < 10.0:
            for zone in zones:
                dead_zones.append({
                    "zone_id": zone["id"],
                    "location": zone["name"],
                    "zone_name": zone["name"],
                    "category": zone.get("category", "General"),
                    "status": "Insufficient Evidence",
                    "is_dead_zone": False,
                    "score": 0.0,
                    "activity_score": 0.0,
                    "relative_activity_pct": 0.0,
                    "confidence": "Low",
                    "evidence": ["Insufficient observation time to classify this area (< 10s duration)."],
                    "metrics": {
                        "visits": 0,
                        "unique_visitors": 0,
                        "avg_dwell_sec": 0.0,
                        "traffic_share_pct": 0.0,
                        "dwell_share_pct": 0.0
                    }
                })
            return dead_zones

        total_area = sum(z.get("area", 1.0) for z in zones) or 1.0

        for zone in zones:
            z_id = zone["id"]
            z_name = zone["name"]
            z_area = zone.get("area", 1.0)
            dwell_data = zone_dwells.get(z_id, {})
            traffic_data = zone_traffics.get(z_id, {})

            visits = dwell_data.get("visits", 0)
            avg_dwell = dwell_data.get("avg_dwell", 0.0)
            total_dwell = dwell_data.get("total_dwell", 0.0)
            unique_visitors = traffic_data.get("unique_visitors", 0)
            peak_occ = traffic_data.get("peak_occupancy", 0)

            # Proportions of overall store activity
            traffic_share = visits / float(total_visits)
            dwell_share = total_dwell / float(total_dwell_sum)
            visitor_penetration = unique_visitors / float(total_unique_visitors)

            # Area-weighted expected share
            area_weight = z_area / float(total_area)
            expected_share = max(0.05, area_weight)

            # Deficiency relative to area-weighted expectation
            traffic_deficiency = max(0.0, min(1.0, (expected_share - traffic_share) / expected_share))
            dwell_deficiency = max(0.0, min(1.0, (expected_share - dwell_share) / expected_share))
            occ_deficiency = 1.0 if peak_occ == 0 else max(0.0, min(1.0, 1.0 - (peak_occ / 2.0)))

            dead_zone_score_raw = (
                self.traffic_share_weight * traffic_deficiency +
                self.dwell_share_weight * dwell_deficiency +
                self.occupancy_weight * occ_deficiency
            )

            score_normalized = round(dead_zone_score_raw * 100.0, 1)

            # Relative activity score (100 = active, 0 = dormant)
            activity_score = round(max(0.0, 100.0 - score_normalized), 1)
            relative_activity = round((traffic_share / expected_share) * 100.0, 1) if expected_share > 0 else 0.0

            # Generate observed evidence
            evidence = []
            if visits == 0:
                evidence.append("Zero customer visits recorded during observed footage")
            else:
                share_pct = round(traffic_share * 100.0, 1)
                evidence.append(f"Captures only {share_pct}% of total observed store visits ({visits} visits)")

            if visitor_penetration < 0.25 and unique_visitors > 0:
                pen_pct = round(visitor_penetration * 100.0, 1)
                evidence.append(f"Low customer penetration: only {pen_pct}% of tracked individuals visited ({unique_visitors} visitors)")
            elif unique_visitors == 0:
                evidence.append("Zero customer penetration observed")

            if avg_dwell < 1.5 and visits > 0:
                evidence.append(f"Transit-only dwell ({avg_dwell}s) indicates swift bypass without product interaction")

            if peak_occ <= 1:
                evidence.append(f"Negligible concurrency: maximum {peak_occ} customer present simultaneously")

            # Multi-condition requirement:
            # Must satisfy deficiency score >= 50, low penetration, and at least 3 total visits observed across the store
            is_dead_zone = (score_normalized >= 50.0 and total_visits >= 3) or (visits == 0 and total_visits >= 4)

            # Confidence based on total observed store activity
            if total_visits >= 8:
                confidence = "High"
            elif total_visits >= 4:
                confidence = "Medium"
            else:
                confidence = "Low"

            status = "Potential Dead Zone" if is_dead_zone else ("Active Region" if total_visits >= 3 else "Insufficient Evidence")

            dead_zones.append({
                "zone_id": z_id,
                "location": z_name,
                "zone_name": z_name,
                "category": zone.get("category", "General"),
                "status": status,
                "is_dead_zone": is_dead_zone,
                "score": score_normalized,
                "activity_score": activity_score,
                "relative_activity_pct": relative_activity,
                "confidence": confidence,
                "evidence": evidence or ["Healthy customer traversal and dwell observed relative to zone area"],
                "metrics": {
                    "visits": visits,
                    "unique_visitors": unique_visitors,
                    "avg_dwell_sec": avg_dwell,
                    "traffic_share_pct": round(traffic_share * 100.0, 1),
                    "dwell_share_pct": round(dwell_share * 100.0, 1),
                    "relative_activity_pct": relative_activity
                }
            })

        # Sort highest dead zone score first
        dead_zones.sort(key=lambda x: x["score"], reverse=True)
        return dead_zones

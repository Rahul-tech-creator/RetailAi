"""
Zone & Spatial Region Management Engine.
Handles custom polygon retail zones and intelligent automatic camera-space region partitioning.
Enforces strict distinction:
- User-drawn zones = Semantic Retail Zones (e.g. Checkout, Entrance, Produce, Aisles)
- Automatic partitions = Camera-Space Regions (e.g. Region 1 (Upper Left Sector), Region 2 ...)
Never hallucinates department names for camera-space regions.
"""
from typing import List, Dict, Any, Tuple, Optional
import cv2
import numpy as np

def calculate_polygon_area(polygon: List[List[float]]) -> float:
    """Calculates polygon area in square pixels using the Shoelace formula."""
    if len(polygon) < 3:
        return 0.0
    pts = np.array(polygon, dtype=np.float32)
    return float(abs(cv2.contourArea(pts)))

def point_in_polygon(point: Tuple[float, float], polygon: List[List[float]]) -> bool:
    """
    Returns True if point (x, y) is inside the polygon.
    Uses cv2.pointPolygonTest for robust geometric inclusion.
    """
    if len(polygon) < 3:
        return False
    pts = np.array(polygon, dtype=np.float32)
    result = cv2.pointPolygonTest(pts, (float(point[0]), float(point[1])), measureDist=False)
    return result >= 0

def find_matching_zone(point: Tuple[float, float], zones: List[Dict[str, Any]]) -> Optional[str]:
    """
    Finds the zone ID containing the given foot point.
    Returns zone_id or None if unassigned.
    """
    for zone in zones:
        poly = zone.get("polygon", [])
        if point_in_polygon(point, poly):
            return zone.get("id")
    return None

def generate_automatic_regions(width: int, height: int) -> Tuple[List[Dict[str, Any]], str, str]:
    """
    Generates deterministic camera-space regions based on camera aspect ratio
    and usable floor geometry (excluding top ceiling / camera timestamp strip).
    
    Returns:
        (regions, notice_message, confidence_rating)
    """
    w = float(width)
    h = float(height)
    aspect_ratio = round(w / max(1.0, h), 2)
    
    # In CCTV perspective, top 12% is almost always ceiling/lighting/timestamp overlay
    usable_top = round(h * 0.12, 1)
    usable_height = round(h - usable_top, 1)
    
    # Default confidence
    confidence = "Medium"
    
    # 1. Wide / Corridor Aspect Ratio (Aspect ratio > 2.2)
    if aspect_ratio >= 2.2:
        seg_w = round(w / 3.0, 1)
        regions = [
            {
                "id": "auto_region_1",
                "name": "Region 1 (Corridor Left Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#3B82F6",
                "polygon": [[0.0, usable_top], [seg_w, usable_top], [seg_w, h], [0.0, h]],
                "area": round(seg_w * usable_height, 1)
            },
            {
                "id": "auto_region_2",
                "name": "Region 2 (Corridor Center Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#10B981",
                "polygon": [[seg_w, usable_top], [seg_w * 2.0, usable_top], [seg_w * 2.0, h], [seg_w, h]],
                "area": round(seg_w * usable_height, 1)
            },
            {
                "id": "auto_region_3",
                "name": "Region 3 (Corridor Right Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#8B5CF6",
                "polygon": [[seg_w * 2.0, usable_top], [w, usable_top], [w, h], [seg_w * 2.0, h]],
                "area": round((w - seg_w * 2.0) * usable_height, 1)
            }
        ]
        notice = "No custom zones were provided. Analytics are being reported using automatically generated camera regions (horizontal corridor partition)."
    
    # 2. Narrow / Vertical Aspect Ratio (Aspect ratio < 0.9)
    elif aspect_ratio <= 0.85:
        seg_h = round(usable_height / 3.0, 1)
        y1 = usable_top
        y2 = round(usable_top + seg_h, 1)
        y3 = round(usable_top + 2.0 * seg_h, 1)
        regions = [
            {
                "id": "auto_region_1",
                "name": "Region 1 (Background / Far Field)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#3B82F6",
                "polygon": [[0.0, y1], [w, y1], [w, y2], [0.0, y2]],
                "area": round(w * seg_h, 1)
            },
            {
                "id": "auto_region_2",
                "name": "Region 2 (Midground Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#10B981",
                "polygon": [[0.0, y2], [w, y2], [w, y3], [0.0, y3]],
                "area": round(w * seg_h, 1)
            },
            {
                "id": "auto_region_3",
                "name": "Region 3 (Foreground / Near Field)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#8B5CF6",
                "polygon": [[0.0, y3], [w, y3], [w, h], [0.0, h]],
                "area": round(w * (h - y3), 1)
            }
        ]
        notice = "No custom zones were provided. Analytics are being reported using automatically generated camera regions (vertical depth partition)."

    # 3. Standard 16:9 / 4:3 Camera View
    else:
        mid_x = round(w / 2.0, 1)
        mid_y = round(usable_top + (usable_height / 2.0), 1)
        
        regions = [
            {
                "id": "auto_region_1",
                "name": "Region 1 (Upper Left Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#3B82F6",
                "polygon": [[0.0, usable_top], [mid_x, usable_top], [mid_x, mid_y], [0.0, mid_y]],
                "area": round(mid_x * (mid_y - usable_top), 1)
            },
            {
                "id": "auto_region_2",
                "name": "Region 2 (Upper Right Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#10B981",
                "polygon": [[mid_x, usable_top], [w, usable_top], [w, mid_y], [mid_x, mid_y]],
                "area": round((w - mid_x) * (mid_y - usable_top), 1)
            },
            {
                "id": "auto_region_3",
                "name": "Region 3 (Lower Left Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#F59E0B",
                "polygon": [[0.0, mid_y], [mid_x, mid_y], [mid_x, h], [0.0, h]],
                "area": round(mid_x * (h - mid_y), 1)
            },
            {
                "id": "auto_region_4",
                "name": "Region 4 (Lower Right Sector)",
                "category": "Camera-Space Region",
                "source": "automatic",
                "color": "#8B5CF6",
                "polygon": [[mid_x, mid_y], [w, mid_y], [w, h], [mid_x, h]],
                "area": round((w - mid_x) * (h - mid_y), 1)
            }
        ]
        notice = "No custom zones were provided. Analytics are being reported using automatically generated camera regions."

    return regions, notice, confidence

def prepare_zones(custom_zones: Optional[List[Dict[str, Any]]], width: int, height: int) -> Tuple[List[Dict[str, Any]], str, str]:
    """
    Normalizes custom zones or falls back to intelligent automatic camera regions.
    Returns (zones, notice_message, zone_confidence).
    """
    if custom_zones and len(custom_zones) > 0:
        valid_zones = []
        palette = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#6366F1"]
        total_frame_area = float(width * height)
        
        for idx, z in enumerate(custom_zones):
            poly = z.get("polygon", [])
            if len(poly) >= 3:
                area = calculate_polygon_area(poly)
                color = z.get("color") or palette[idx % len(palette)]
                area_pct = round((area / max(1.0, total_frame_area)) * 100.0, 1)
                
                # Check for suspicious zone size
                is_suspicious = (area_pct < 2.5) or (area_pct > 80.0)
                warning_note = None
                if is_suspicious:
                    warning_note = f"Zone covers {area_pct}% of view; metrics should be evaluated on normalized area density."
                
                valid_zones.append({
                    "id": z.get("id") or f"custom_zone_{idx+1}",
                    "name": z.get("name") or f"Zone {idx+1}",
                    "category": z.get("category") or "Retail Department",
                    "source": "user",
                    "color": color,
                    "polygon": poly,
                    "area": round(area, 1),
                    "area_pct_of_frame": area_pct,
                    "is_suspicious_size": is_suspicious,
                    "size_warning": warning_note
                })
        if len(valid_zones) > 0:
            return valid_zones, "User-defined custom zones active.", "High"

    # Automatic fallback
    auto_regions, notice, conf = generate_automatic_regions(width, height)
    total_frame_area = float(width * height)
    for r in auto_regions:
        r["area_pct_of_frame"] = round((r["area"] / max(1.0, total_frame_area)) * 100.0, 1)
        r["is_suspicious_size"] = False
        r["size_warning"] = None
        
    return auto_regions, notice, conf

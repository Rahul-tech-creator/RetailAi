"""
Video Annotation Engine.
Renders tracked customer bounding boxes, anonymous IDs, floor foot-points,
motion trails, and zone boundaries onto the processed video.
"""
from typing import List, Dict, Any, Tuple
import cv2
import numpy as np

def hex_to_bgr(hex_str: str) -> Tuple[int, int, int]:
    """Convert hex string (e.g. #10B981) to BGR tuple for OpenCV."""
    hex_str = hex_str.lstrip("#")
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        return (b, g, r)
    return (100, 200, 100)

class VideoAnnotator:
    def __init__(self, zones: List[Dict[str, Any]], width: int, height: int):
        self.zones = zones
        self.width = width
        self.height = height

        # Precompute zone overlay background mask
        self.zone_overlay = np.zeros((height, width, 3), dtype=np.uint8)
        for zone in zones:
            poly = zone.get("polygon", [])
            if len(poly) >= 3:
                pts = np.array(poly, dtype=np.int32)
                color = hex_to_bgr(zone.get("color", "#10B981"))
                cv2.fillPoly(self.zone_overlay, [pts], color)

    def draw_zones(self, frame: np.ndarray, alpha: float = 0.15) -> np.ndarray:
        """Draw semi-transparent zone polygons and borders on frame."""
        # Blend polygon fills
        mask = (self.zone_overlay > 0)
        frame[mask] = cv2.addWeighted(frame, 1.0 - alpha, self.zone_overlay, alpha, 0)[mask]

        # Draw crisp borders and zone titles
        for zone in self.zones:
            poly = zone.get("polygon", [])
            if len(poly) >= 3:
                pts = np.array(poly, dtype=np.int32)
                color = hex_to_bgr(zone.get("color", "#10B981"))
                cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2, lineType=cv2.LINE_AA)

                # Zone label badge at centroid / top vertex
                cx = int(np.mean(pts[:, 0]))
                cy = int(np.min(pts[:, 1])) + 20
                label = zone.get("name", "Zone")
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                cv2.rectangle(frame, (cx - tw // 2 - 4, cy - th - 4), (cx + tw // 2 + 4, cy + 4), (20, 24, 30), -1)
                cv2.rectangle(frame, (cx - tw // 2 - 4, cy - th - 4), (cx + tw // 2 + 4, cy + 4), color, 1)
                cv2.putText(frame, label, (cx - tw // 2, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        return frame

    def draw_detections(
        self,
        frame: np.ndarray,
        active_tracks: List[Dict[str, Any]],
        track_histories: Dict[int, List[Tuple[float, float]]]
    ) -> np.ndarray:
        """
        Draws active person bounding boxes, anonymous ID badges,
        foot-points, and movement trails.
        """
        for trk in active_tracks:
            track_id = trk["track_id"]
            x1, y1, x2, y2 = trk["bbox"]
            foot_x, foot_y = trk["footpoint"]

            # Draw trajectory trail (last 20 points)
            history = track_histories.get(track_id, [])
            if len(history) > 1:
                tail = history[-25:]
                for i in range(1, len(tail)):
                    pt1 = (int(tail[i - 1][0]), int(tail[i - 1][1]))
                    pt2 = (int(tail[i][0]), int(tail[i][1]))
                    fade = int(100 + (155 * (i / len(tail))))
                    cv2.line(frame, pt1, pt2, (40, fade, 220), 2, lineType=cv2.LINE_AA)

            # Draw bounding box (subtle, clean styling)
            ix1, iy1, ix2, iy2 = int(x1), int(y1), int(x2), int(y2)
            cv2.rectangle(frame, (ix1, iy1), (ix2, iy2), (16, 185, 129), 2, lineType=cv2.LINE_AA)

            # Draw corner accents for professional look
            corner_len = min(15, (ix2 - ix1) // 3)
            # Top-left
            cv2.line(frame, (ix1, iy1), (ix1 + corner_len, iy1), (255, 255, 255), 3)
            cv2.line(frame, (ix1, iy1), (ix1, iy1 + corner_len), (255, 255, 255), 3)

            # Draw foot point indicator
            ifx, ify = int(foot_x), int(foot_y)
            cv2.circle(frame, (ifx, ify), 6, (16, 185, 129), -1, lineType=cv2.LINE_AA)
            cv2.circle(frame, (ifx, ify), 8, (255, 255, 255), 2, lineType=cv2.LINE_AA)
            cv2.circle(frame, (ifx, ify), 2, (0, 0, 0), -1, lineType=cv2.LINE_AA)

            # Draw Anonymous ID badge
            id_text = f"Customer #{track_id}"
            (bw, bh), _ = cv2.getTextSize(id_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            badge_y = max(iy1 - 6, bh + 8)
            cv2.rectangle(frame, (ix1, badge_y - bh - 6), (ix1 + bw + 10, badge_y + 2), (15, 23, 42), -1)
            cv2.rectangle(frame, (ix1, badge_y - bh - 6), (ix1 + bw + 10, badge_y + 2), (16, 185, 129), 1)
            cv2.putText(frame, id_text, (ix1 + 5, badge_y - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        return frame

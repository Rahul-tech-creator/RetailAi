"""
Heatmap Generation Engine.
Generates genuine 2D Gaussian kernel density heatmaps
from verified tracked customer floor foot-points.
Supports Activity heatmaps, Density heatmaps, transparent alpha overlays,
and raw foot-point sampling for visual verification.
"""
from typing import List, Tuple, Dict, Any, Optional
import os
import cv2
import numpy as np

class HeatmapEngine:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        # Accumulator grid at scaled resolution for smooth kernel smoothing
        self.grid_scale = 0.5  # half resolution for fast convolution
        self.gw = max(1, int(width * self.grid_scale))
        self.gh = max(1, int(height * self.grid_scale))
        self.accumulator = np.zeros((self.gh, self.gw), dtype=np.float32)
        self.total_points = 0
        self.all_footpoints: List[Tuple[float, float]] = []

    def add_point(self, footpoint: Tuple[float, float], weight: float = 1.0):
        """Add verified foot point to accumulation grid."""
        x, y = footpoint
        self.all_footpoints.append((round(float(x), 1), round(float(y), 1)))
        gx = int(x * self.grid_scale)
        gy = int(y * self.grid_scale)
        if 0 <= gx < self.gw and 0 <= gy < self.gh:
            self.accumulator[gy, gx] += weight
            self.total_points += 1

    def get_sampled_foot_points(self, max_points: int = 600) -> List[List[float]]:
        """
        Returns an evenly spaced sample of raw foot points
        for the 'Show Foot Points' visual validation debug overlay.
        """
        if not self.all_footpoints:
            return []
        n = len(self.all_footpoints)
        if n <= max_points:
            return [[p[0], p[1]] for p in self.all_footpoints]
        
        step = max(1, n // max_points)
        return [[self.all_footpoints[i][0], self.all_footpoints[i][1]] for i in range(0, n, step)][:max_points]

    def generate_heatmap(
        self,
        base_frame_path: str,
        output_heatmap_path: str,
        blur_radius: int = 35,
        alpha: float = 0.55
    ) -> Dict[str, Any]:
        """
        Generates overlaid heatmap and saves as image file.
        Returns heatmap metadata (max density, total points, output path, explanation).
        """
        explanation = "Heatmap represents observed customer foot-point activity during the analyzed period."
        sampled_pts = self.get_sampled_foot_points(600)

        if self.total_points == 0:
            if os.path.exists(base_frame_path):
                img = cv2.imread(base_frame_path)
                cv2.imwrite(output_heatmap_path, img)
            return {
                "total_points": 0,
                "max_density": 0.0,
                "output_path": output_heatmap_path,
                "explanation": explanation,
                "status": "Insufficient foot-point data for heatmap generation",
                "sampled_foot_points": []
            }

        # Apply Gaussian blur smoothing
        ksize = max(5, blur_radius | 1)
        smoothed = cv2.GaussianBlur(self.accumulator, (ksize, ksize), 0)

        # Normalize to 0-255
        max_val = float(np.max(smoothed))
        if max_val > 0:
            norm = (smoothed / max_val * 255.0).astype(np.uint8)
        else:
            norm = np.zeros_like(smoothed, dtype=np.uint8)

        # Resize smoothed density back to original video dimensions
        norm_full = cv2.resize(norm, (self.width, self.height), interpolation=cv2.INTER_LINEAR)

        # Apply TURBO colormap for optimal perceptual visibility
        colored_heatmap = cv2.applyColorMap(norm_full, cv2.COLORMAP_TURBO)

        # Create alpha mask from density
        mask = norm_full.astype(np.float32) / 255.0
        mask = np.clip(mask * 1.5, 0.0, 1.0)  # enhance mid-range contrast

        # Read base representative frame
        if os.path.exists(base_frame_path):
            base_img = cv2.imread(base_frame_path)
            if base_img.shape[0] != self.height or base_img.shape[1] != self.width:
                base_img = cv2.resize(base_img, (self.width, self.height))
        else:
            base_img = np.zeros((self.height, self.width, 3), dtype=np.uint8)

        # Blend base frame with heatmap using dynamic alpha mask
        blended = np.zeros_like(base_img)
        for c in range(3):
            blended[:, :, c] = (
                (1.0 - mask * alpha) * base_img[:, :, c] +
                (mask * alpha) * colored_heatmap[:, :, c]
            ).astype(np.uint8)

        cv2.imwrite(output_heatmap_path, blended)

        # Save standalone transparent color overlay as well
        transparent_path = output_heatmap_path.replace(".png", "_overlay.png").replace(".jpg", "_overlay.png")
        rgba = cv2.cvtColor(colored_heatmap, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = (mask * 255.0 * alpha).astype(np.uint8)
        cv2.imwrite(transparent_path, rgba)

        # Save pure density heatmap image (no base frame background)
        density_path = output_heatmap_path.replace(".png", "_density.png").replace(".jpg", "_density.png")
        cv2.imwrite(density_path, colored_heatmap)

        return {
            "total_points": self.total_points,
            "max_density": round(max_val, 3),
            "output_path": output_heatmap_path,
            "overlay_path": transparent_path,
            "density_path": density_path,
            "explanation": explanation,
            "status": "Success",
            "sampled_foot_points": sampled_pts
        }

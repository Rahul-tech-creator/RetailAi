"""
Foot-point extraction module.
Calculates the floor contact position for tracked individuals.
Formula: bottom-center of bounding box: x = (x1 + x2) / 2, y = y2
"""
from typing import Tuple

def get_footpoint(x1: float, y1: float, x2: float, y2: float) -> Tuple[float, float]:
    """
    Computes floor foot-point coordinate from bounding box.
    Do NOT use head or bounding box center for spatial floor-zone mapping.
    """
    x = float(x1 + x2) / 2.0
    y = float(y2)
    return (round(x, 2), round(y, 2))

# Alias for backward compatibility
extract_footpoint = get_footpoint


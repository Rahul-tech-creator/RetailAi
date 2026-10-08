"""
Person Detection Module.
Uses Ultralytics YOLOv8 optimized for person detection (COCO class 0).
"""
from typing import List, Dict, Any
from ultralytics import YOLO
import numpy as np

class PersonDetector:
    def __init__(self, model_path: str = "yolov8n.pt", conf_thresh: float = 0.28):
        self.model = YOLO(model_path)
        self.conf_thresh = conf_thresh
        # COCO person class id is 0
        self.person_class_id = 0

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs person detection on a single frame.
        Returns list of dicts: {"bbox": [x1, y1, x2, y2], "confidence": float, "class_id": 0}
        """
        # Run inference specifying person class only
        results = self.model.predict(
            source=frame,
            classes=[self.person_class_id],
            conf=self.conf_thresh,
            verbose=False,
            device="cpu"
        )

        detections = []
        if results and len(results) > 0:
            boxes = results[0].boxes
            for box in boxes:
                xyxy = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())
                detections.append({
                    "bbox": [round(float(xyxy[0]), 2), round(float(xyxy[1]), 2), round(float(xyxy[2]), 2), round(float(xyxy[3]), 2)],
                    "confidence": round(conf, 3),
                    "class_id": self.person_class_id
                })

        return detections

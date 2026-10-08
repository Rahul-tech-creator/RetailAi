"""
FastAPI Server for Retail Spatial Intelligence Computer Vision Service.
Provides asynchronous video analysis, metadata inspection, and artifact serving.
"""
import os
import threading
import json
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import cv2

from pipeline import CVPipeline

app = FastAPI(title="Retail Spatial Intelligence CV Service", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global job store
JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()

class ProcessRequest(BaseModel):
    job_id: str
    video_path: str
    output_dir: str
    custom_zones: Optional[List[Dict[str, Any]]] = None
    frame_skip: Optional[int] = 2
    max_dimension: Optional[int] = 960
    min_track_duration_sec: Optional[float] = 1.0

class MetadataRequest(BaseModel):
    video_path: str

class FrameExtractRequest(BaseModel):
    video_path: str
    output_path: str

def run_pipeline_task(req: ProcessRequest):
    """Executes the pipeline in background thread with status updates."""
    job_id = req.job_id
    with JOBS_LOCK:
        JOBS[job_id] = {
            "job_id": job_id,
            "status": "PROCESSING",
            "stage": "Initializing computer vision pipeline",
            "percent": 0,
            "step": 0,
            "total_steps": 9,
            "error": None,
            "results": None
        }

    def progress_callback(stage: str, percent: int, step: int, total_steps: int):
        with JOBS_LOCK:
            if job_id in JOBS:
                JOBS[job_id]["stage"] = stage
                JOBS[job_id]["percent"] = percent
                JOBS[job_id]["step"] = step
                JOBS[job_id]["total_steps"] = total_steps

    try:
        pipeline = CVPipeline(
            model_path="yolov8n.pt",
            frame_skip=req.frame_skip or 2,
            max_dimension=req.max_dimension or 960,
            min_track_duration_sec=req.min_track_duration_sec or 1.0
        )
        results = pipeline.run(
            video_path=req.video_path,
            output_dir=req.output_dir,
            job_id=job_id,
            custom_zones=req.custom_zones,
            progress_callback=progress_callback
        )

        # Save results to json file in output_dir
        results_file = os.path.join(req.output_dir, f"{job_id}_analytics.json")
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)

        with JOBS_LOCK:
            JOBS[job_id]["status"] = "COMPLETED"
            JOBS[job_id]["stage"] = "Analysis complete"
            JOBS[job_id]["percent"] = 100
            JOBS[job_id]["results"] = results

    except Exception as e:
        import traceback
        traceback.print_exc()
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "FAILED"
            JOBS[job_id]["stage"] = "Processing failed"
            JOBS[job_id]["error"] = str(e)

@app.get("/")
@app.get("/health")
def health():
    return {"status": "ok", "service": "retail-cv-service", "version": "1.1.0"}

@app.post("/metadata")
def get_metadata(req: MetadataRequest):
    """Extracts duration, fps, resolution, and frame count from video."""
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    cap = cv2.VideoCapture(req.video_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Cannot open video file")

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = float(cap.get(cv2.CAP_PROP_FPS)) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    duration = round(frame_count / fps, 2) if fps > 0 else 0.0

    return {
        "width": w,
        "height": h,
        "resolution": f"{w}x{h}",
        "fps": round(fps, 2),
        "frame_count": frame_count,
        "duration_seconds": duration
    }

@app.post("/extract-frame")
def extract_frame(req: FrameExtractRequest):
    """Extracts middle frame as representative video frame."""
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    cap = cv2.VideoCapture(req.video_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Cannot open video file")

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    target_idx = max(0, frame_count // 4)
    cap.set(cv2.CAP_PROP_POS_FRAMES, target_idx)
    ret, frame = cap.read()
    if not ret or frame is None:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, frame = cap.read()

    cap.release()

    if not ret or frame is None:
        raise HTTPException(status_code=500, detail="Failed to extract frame")

    os.makedirs(os.path.dirname(os.path.abspath(req.output_path)), exist_ok=True)
    cv2.imwrite(req.output_path, frame)

    return {"status": "success", "output_path": req.output_path}

@app.post("/process")
def start_process(req: ProcessRequest, background_tasks: BackgroundTasks):
    """Starts asynchronous computer vision processing."""
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    with JOBS_LOCK:
        if req.job_id in JOBS and JOBS[req.job_id]["status"] == "PROCESSING":
            return {"job_id": req.job_id, "status": "ALREADY_PROCESSING"}

    # Run in background thread
    thread = threading.Thread(target=run_pipeline_task, args=(req,), daemon=True)
    thread.start()

    return {
        "job_id": req.job_id,
        "status": "PROCESSING",
        "stage": "Job queued for computer vision processing"
    }

@app.get("/status/{job_id}")
def get_status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job:
            return {
                "job_id": job["job_id"],
                "status": job["status"],
                "stage": job["stage"],
                "percent": job["percent"],
                "step": job["step"],
                "total_steps": job["total_steps"],
                "error": job["error"]
            }

    # If not in memory, check if output file exists on disk
    processed_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "processed"))
    results_file = os.path.join(processed_dir, f"{job_id}_analytics.json")
    if os.path.exists(results_file):
        return {
            "job_id": job_id,
            "status": "COMPLETED",
            "stage": "Analysis complete",
            "percent": 100,
            "step": 9,
            "total_steps": 9,
            "error": None
        }

    raise HTTPException(status_code=404, detail="Job not found")

@app.get("/results/{job_id}")
def get_results(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job:
            if job["status"] == "FAILED":
                raise HTTPException(status_code=500, detail=f"Job failed: {job.get('error')}")
            if job["status"] != "COMPLETED":
                return {"job_id": job_id, "status": job["status"], "results": None}
            return job["results"]

    # Fallback to file on disk
    processed_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "processed"))
    results_file = os.path.join(processed_dir, f"{job_id}_analytics.json")
    if os.path.exists(results_file):
        with open(results_file, "r", encoding="utf-8") as f:
            return json.load(f)

    raise HTTPException(status_code=404, detail="Job not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

"""
Master Computer Vision Pipeline Coordinator.
Orchestrates genuine detection, ByteTrack tracking, ground foot-point extraction,
zone dwell calculations, traffic time-series, 2D Gaussian heatmaps,
flow map transitions, customer journeys, bottlenecks, dead zones, and video annotation.
Outputs canonical single source of truth analytics result with full validation stats.
"""
import os
import time
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Callable, Tuple
from collections import defaultdict

from detector import PersonDetector
from tracker import MultiObjectTracker
from footpoint import get_footpoint
from zone_engine import prepare_zones, find_matching_zone
from dwell_engine import DwellTracker
from traffic_engine import TrafficTracker
from trajectory_engine import TrajectoryEngine
from heatmap_engine import HeatmapEngine
from bottleneck_engine import BottleneckEngine
from dead_zone_engine import DeadZoneEngine
from video_annotator import VideoAnnotator

class SpatialIntelligencePipeline:
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        frame_skip: int = 2,
        max_dimension: int = 960,
        min_track_duration_sec: float = 1.0,
        zone_exit_grace_sec: float = 0.6
    ):
        self.model_path = model_path
        self.frame_skip = max(1, frame_skip)
        self.max_dimension = max_dimension
        self.min_track_duration_sec = min_track_duration_sec
        self.zone_exit_grace_sec = zone_exit_grace_sec

    def run(
        self,
        video_path: str,
        output_dir: str,
        job_id: str,
        custom_zones: Optional[List[Dict[str, Any]]] = None,
        progress_callback: Optional[Callable[[str, int, int, int], None]] = None
    ) -> Dict[str, Any]:
        """
        Executes full CV pipeline on the input video.
        Returns complete canonical structured analytics payload.
        """
        start_wall_time = time.time()
        os.makedirs(output_dir, exist_ok=True)

        def report(stage: str, percent: int, step: int, total_steps: int = 9):
            if progress_callback:
                progress_callback(stage, percent, step, total_steps)

        # STAGE 1: Video Validation & Metadata Extraction
        report("Validating video file and extracting metadata", 5, 1)
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to open video file: {video_path}")

        orig_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS)) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames <= 0 or orig_width <= 0 or orig_height <= 0:
            cap.release()
            raise ValueError("Invalid video stream: zero frames or invalid dimensions.")

        duration_sec = round(total_frames / fps, 2)

        # Determine target processing dimensions
        scale = 1.0
        if max(orig_width, orig_height) > self.max_dimension:
            scale = self.max_dimension / float(max(orig_width, orig_height))
        proc_w = int(orig_width * scale)
        proc_h = int(orig_height * scale)
        proc_w = proc_w - (proc_w % 2)
        proc_h = proc_h - (proc_h % 2)

        # STAGE 2: Extract Representative Base Frame
        report("Extracting representative video frame", 12, 2)
        mid_frame_idx = max(0, total_frames // 4)
        cap.set(cv2.CAP_PROP_POS_FRAMES, mid_frame_idx)
        ret, rep_frame = cap.read()
        if not ret or rep_frame is None:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, rep_frame = cap.read()
            if not ret or rep_frame is None:
                cap.release()
                raise ValueError("Could not read frames from video.")

        rep_frame_resized = cv2.resize(rep_frame, (proc_w, proc_h))
        base_frame_path = os.path.join(output_dir, f"{job_id}_frame.jpg")
        cv2.imwrite(base_frame_path, rep_frame_resized)

        # STAGE 3: Zone Preparation (User zones scaled, or intelligent automatic camera regions)
        report("Configuring spatial zones and regions", 18, 3)
        scaled_custom_zones = None
        if custom_zones:
            scaled_custom_zones = []
            for z in custom_zones:
                orig_poly = z.get("polygon", [])
                scaled_poly = [[round(p[0] * scale, 1), round(p[1] * scale, 1)] for p in orig_poly]
                scaled_z = dict(z)
                scaled_z["polygon"] = scaled_poly
                scaled_custom_zones.append(scaled_z)

        active_zones, zone_notice, auto_conf = prepare_zones(scaled_custom_zones, proc_w, proc_h)
        zone_name_map = {z["id"]: z["name"] for z in active_zones}

        # Initialize engines
        tracker = MultiObjectTracker(
            model_path=self.model_path,
            conf_thresh=0.28,
            min_track_duration_sec=self.min_track_duration_sec,
            min_detections=3
        )
        dwell_engine = DwellTracker(
            tolerance_seconds=self.zone_exit_grace_sec,
            min_meaningful_dwell_sec=0.5
        )
        traffic_engine = TrafficTracker(fps=fps, duration=duration_sec)
        trajectory_engine = TrajectoryEngine(fps=fps)
        heatmap_engine = HeatmapEngine(width=proc_w, height=proc_h)
        annotator = VideoAnnotator(zones=active_zones, width=proc_w, height=proc_h)

        # Prepare Annotated Video Writer
        annotated_video_path = os.path.join(output_dir, f"{job_id}_annotated.mp4")
        effective_fps = max(1.0, fps / self.frame_skip)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(annotated_video_path, fourcc, effective_fps, (proc_w, proc_h))

        # Counters for Spatial Validation Panel
        total_footpoints = 0
        assigned_footpoints = 0
        unassigned_footpoints = 0
        zone_footpoint_counts = defaultdict(int)

        # STAGE 4 & 5: Person Tracking, Foot-Point, and Zone Assignment
        report("Executing person detection and ByteTrack tracking", 25, 4)
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        frame_idx = 0
        track_history_coords: Dict[int, List[Tuple[float, float]]] = {}

        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if frame_idx % self.frame_skip != 0:
                frame_idx += 1
                continue

            current_timestamp = round(frame_idx / fps, 2)
            frame_resized = cv2.resize(frame, (proc_w, proc_h))

            # Run Multi-Object Tracker
            active_tracks = tracker.track_frame(frame_resized, frame_idx, current_timestamp)

            frame_track_zone_map: Dict[int, Optional[str]] = {}

            for trk in active_tracks:
                t_id = trk["track_id"]
                foot_pt = trk["footpoint"]
                total_footpoints += 1

                # Zone assignment (bottom-center foot coordinate test)
                matched_zone_id = find_matching_zone(foot_pt, active_zones)
                frame_track_zone_map[t_id] = matched_zone_id

                if matched_zone_id is not None:
                    assigned_footpoints += 1
                    zone_footpoint_counts[matched_zone_id] += 1
                else:
                    unassigned_footpoints += 1

                # Update dwell tracker with exact timestamp
                dwell_engine.update(t_id, matched_zone_id, current_timestamp)

                # Record trajectory & relative speed
                trajectory_engine.record_point(t_id, frame_idx, current_timestamp, foot_pt, matched_zone_id)

                # Record footpoint for 2D Gaussian density heatmap
                heatmap_engine.add_point(foot_pt)

                # Update track history for video visualization trails
                if t_id not in track_history_coords:
                    track_history_coords[t_id] = []
                track_history_coords[t_id].append(foot_pt)

            # Record frame traffic occupancy and new arrivals
            traffic_engine.record_frame(frame_idx, frame_track_zone_map, current_timestamp)

            # Render annotations on frame
            annotated_frame = annotator.draw_zones(frame_resized.copy(), alpha=0.15)
            annotated_frame = annotator.draw_detections(annotated_frame, active_tracks, track_history_coords)
            video_writer.write(annotated_frame)

            # Update progress
            pct = 25 + int(50 * (frame_idx / max(1, total_frames)))
            if frame_idx % (self.frame_skip * 15) == 0:
                report(f"Tracking frame {frame_idx}/{total_frames} ({round(current_timestamp, 1)}s)", pct, 4)

            frame_idx += 1

        cap.release()
        video_writer.release()

        # Finalize dwell tracker sessions and finalize tracks
        dwell_engine.finalize()
        tracker.finalize_tracks(fps)

        # STAGE 6: Dwell, Traffic, and Valid Visitor Computation
        report("Calculating zone dwell times, occupancy, and tracking quality", 78, 5)
        tracking_quality = tracker.compute_quality_report(fps)
        valid_track_ids = tracker.get_valid_track_ids()

        unique_visitor_count = tracking_quality["valid_visitors_count"]
        store_peak_occ = traffic_engine.calculate_overall_peak_occupancy()
        store_avg_occ = traffic_engine.calculate_overall_average_occupancy()
        store_dwell_stats = dwell_engine.get_overall_dwell_statistics()
        speed_metrics = trajectory_engine.get_speed_metrics()

        store_stats = {
            "unique_visitors": unique_visitor_count,
            "peak_occupancy": store_peak_occ,
            "avg_occupancy": store_avg_occ,
            "avg_dwell": store_dwell_stats.get("avg_dwell", 0.0),
            "median_dwell": store_dwell_stats.get("median_dwell", 0.0),
            "overall_avg_speed_px_sec": speed_metrics.get("overall_avg_speed_px_sec", 0.0)
        }

        # Calculate all 12 Zone Statistics per zone with Normalized Area Metrics
        total_store_visits = max(1, store_dwell_stats.get("total_visits", 0))
        total_store_area = sum(z.get("area", 1.0) for z in active_zones) or 1.0
        total_frame_area = float(proc_w * proc_h)

        zone_statistics = []
        zone_dwell_map = {}
        zone_traffic_map = {}

        for zone in active_zones:
            z_id = zone["id"]
            z_area = zone.get("area", 1.0)
            z_dwell = dwell_engine.get_zone_dwell_statistics(z_id)
            z_traffic = traffic_engine.get_zone_traffic_summary(z_id, z_area)

            zone_dwell_map[z_id] = z_dwell
            zone_traffic_map[z_id] = z_traffic

            visits = z_dwell["visits"]
            unique_vis = z_traffic["unique_visitors"]
            traffic_share = round((visits / float(total_store_visits)) * 100.0, 1)

            # Area expected share vs actual traffic share
            expected_share = z_area / float(total_store_area)
            actual_share = visits / float(total_store_visits)
            relative_act = round((actual_share / max(0.01, expected_share)) * 100.0, 1)

            # Normalized measures per Section 5 & 8
            z_pts = zone_footpoint_counts.get(z_id, 0)
            act_density_100k = round((z_pts / max(0.01, z_area / 100000.0)), 2)
            visitors_per_min = round((unique_vis / max(0.1, duration_sec / 60.0)), 2)
            area_pct = round((z_area / max(1.0, total_frame_area)) * 100.0, 1)

            zone_statistics.append({
                "id": z_id,
                "name": zone["name"],
                "category": zone.get("category", "General"),
                "source": zone.get("source", "automatic"),
                "color": zone.get("color", "#10B981"),
                "polygon": zone.get("polygon", []),
                "area_px": round(z_area, 1),
                "area_pct_of_frame": area_pct,
                "foot_point_count": z_pts,
                "visits": visits,
                "unique_visitors": unique_vis,
                "entry_count": z_dwell.get("entry_count", visits),
                "exit_count": z_dwell.get("exit_count", visits),
                "avg_dwell_sec": z_dwell["avg_dwell"],
                "median_dwell_sec": z_dwell["median_dwell"],
                "max_dwell_sec": z_dwell["max_dwell"],
                "min_meaningful_dwell_sec": z_dwell.get("min_meaningful_dwell", 0.5),
                "peak_occupancy": z_traffic["peak_occupancy"],
                "avg_occupancy": z_traffic["avg_occupancy"],
                "traffic_share_pct": traffic_share,
                "relative_activity_pct": relative_act,
                "traffic_density": z_traffic["traffic_density"],
                "activity_density_100k": act_density_100k,
                "visitors_per_minute": visitors_per_min,
                "is_suspicious_size": zone.get("is_suspicious_size", False),
                "size_warning": zone.get("size_warning")
            })

        # STAGE 7: Generate Heatmap
        report("Generating spatial foot-traffic heatmap", 84, 6)
        heatmap_path = os.path.join(output_dir, f"{job_id}_heatmap.png")
        heatmap_result = heatmap_engine.generate_heatmap(
            base_frame_path=base_frame_path,
            output_heatmap_path=heatmap_path,
            blur_radius=41,
            alpha=0.60
        )

        # STAGE 8: Deterministic Bottlenecks & Dead Zones
        report("Evaluating bottlenecks and dead zones", 90, 7)
        bottleneck_engine = BottleneckEngine()
        bottlenecks = bottleneck_engine.detect_bottlenecks(
            zones=active_zones,
            zone_dwells=zone_dwell_map,
            zone_traffics=zone_traffic_map,
            zone_speeds=speed_metrics.get("zone_avg_speeds", {}),
            store_stats=store_stats
        )

        dead_zone_engine = DeadZoneEngine()
        dead_zones = dead_zone_engine.detect_dead_zones(
            zones=active_zones,
            zone_dwells=zone_dwell_map,
            zone_traffics=zone_traffic_map,
            store_stats=store_stats,
            duration_sec=duration_sec
        )

        # High-Activity Areas
        high_activity_areas = []
        for zs in sorted(zone_statistics, key=lambda x: (x["visits"], x["peak_occupancy"]), reverse=True):
            if zs["visits"] > 0:
                high_activity_areas.append({
                    "zone_name": zs["name"],
                    "visits": zs["visits"],
                    "unique_visitors": zs["unique_visitors"],
                    "avg_dwell_sec": zs["avg_dwell_sec"],
                    "peak_occupancy": zs["peak_occupancy"],
                    "traffic_share_pct": zs["traffic_share_pct"],
                    "traffic_density": zs["traffic_density"],
                    "activity_density_100k": zs["activity_density_100k"],
                    "status": "High Activity Corridor" if zs["visits"] >= 3 else "Moderate Activity Area"
                })

        # STAGE 9: Customer Flow Map, Journeys, and Trajectories
        report("Assembling Flow Map, trajectories, and customer journeys", 95, 8)
        flow_map = trajectory_engine.build_flow_map(active_zones, valid_track_ids)
        common_journeys = trajectory_engine.aggregate_common_journeys(zone_name_map, valid_track_ids)
        timelines_multi = traffic_engine.get_multiresolution_timelines()
        occupancy_timeline = timelines_multi.get("interval_1s", [])

        # Track summaries for Track Inspector
        tracks_summary = [
            trajectory_engine.get_track_summary(
                t_id,
                zone_name_map,
                is_valid=(t_id in valid_track_ids)
            )
            for t_id in tracker.all_seen_track_ids
        ]

        # Zone Rankings
        zone_rankings = {
            "most_visited": sorted(zone_statistics, key=lambda x: x["visits"], reverse=True),
            "highest_dwell": sorted(zone_statistics, key=lambda x: x["avg_dwell_sec"], reverse=True),
            "highest_activity": sorted(zone_statistics, key=lambda x: x["relative_activity_pct"], reverse=True),
            "peak_occupancy": sorted(zone_statistics, key=lambda x: x["peak_occupancy"], reverse=True)
        }

        # Analytics Confidence Assessment
        total_visits_observed = sum(z["visits"] for z in zone_statistics)
        zone_conf = "High" if total_visits_observed >= 6 else "Medium" if total_visits_observed >= 2 else "Low"
        b_conf = "High" if any(b.get("confidence") == "High" for b in bottlenecks) else "Medium" if bottlenecks else "Low"
        d_conf = "High" if any(d.get("confidence") == "High" for d in dead_zones) else "Medium"

        # Overall Analysis Quality rating per Section 22
        t_rating = tracking_quality.get("rating", "Limited")
        if "Good" in t_rating and duration_sec >= 20.0 and unique_visitor_count >= 4:
            overall_quality = "High"
            quality_notes = "High confidence: persistent tracking with broad spatial and duration coverage."
        elif unique_visitor_count >= 1 and duration_sec >= 10.0:
            overall_quality = "Medium"
            quality_notes = "Moderate confidence: verified customer visits observed; occasional occlusion or short observation window."
        else:
            overall_quality = "Limited"
            quality_notes = "Limited confidence: low customer density or brief observation window. Draw custom zones for refined intelligence."

        confidence_summary = {
            "overall_quality": overall_quality,
            "quality_notes": quality_notes,
            "tracking_confidence": tracking_quality.get("confidence_level", "Medium"),
            "zone_confidence": zone_conf,
            "bottleneck_confidence": b_conf,
            "dead_zone_confidence": d_conf,
            "sample_duration_seconds": duration_sec,
            "total_verified_visits": total_visits_observed
        }

        # Analytics Validation Panel Data (Section 2)
        tracking_validation = tracker.get_validation_metrics(frame_idx)
        total_zone_area = sum(z.get("area", 0.0) for z in active_zones)
        zone_cov_pct = round((total_zone_area / max(1.0, total_frame_area)) * 100.0, 1)

        validation_stats = {
            "detection": tracking_validation["detection"],
            "tracking": tracking_validation["tracking"],
            "spatial": {
                "foot_point_count": total_footpoints,
                "points_assigned_to_zones": assigned_footpoints,
                "unassigned_points": unassigned_footpoints,
                "zone_coverage_pct": zone_cov_pct
            },
            "analytics": {
                "unique_tracked_visitors": unique_visitor_count,
                "peak_occupancy": store_peak_occ,
                "avg_occupancy": store_avg_occ,
                "avg_dwell_sec": store_dwell_stats.get("avg_dwell", 0.0),
                "total_transitions": flow_map.get("total_transitions", 0),
                "bottleneck_candidates": len([b for b in bottlenecks if b.get("is_bottleneck")]),
                "dead_zone_candidates": len([d for d in dead_zones if d.get("is_dead_zone")])
            }
        }

        processing_wall_time = round(time.time() - start_wall_time, 2)

        processing_stats = {
            "processing_time_sec": processing_wall_time,
            "frame_skip": self.frame_skip,
            "processed_fps": round(effective_fps, 2),
            "frames_analyzed": frame_idx,
            "total_video_frames": total_frames,
            "processed_resolution": f"{proc_w}x{proc_h}",
            "original_resolution": f"{orig_width}x{orig_height}"
        }

        visitor_summary = {
            "unique_visitors": unique_visitor_count,
            "raw_tracks_detected": tracking_quality.get("raw_tracks_count", unique_visitor_count),
            "short_tracks_filtered": tracking_quality.get("short_tracks_filtered", 0),
            "total_zone_visits": total_store_visits,
            "peak_store_occupancy": store_peak_occ,
            "avg_store_occupancy": store_avg_occ,
            "avg_visit_duration_sec": tracking_quality.get("avg_track_duration_sec", 0.0),
            "longest_track_duration_sec": tracking_quality.get("longest_track_duration_sec", 0.0),
            "avg_dwell_time_sec": store_dwell_stats.get("avg_dwell", 0.0),
            "median_dwell_time_sec": store_dwell_stats.get("median_dwell", 0.0),
            "relative_speed": speed_metrics
        }

        heatmap_data = {
            "total_points": heatmap_result.get("total_points", 0),
            "max_density": heatmap_result.get("max_density", 0.0),
            "explanation": heatmap_result.get("explanation", "Heatmap represents observed customer foot-point activity during the analyzed period."),
            "heatmap_image_url": f"/api/analysis/{job_id}/heatmap",
            "base_frame_url": f"/api/analysis/{job_id}/frame",
            "overlay_image_url": f"/api/analysis/{job_id}/heatmap-overlay",
            "density_image_url": f"/api/analysis/{job_id}/heatmap-density",
            "sampled_foot_points": heatmap_result.get("sampled_foot_points", [])
        }

        video_metadata = {
            "filename": os.path.basename(video_path),
            "duration_seconds": duration_sec,
            "fps": round(fps, 2),
            "resolution": f"{orig_width}x{orig_height}",
            "processed_resolution": f"{proc_w}x{proc_h}",
            "frame_count": total_frames,
            "scale_factor": round(scale, 3)
        }

        report("Computer vision analysis complete", 100, 9)

        # Single Canonical Source of Truth
        analytics_result = {
            "job_id": job_id,
            "status": "COMPLETED",
            "videoMetadata": video_metadata,
            "video_metadata": video_metadata,
            "processingStats": processing_stats,
            "processing_stats": processing_stats,
            "trackingQuality": tracking_quality,
            "tracking_quality": tracking_quality,
            "visitorStats": visitor_summary,
            "visitor_summary": visitor_summary,
            "zoneStats": zone_statistics,
            "zone_statistics": zone_statistics,
            "dwellStats": store_dwell_stats,
            "trafficStats": {
                "peak_occupancy": store_peak_occ,
                "avg_occupancy": store_avg_occ,
                "total_visits": total_store_visits
            },
            "occupancyStats": {
                "peak_occupancy": store_peak_occ,
                "avg_occupancy": store_avg_occ,
                "timeline": occupancy_timeline
            },
            "journeyStats": {
                "patterns": common_journeys,
                "flow_map": flow_map
            },
            "journey_patterns": common_journeys,
            "flow_map": flow_map,
            "heatmapData": heatmap_data,
            "heatmap": heatmap_data,
            "bottleneckResults": bottlenecks,
            "bottlenecks": bottlenecks,
            "deadZoneResults": dead_zones,
            "dead_zones": dead_zones,
            "highActivityResults": high_activity_areas,
            "high_activity_areas": high_activity_areas,
            "zoneRankings": zone_rankings,
            "zone_rankings": zone_rankings,
            "analyticsConfidence": confidence_summary,
            "analytics_confidence": confidence_summary,
            "validationStats": validation_stats,
            "validation_stats": validation_stats,
            "occupancy_timeline": occupancy_timeline,
            "timelines": timelines_multi,
            "tracks": tracks_summary,
            "zone_system": {
                "source": "user" if custom_zones and len(custom_zones) > 0 else "automatic",
                "notice": zone_notice,
                "zones": active_zones
            },
            "limitations": tracking_quality.get("limitations", []),
            "annotated_video_url": f"/api/analysis/{job_id}/video"
        }

        return analytics_result

# Backwards compatibility alias
CVPipeline = SpatialIntelligencePipeline

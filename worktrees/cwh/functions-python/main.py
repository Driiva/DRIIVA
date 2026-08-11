"""
DRIIVA PYTHON CLOUD FUNCTIONS
=============================
Python-based Cloud Functions for Driiva telematics app.

Functions:
  - classify_trip: Integrates RGreinacher/Stop-Go-Classifier for intelligent
    trip segmentation and stop detection from raw GPS data.
"""

import json
import logging
from datetime import datetime
from typing import Any

import firebase_admin
import functions_framework
import numpy as np
import pandas as pd
from firebase_admin import credentials, firestore
from flask import Request, jsonify
from pyproj import Transformer

from stop_go_classifier import StopGoClassifier

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()


# =============================================================================
# COORDINATE PROJECTION
# =============================================================================

def project_coordinates(
    lats: np.ndarray,
    lngs: np.ndarray,
    center_lat: float,
    center_lng: float
) -> tuple[np.ndarray, np.ndarray]:
    """
    Project GPS coordinates (lat/lng) to planar coordinates (meters).
    
    The Stop-Go-Classifier requires planar (x, y) coordinates, not spherical.
    We use a local UTM projection centered on the trip's centroid.
    
    Args:
        lats: Array of latitudes
        lngs: Array of longitudes
        center_lat: Center latitude for projection
        center_lng: Center longitude for projection
    
    Returns:
        Tuple of (x_meters, y_meters) arrays
    """
    # Determine UTM zone from center longitude
    utm_zone = int((center_lng + 180) / 6) + 1
    hemisphere = 'north' if center_lat >= 0 else 'south'
    
    # Create transformer from WGS84 to UTM
    transformer = Transformer.from_crs(
        "EPSG:4326",  # WGS84 (lat/lng)
        f"EPSG:326{utm_zone:02d}" if hemisphere == 'north' else f"EPSG:327{utm_zone:02d}",
        always_xy=True
    )
    
    # Transform coordinates (note: pyproj expects lng, lat order)
    x_meters, y_meters = transformer.transform(lngs, lats)
    
    return np.array(x_meters), np.array(y_meters)


# =============================================================================
# STOP-GO CLASSIFICATION
# =============================================================================

def classify_gps_points(
    points: list[dict],
    settings: dict | None = None
) -> dict[str, Any]:
    """
    Classify GPS points into stops and trips using Stop-Go-Classifier.
    
    Args:
        points: List of GPS point dicts with keys:
            - lat: Latitude
            - lng: Longitude  
            - ts: Timestamp (ISO string or epoch ms)
            - speed: Speed in m/s (optional)
        settings: Optional classifier settings override
    
    Returns:
        Dict containing:
            - stops: List of detected stop intervals
            - trips: List of detected trip segments
            - samples: Classified samples with labels
            - summary: Summary statistics
    """
    if len(points) < 2:
        return {
            'stops': [],
            'trips': [],
            'samples': [],
            'summary': {
                'total_points': len(points),
                'total_stops': 0,
                'total_trips': 0,
                'classification_success': False,
                'error': 'Insufficient points for classification'
            }
        }
    
    # Convert points to DataFrame
    df = pd.DataFrame(points)
    
    # Parse timestamps
    if 'ts' in df.columns:
        if df['ts'].dtype == 'object':
            # ISO string format
            df['timestamp'] = pd.to_datetime(df['ts'])
        else:
            # Epoch milliseconds
            df['timestamp'] = pd.to_datetime(df['ts'], unit='ms')
    elif 't' in df.columns:
        # Offset format (seconds from start)
        df['timestamp'] = pd.to_datetime(df['t'], unit='s', origin='unix')
    
    # Extract coordinates
    lats = df['lat'].values.astype(float)
    lngs = df['lng'].values.astype(float)
    
    # Calculate center for projection
    center_lat = np.mean(lats)
    center_lng = np.mean(lngs)
    
    # Project to planar coordinates
    x_meters, y_meters = project_coordinates(lats, lngs, center_lat, center_lng)
    
    # Convert timestamps to seconds since start
    timestamps = df['timestamp'].values.astype('datetime64[s]').astype(float)
    
    # Initialize classifier with custom settings
    default_settings = {
        'MIN_STOP_INTERVAL': 60,  # 1 minute minimum stop
        'MIN_DISTANCE_BETWEEN_STOP': 50,  # 50 meters
        'MIN_TIME_BETWEEN_STOPS': 30,  # 30 seconds
        'RELEVANT_TIME_BETWEEN_STOPS': 120,  # 2 minutes
        'MAX_TIME_BETWEEN_STOPS_FOR_MERGE': 300,  # 5 minutes
    }
    
    if settings:
        default_settings.update(settings)
    
    classifier = StopGoClassifier(overwrite_settings=default_settings)
    
    # Run classification
    try:
        classifier.read(timestamps, x_meters, y_meters)
        stops_df = classifier.run()
        
        # Extract results
        stops = []
        if stops_df is not None and len(stops_df) > 0:
            for _, row in stops_df.iterrows():
                stop = {
                    'start_time': float(row.get('start_time', row.get('start', 0))),
                    'end_time': float(row.get('end_time', row.get('end', 0))),
                    'duration_seconds': float(row.get('duration', 0)),
                    'center_x': float(row.get('center_x', row.get('x', 0))),
                    'center_y': float(row.get('center_y', row.get('y', 0))),
                }
                stops.append(stop)
        
        trips = []
        if hasattr(classifier, 'trip_df') and classifier.trip_df is not None:
            for _, row in classifier.trip_df.iterrows():
                trip = {
                    'start_time': float(row.get('start_time', row.get('start', 0))),
                    'end_time': float(row.get('end_time', row.get('end', 0))),
                    'duration_seconds': float(row.get('duration', 0)),
                }
                trips.append(trip)
        
        # Get classified samples
        samples = []
        if hasattr(classifier, 'samples_df') and classifier.samples_df is not None:
            for _, row in classifier.samples_df.iterrows():
                sample = {
                    'timestamp': float(row.get('ts', 0)),
                    'x': float(row.get('x', 0)),
                    'y': float(row.get('y', 0)),
                    'label': str(row.get('label', 'unknown')),
                    'is_stop': bool(row.get('is_stop', row.get('label', '') == 'stop')),
                }
                samples.append(sample)
        
        return {
            'stops': stops,
            'trips': trips,
            'samples': samples,
            'summary': {
                'total_points': len(points),
                'total_stops': len(stops),
                'total_trips': len(trips),
                'classification_success': True,
                'center_lat': center_lat,
                'center_lng': center_lng,
            }
        }
        
    except Exception as e:
        logger.error(f"Classification error: {e}")
        return {
            'stops': [],
            'trips': [],
            'samples': [],
            'summary': {
                'total_points': len(points),
                'total_stops': 0,
                'total_trips': 0,
                'classification_success': False,
                'error': str(e)
            }
        }


# =============================================================================
# CLOUD FUNCTION ENDPOINTS
# =============================================================================

@functions_framework.http
def classify_trip(request: Request):
    """
    HTTP Cloud Function to classify a trip's GPS points.
    
    Request body:
        {
            "trip_id": "abc123",
            "points": [
                {"lat": 37.7749, "lng": -122.4194, "ts": 1706745600000, "speed": 5.2},
                ...
            ],
            "settings": {  // optional
                "MIN_STOP_INTERVAL": 60,
                ...
            }
        }
    
    Response:
        {
            "success": true,
            "trip_id": "abc123",
            "classification": {
                "stops": [...],
                "trips": [...],
                "samples": [...],
                "summary": {...}
            }
        }
    """
    # Handle CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    headers = {'Access-Control-Allow-Origin': '*'}
    
    try:
        data = request.get_json(silent=True)
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request body'
            }), 400, headers
        
        trip_id = data.get('trip_id')
        points = data.get('points', [])
        settings = data.get('settings')
        
        if not trip_id:
            return jsonify({
                'success': False,
                'error': 'Missing trip_id'
            }), 400, headers
        
        if not points or len(points) < 2:
            return jsonify({
                'success': False,
                'error': 'Insufficient GPS points (minimum 2 required)'
            }), 400, headers
        
        logger.info(f"Classifying trip {trip_id} with {len(points)} points")
        
        # Run classification
        classification = classify_gps_points(points, settings)
        
        logger.info(f"Classification complete for trip {trip_id}: "
                   f"{classification['summary']['total_stops']} stops, "
                   f"{classification['summary']['total_trips']} trips")
        
        return jsonify({
            'success': True,
            'trip_id': trip_id,
            'classification': classification
        }), 200, headers
        
    except Exception as e:
        logger.error(f"Error in classify_trip: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500, headers


@functions_framework.http
def classify_trip_from_firestore(request: Request):
    """
    HTTP Cloud Function to classify a trip by reading points from Firestore.
    
    This is the main entry point called by TypeScript Cloud Functions after
    trip recording ends.
    
    Request body:
        {
            "trip_id": "abc123",
            "user_id": "user456",
            "save_results": true,  // optional, default true
            "settings": {...}      // optional classifier settings
        }
    
    Response:
        {
            "success": true,
            "trip_id": "abc123",
            "classification": {...},
            "saved": true
        }
    """
    # Handle CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    headers = {'Access-Control-Allow-Origin': '*'}
    
    try:
        data = request.get_json(silent=True)
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request body'
            }), 400, headers
        
        trip_id = data.get('trip_id')
        user_id = data.get('user_id')
        save_results = data.get('save_results', True)
        settings = data.get('settings')
        
        if not trip_id:
            return jsonify({
                'success': False,
                'error': 'Missing trip_id'
            }), 400, headers
        
        logger.info(f"Reading GPS points for trip {trip_id} from Firestore")
        
        # Read trip points from Firestore
        points_ref = db.collection('tripPoints').document(trip_id)
        points_doc = points_ref.get()
        
        if not points_doc.exists:
            return jsonify({
                'success': False,
                'error': f'No trip points found for trip {trip_id}'
            }), 404, headers
        
        points_data = points_doc.to_dict()
        points = points_data.get('points', [])
        
        # If points are batched, read from subcollection
        if not points or len(points) == 0:
            batches_ref = points_ref.collection('batches').order_by('batchIndex')
            batches = batches_ref.get()
            
            points = []
            for batch in batches:
                batch_data = batch.to_dict()
                if batch_data.get('points'):
                    points.extend(batch_data['points'])
        
        if len(points) < 2:
            return jsonify({
                'success': False,
                'error': 'Insufficient GPS points in Firestore'
            }), 400, headers
        
        logger.info(f"Found {len(points)} GPS points for trip {trip_id}")
        
        # Run classification
        classification = classify_gps_points(points, settings)
        
        # Save results to Firestore if requested
        saved = False
        if save_results and classification['summary']['classification_success']:
            try:
                # Save to tripSegments collection
                segments_ref = db.collection('tripSegments').document(trip_id)
                segments_ref.set({
                    'tripId': trip_id,
                    'userId': user_id,
                    'stops': classification['stops'],
                    'trips': classification['trips'],
                    'summary': classification['summary'],
                    'classifiedAt': firestore.SERVER_TIMESTAMP,
                    'classifierVersion': '1.0.0',
                })
                
                # Update trip document with segment summary
                trip_ref = db.collection('trips').document(trip_id)
                trip_ref.update({
                    'segmentation': {
                        'totalStops': classification['summary']['total_stops'],
                        'totalSegments': classification['summary']['total_trips'],
                        'classifiedAt': firestore.SERVER_TIMESTAMP,
                    }
                })
                
                saved = True
                logger.info(f"Saved classification results for trip {trip_id}")
                
            except Exception as e:
                logger.error(f"Error saving classification results: {e}")
        
        return jsonify({
            'success': True,
            'trip_id': trip_id,
            'classification': classification,
            'saved': saved
        }), 200, headers
        
    except Exception as e:
        logger.error(f"Error in classify_trip_from_firestore: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500, headers


@functions_framework.http
def health(request: Request):
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'driiva-trip-classifier',
        'version': '1.0.0'
    }), 200

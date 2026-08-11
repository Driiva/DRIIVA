# Driiva Python Cloud Functions

Python-based Cloud Functions for intelligent trip detection using the Stop-Go-Classifier.

## Overview

This package contains Python Cloud Functions that integrate the [RGreinacher/Stop-Go-Classifier](https://github.com/RGreinacher/Stop-Go-Classifier) for intelligent stop and trip detection from GPS trajectories.

## Functions

### `classify_trip`
Classifies GPS points into stops and trip segments.

**Request Body:**
```json
{
  "trip_id": "abc123",
  "points": [
    {"lat": 37.7749, "lng": -122.4194, "ts": 1706745600000, "speed": 5.2},
    ...
  ],
  "settings": {
    "MIN_STOP_INTERVAL": 60,
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "trip_id": "abc123",
  "classification": {
    "stops": [...],
    "trips": [...],
    "samples": [...],
    "summary": {
      "total_points": 1500,
      "total_stops": 3,
      "total_trips": 4,
      "classification_success": true
    }
  }
}
```

### `classify_trip_from_firestore`
Reads GPS points from Firestore and classifies them.

**Request Body:**
```json
{
  "trip_id": "abc123",
  "user_id": "user456",
  "save_results": true,
  "settings": {...}
}
```

### `health`
Health check endpoint.

## Deployment

### Prerequisites
- Python 3.11+
- Firebase CLI with Python functions support
- Google Cloud SDK

### Deploy

```bash
# From the functions-python directory
firebase deploy --only functions:classify_trip,functions:classify_trip_from_firestore,functions:health
```

### Configuration

Set the classifier URL in the main TypeScript functions:

```bash
firebase functions:config:set classifier.url="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net"
```

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run locally with functions-framework
functions-framework --target=classify_trip --debug
```

## Algorithm

The Stop-Go-Classifier uses multiple analysis methods:

1. **Motion Score** - Uses accelerometer data (if available)
2. **Rectangle Distance Ratio** - Geometric analysis of trajectory shape
3. **Bearing Analysis** - Direction changes detection
4. **Start-End Distance** - Distance between path start and end
5. **Intersecting Segments** - Path self-intersection analysis
6. **Missing Data Analysis** - Gap detection in GPS data

These methods vote to classify each GPS sample as "stop" or "trip", then results are aggregated into intervals.

## Citation

```bibtex
@article{spang2022stopgofoss4g,
  title={Making Sense of the Noise: Integrating Multiple Analyses for Stop and Trip Classification},
  author={Spang, Robert P. and Pieper, Kerstin and Oesterle, Benjamin and Brauer, Max and Haeger, Christine and Mümken, Sandra and Gellert, Paul and Voigt-Antons, Jan-Niklas},
  journal={Proceedings of FOSS4G, Florence, Italy},
  year={2022}
}
```

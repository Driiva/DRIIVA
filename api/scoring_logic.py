"""
Trip scoring: the mock XGBoost score, its Firestore persistence and the
rolling average. Extracted verbatim from api/main.py.
"""

from datetime import datetime, timedelta
from fastapi import HTTPException

from firestore_client import get_db
from models import ScoreBreakdown, TripInput

# ============ Trip Scoring Logic ============

def calculate_trip_score(trip: TripInput) -> tuple[float, ScoreBreakdown]:
    """
    Calculate the score for a single trip using rule-based XGBoost approximation.
    
    Scoring Logic:
    base_score = 100
    harsh_brake_penalty = harsh_brakes * 2
    speeding_penalty = speeding_incidents * 3
    night_penalty = (night_driving_minutes / 60) * 1.5
    phone_penalty = phone_usage_minutes * 4
    variance_penalty = speed_variance * 0.5
    
    final_score = max(0, min(100, base_score - sum(all_penalties)))
    """
    base_score = 100.0
    
    harsh_brake_penalty = trip.harsh_brakes * 2.0
    speeding_penalty = trip.speeding_incidents * 3.0
    night_penalty = (trip.night_driving_minutes / 60.0) * 1.5
    phone_penalty = trip.phone_usage_minutes * 4.0
    variance_penalty = trip.speed_variance * 0.5
    
    total_penalty = (
        harsh_brake_penalty +
        speeding_penalty +
        night_penalty +
        phone_penalty +
        variance_penalty
    )
    
    final_score = max(0.0, min(100.0, base_score - total_penalty))
    
    breakdown = ScoreBreakdown(
        base_score=base_score,
        harsh_brake_penalty=round(harsh_brake_penalty, 2),
        speeding_penalty=round(speeding_penalty, 2),
        night_penalty=round(night_penalty, 2),
        phone_penalty=round(phone_penalty, 2),
        variance_penalty=round(variance_penalty, 2),
        total_penalty=round(total_penalty, 2)
    )
    
    return round(final_score, 2), breakdown


def get_trip_date(trip: TripInput) -> str:
    """Get the trip date, defaulting to today if not provided."""
    if trip.trip_date:
        return trip.trip_date
    return datetime.now().strftime("%Y-%m-%d")


async def store_trip_score(driver_id: str, trip_date: str, score: float, breakdown: ScoreBreakdown) -> None:
    """Store a trip score in Firestore. Raises HTTPException on failure."""
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    try:
        doc_ref = db.collection("trip_scores").document(f"{driver_id}_{trip_date}")
        doc_ref.set({
            "driver_id": driver_id,
            "trip_date": trip_date,
            "score": score,
            "breakdown": breakdown.model_dump(),
            "created_at": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store trip score: {str(e)}")


async def get_rolling_average(driver_id: str, days: int = 30, require_db: bool = True) -> tuple[float, int, list]:
    """Get the rolling average score for a driver over the specified number of days."""
    db = get_db()
    if db is None:
        if require_db:
            raise HTTPException(
                status_code=503,
                detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
            )
        return 0.0, 0, []
    
    try:
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        scores_ref = db.collection("trip_scores")
        query = scores_ref.where("driver_id", "==", driver_id).where("trip_date", ">=", cutoff_date)
        docs = query.stream()
        
        scores = []
        history = []
        for doc in docs:
            data = doc.to_dict()
            if data and "score" in data:
                scores.append(data["score"])
                history.append({
                    "date": data.get("trip_date"),
                    "score": data.get("score")
                })
        
        if not scores:
            return 0.0, 0, []
        
        history.sort(key=lambda x: x["date"], reverse=True)
        return round(sum(scores) / len(scores), 2), len(scores), history[:10]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get rolling average: {str(e)}")


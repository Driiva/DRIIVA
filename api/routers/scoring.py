"""
Trip scoring endpoints. Extracted verbatim from api/main.py; paths, tags and
response models are unchanged.
"""

from fastapi import APIRouter, HTTPException

from models import (
    BatchTripInput,
    BatchTripScoreResponse,
    DriverScoreResponse,
    TripInput,
    TripScoreResponse,
)
from scoring_logic import (
    calculate_trip_score,
    get_rolling_average,
    get_trip_date,
    store_trip_score,
)

router = APIRouter()

@router.post("/score-trip", response_model=TripScoreResponse, tags=["Risk Scoring"])
async def score_single_trip(trip: TripInput):
    """
    Process and score a single trip using mock XGBoost behavior.
    
    Scoring penalties:
    - Harsh brakes: 2 points per incident
    - Speeding: 3 points per incident
    - Night driving: 1.5 points per hour
    - Phone usage: 4 points per minute
    - Speed variance: 0.5 points per variance unit
    
    Stores the daily score in Firestore and returns the rolling 30-day average.
    Requires Firestore to be configured.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    trip_date = get_trip_date(trip)
    daily_score, breakdown = calculate_trip_score(trip)
    
    await store_trip_score(trip.driver_id, trip_date, daily_score, breakdown)
    
    rolling_avg, trips_count, _ = await get_rolling_average(trip.driver_id, require_db=True)
    
    if trips_count == 0:
        rolling_avg = daily_score
        trips_count = 1
    
    return TripScoreResponse(
        driver_id=trip.driver_id,
        trip_date=trip_date,
        daily_score=daily_score,
        rolling_avg=rolling_avg,
        breakdown=breakdown,
        trips_in_period=trips_count
    )


@router.get("/driver-score/{driver_id}", response_model=DriverScoreResponse, tags=["Risk Scoring"])
async def get_driver_score(driver_id: str):
    """
    Retrieve the current score and 30-day rolling average for a driver.
    
    Returns the most recent daily score, rolling average, and score history.
    Requires Firestore to be configured.
    """
    rolling_avg, trips_count, history = await get_rolling_average(driver_id, require_db=True)
    
    if trips_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No trip scores found for driver {driver_id}"
        )
    
    current_score = history[0]["score"] if history else rolling_avg
    last_trip_date = history[0]["date"] if history else None
    
    return DriverScoreResponse(
        driver_id=driver_id,
        current_score=current_score,
        rolling_avg=rolling_avg,
        trips_in_period=trips_count,
        last_trip_date=last_trip_date,
        score_history=history
    )


@router.post("/batch-score", response_model=BatchTripScoreResponse, tags=["Risk Scoring"])
async def batch_score_trips(request: BatchTripInput):
    """
    Process and score multiple trips in batch.
    
    Each trip is scored individually and stored in Firestore.
    Returns individual results for each trip plus any errors encountered.
    Requires Firestore to be configured.
    """
    if not request.trips:
        raise HTTPException(status_code=400, detail="At least one trip is required")
    
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    results = []
    errors = []
    
    for i, trip in enumerate(request.trips):
        try:
            trip_date = get_trip_date(trip)
            daily_score, breakdown = calculate_trip_score(trip)
            
            await store_trip_score(trip.driver_id, trip_date, daily_score, breakdown)
            
            rolling_avg, trips_count, _ = await get_rolling_average(trip.driver_id, require_db=True)
            
            if trips_count == 0:
                rolling_avg = daily_score
                trips_count = 1
            
            results.append(TripScoreResponse(
                driver_id=trip.driver_id,
                trip_date=trip_date,
                daily_score=daily_score,
                rolling_avg=rolling_avg,
                breakdown=breakdown,
                trips_in_period=trips_count
            ))
        except HTTPException as e:
            errors.append(f"Trip {i} ({trip.driver_id}): {e.detail}")
        except Exception as e:
            errors.append(f"Trip {i} ({trip.driver_id}): {str(e)}")
    
    return BatchTripScoreResponse(
        processed_count=len(results),
        results=results,
        errors=errors
    )

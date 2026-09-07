"""
Request and response models for the refund calculator and the mock risk
scorer. Extracted verbatim from api/main.py.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

# ============ Pydantic Models ============

class RefundRequest(BaseModel):
    """Request model for single driver refund calculation."""
    personal_score: float = Field(..., ge=0, le=100, description="Individual driver's annual driving score (0-100)")
    pool_safety_factor: float = Field(..., ge=0, le=1, description="Percentage of drivers with score ≥80 (0-1)")
    surplus_ratio: float = Field(..., ge=0, description="Total surplus / Target refund pool (capped at 1)")
    annual_premium: float = Field(..., gt=0, description="Driver's yearly premium in GBP")

    @field_validator('surplus_ratio')
    @classmethod
    def cap_surplus_ratio(cls, v):
        """Cap surplus_ratio at 1."""
        return min(v, 1.0)


class RefundResponse(BaseModel):
    """Response model for refund calculation."""
    eligible: bool = Field(..., description="Whether the driver is eligible for a refund")
    refund_rate: float = Field(..., description="The calculated refund rate (0-0.15)")
    refund_amount: float = Field(..., description="The refund amount in GBP")
    net_cost: float = Field(..., description="Net cost after refund (annual_premium - refund_amount)")


class DriverInput(BaseModel):
    """Input model for a driver in batch calculation."""
    driver_id: str = Field(..., description="Unique identifier for the driver")
    personal_score: float = Field(..., ge=0, le=100, description="Individual driver's annual driving score (0-100)")
    annual_premium: float = Field(..., gt=0, description="Driver's yearly premium in GBP")


class BatchRefundRequest(BaseModel):
    """Request model for batch refund calculation."""
    drivers: List[DriverInput] = Field(..., description="List of drivers to calculate refunds for")
    pool_safety_factor: Optional[float] = Field(None, ge=0, le=1, description="Override pool safety factor (0-1). If not provided, calculated from Firestore.")
    surplus_ratio: float = Field(..., ge=0, description="Total surplus / Target refund pool (capped at 1)")

    @field_validator('surplus_ratio')
    @classmethod
    def cap_surplus_ratio(cls, v):
        """Cap surplus_ratio at 1."""
        return min(v, 1.0)


class DriverRefundResult(BaseModel):
    """Result model for a single driver in batch calculation."""
    driver_id: str
    eligible: bool
    refund_rate: float
    refund_amount: float
    net_cost: float
    personal_score: float
    annual_premium: float


class BatchRefundResponse(BaseModel):
    """Response model for batch refund calculation."""
    pool_safety_factor: float = Field(..., description="The pool safety factor used in calculations")
    surplus_ratio: float = Field(..., description="The surplus ratio used in calculations")
    total_refund_amount: float = Field(..., description="Total refund amount for all eligible drivers")
    eligible_count: int = Field(..., description="Number of eligible drivers")
    total_count: int = Field(..., description="Total number of drivers")
    results: List[DriverRefundResult] = Field(..., description="Individual refund results for each driver")


class DriverScore(BaseModel):
    """Model for storing/retrieving driver scores."""
    driver_id: str = Field(..., description="Unique identifier for the driver")
    personal_score: float = Field(..., ge=0, le=100, description="Driver's annual driving score")
    annual_premium: float = Field(..., gt=0, description="Driver's yearly premium in GBP")


class PoolStats(BaseModel):
    """Model for pool statistics."""
    total_drivers: int
    drivers_above_80: int
    pool_safety_factor: float
    average_score: float


# ============ Trip Scoring Models (Mock XGBoost) ============

class TripInput(BaseModel):
    """Input model for a single trip to be scored."""
    driver_id: str = Field(..., description="Unique identifier for the driver")
    harsh_brakes: int = Field(default=0, ge=0, description="Count of harsh braking events")
    speeding_incidents: int = Field(default=0, ge=0, description="Count of speeding incidents")
    night_driving_minutes: int = Field(default=0, ge=0, description="Minutes of night driving")
    phone_usage_minutes: int = Field(default=0, ge=0, description="Minutes of phone usage while driving")
    speed_variance: float = Field(default=0, ge=0, le=100, description="Speed variance on 0-100 scale")
    trip_distance_km: float = Field(default=0, ge=0, description="Trip distance in kilometers")
    trip_date: Optional[str] = Field(default=None, description="Trip date (YYYY-MM-DD format). Defaults to today.")

    @field_validator('trip_date')
    @classmethod
    def validate_trip_date(cls, v):
        """Validate and normalize trip_date to YYYY-MM-DD format."""
        if v is None:
            return None
        try:
            parsed = datetime.strptime(v, "%Y-%m-%d")
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            raise ValueError("trip_date must be in YYYY-MM-DD format")


class ScoreBreakdown(BaseModel):
    """Breakdown of penalties applied to the score."""
    base_score: float = Field(default=100.0, description="Starting base score")
    harsh_brake_penalty: float = Field(..., description="Penalty for harsh braking")
    speeding_penalty: float = Field(..., description="Penalty for speeding incidents")
    night_penalty: float = Field(..., description="Penalty for night driving")
    phone_penalty: float = Field(..., description="Penalty for phone usage")
    variance_penalty: float = Field(..., description="Penalty for speed variance")
    total_penalty: float = Field(..., description="Sum of all penalties")


class TripScoreResponse(BaseModel):
    """Response model for trip scoring."""
    driver_id: str
    trip_date: str
    daily_score: float = Field(..., description="Score for this trip (0-100)")
    rolling_avg: float = Field(..., description="30-day rolling average score")
    breakdown: ScoreBreakdown
    trips_in_period: int = Field(..., description="Number of trips in the 30-day period")


class BatchTripInput(BaseModel):
    """Input model for batch trip scoring."""
    trips: List[TripInput] = Field(..., description="List of trips to score")


class BatchTripScoreResponse(BaseModel):
    """Response model for batch trip scoring."""
    processed_count: int
    results: List[TripScoreResponse]
    errors: List[str] = Field(default_factory=list)


class DriverScoreResponse(BaseModel):
    """Response model for driver's current score."""
    driver_id: str
    current_score: float = Field(..., description="Most recent daily score")
    rolling_avg: float = Field(..., description="30-day rolling average score")
    trips_in_period: int = Field(..., description="Number of trips in the 30-day period")
    last_trip_date: Optional[str] = Field(None, description="Date of the most recent trip")
    score_history: List[Dict[str, Any]] = Field(default_factory=list, description="Recent score history")


"""
Health and the two pure calculator endpoints. Extracted verbatim from
api/main.py; paths, tags and response models are unchanged.
"""

from fastapi import APIRouter, HTTPException

from firestore_client import get_db
from models import (
    BatchRefundRequest,
    BatchRefundResponse,
    DriverRefundResult,
    RefundRequest,
    RefundResponse,
)
from refund_logic import calculate_pool_safety_factor, calculate_refund

router = APIRouter()

@router.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Driiva Refund Calculator API",
        "version": "1.0.0",
        "firestore_connected": get_db() is not None
    }


@router.post("/calculate-refund", response_model=RefundResponse, tags=["Refund Calculator"])
async def calculate_single_refund(request: RefundRequest):
    """
    Calculate refund for a single driver.
    
    - **personal_score**: Individual driver's annual driving score (0-100)
    - **pool_safety_factor**: Percentage of drivers with score ≥80 (0-1)
    - **surplus_ratio**: Total surplus / Target refund pool (capped at 1)
    - **annual_premium**: Driver's yearly premium in GBP
    
    Returns eligibility status, refund rate, refund amount, and net cost.
    """
    return calculate_refund(
        personal_score=request.personal_score,
        pool_safety_factor=request.pool_safety_factor,
        surplus_ratio=request.surplus_ratio,
        annual_premium=request.annual_premium
    )


@router.post("/calculate-pool-refunds", response_model=BatchRefundResponse, tags=["Refund Calculator"])
async def calculate_batch_refunds(request: BatchRefundRequest):
    """
    Calculate refunds for a batch of drivers.
    
    - **drivers**: List of drivers with driver_id, personal_score, and annual_premium
    - **pool_safety_factor**: Optional override. If not provided, calculated from the batch.
    - **surplus_ratio**: Total surplus / Target refund pool (capped at 1)
    
    Returns individual results for each driver plus aggregate statistics.
    """
    if not request.drivers:
        raise HTTPException(status_code=400, detail="At least one driver is required")
    
    # Calculate pool safety factor from batch if not provided
    if request.pool_safety_factor is not None:
        pool_safety_factor = request.pool_safety_factor
    else:
        scores = [driver.personal_score for driver in request.drivers]
        pool_safety_factor = calculate_pool_safety_factor(scores)
    
    # Calculate refunds for each driver
    results = []
    total_refund = 0.0
    eligible_count = 0
    
    for driver in request.drivers:
        refund_result = calculate_refund(
            personal_score=driver.personal_score,
            pool_safety_factor=pool_safety_factor,
            surplus_ratio=request.surplus_ratio,
            annual_premium=driver.annual_premium
        )
        
        results.append(DriverRefundResult(
            driver_id=driver.driver_id,
            eligible=refund_result.eligible,
            refund_rate=refund_result.refund_rate,
            refund_amount=refund_result.refund_amount,
            net_cost=refund_result.net_cost,
            personal_score=driver.personal_score,
            annual_premium=driver.annual_premium
        ))
        
        if refund_result.eligible:
            total_refund += refund_result.refund_amount
            eligible_count += 1
    
    return BatchRefundResponse(
        pool_safety_factor=pool_safety_factor,
        surplus_ratio=min(request.surplus_ratio, 1.0),
        total_refund_amount=round(total_refund, 2),
        eligible_count=eligible_count,
        total_count=len(request.drivers),
        results=results
    )


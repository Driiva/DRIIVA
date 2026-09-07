"""
Firestore-backed driver management, pool statistics and the batch refund run
that reads its scores from Firestore. Extracted verbatim from api/main.py;
paths, tags and response models are unchanged.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException

from firestore_client import get_db
from models import (
    BatchRefundResponse,
    DriverRefundResult,
    DriverScore,
    PoolStats,
)
from refund_logic import calculate_pool_safety_factor, calculate_refund

router = APIRouter()

@router.post("/drivers", tags=["Driver Management"])
async def store_driver_score(driver: DriverScore):
    """
    Store or update a driver's score in Firestore.
    
    - **driver_id**: Unique identifier for the driver
    - **personal_score**: Driver's annual driving score (0-100)
    - **annual_premium**: Driver's yearly premium in GBP
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503, 
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    try:
        doc_ref = db.collection("drivers").document(driver.driver_id)
        doc_ref.set({
            "driver_id": driver.driver_id,
            "personal_score": driver.personal_score,
            "annual_premium": driver.annual_premium
        })
        return {"status": "success", "driver_id": driver.driver_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drivers/{driver_id}", tags=["Driver Management"])
async def get_driver_score(driver_id: str):
    """
    Retrieve a driver's score from Firestore.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    try:
        doc_ref = db.collection("drivers").document(driver_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found")
        return doc.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drivers", tags=["Driver Management"])
async def list_all_drivers():
    """
    List all drivers from Firestore.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    try:
        drivers_ref = db.collection("drivers")
        docs = drivers_ref.stream()
        drivers = [doc.to_dict() for doc in docs]
        return {"drivers": drivers, "count": len(drivers)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/drivers/{driver_id}", tags=["Driver Management"])
async def delete_driver(driver_id: str):
    """
    Delete a driver from Firestore.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    try:
        doc_ref = db.collection("drivers").document(driver_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found")
        doc_ref.delete()
        return {"status": "deleted", "driver_id": driver_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pool-stats", response_model=PoolStats, tags=["Pool Statistics"])
async def get_pool_statistics():
    """
    Get real-time pool statistics from Firestore.
    
    Returns:
    - Total number of drivers
    - Number of drivers with score >= 80
    - Pool safety factor (percentage of drivers with score >= 80)
    - Average score across all drivers
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    try:
        drivers_ref = db.collection("drivers")
        docs = drivers_ref.stream()
        
        scores = []
        for doc in docs:
            data = doc.to_dict()
            if "personal_score" in data:
                scores.append(data["personal_score"])
        
        if not scores:
            return PoolStats(
                total_drivers=0,
                drivers_above_80=0,
                pool_safety_factor=0.0,
                average_score=0.0
            )
        
        drivers_above_80 = sum(1 for score in scores if score >= 80)
        
        return PoolStats(
            total_drivers=len(scores),
            drivers_above_80=drivers_above_80,
            pool_safety_factor=round(drivers_above_80 / len(scores), 4),
            average_score=round(sum(scores) / len(scores), 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate-pool-refunds-from-firestore", response_model=BatchRefundResponse, tags=["Refund Calculator"])
async def calculate_refunds_from_firestore(surplus_ratio: float = 0.5):
    """
    Calculate refunds for all drivers stored in Firestore.
    
    Uses real-time pool_safety_factor calculated from all stored driver scores.
    
    - **surplus_ratio**: Total surplus / Target refund pool (capped at 1)
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
    
    try:
        # Get all drivers from Firestore
        drivers_ref = db.collection("drivers")
        docs = drivers_ref.stream()
        
        drivers_data = []
        for doc in docs:
            data = doc.to_dict()
            if all(k in data for k in ["driver_id", "personal_score", "annual_premium"]):
                drivers_data.append(data)
        
        if not drivers_data:
            raise HTTPException(status_code=404, detail="No drivers found in Firestore")
        
        # Calculate pool safety factor
        scores = [d["personal_score"] for d in drivers_data]
        pool_safety_factor = calculate_pool_safety_factor(scores)
        
        # Cap surplus ratio
        surplus_ratio = min(surplus_ratio, 1.0)
        
        # Calculate refunds
        results = []
        total_refund = 0.0
        eligible_count = 0
        
        for driver in drivers_data:
            refund_result = calculate_refund(
                personal_score=driver["personal_score"],
                pool_safety_factor=pool_safety_factor,
                surplus_ratio=surplus_ratio,
                annual_premium=driver["annual_premium"]
            )
            
            results.append(DriverRefundResult(
                driver_id=driver["driver_id"],
                eligible=refund_result.eligible,
                refund_rate=refund_result.refund_rate,
                refund_amount=refund_result.refund_amount,
                net_cost=refund_result.net_cost,
                personal_score=driver["personal_score"],
                annual_premium=driver["annual_premium"]
            ))
            
            if refund_result.eligible:
                total_refund += refund_result.refund_amount
                eligible_count += 1
        
        return BatchRefundResponse(
            pool_safety_factor=pool_safety_factor,
            surplus_ratio=surplus_ratio,
            total_refund_amount=round(total_refund, 2),
            eligible_count=eligible_count,
            total_count=len(drivers_data),
            results=results
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


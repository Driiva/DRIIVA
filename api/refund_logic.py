"""
Core refund maths: the per-driver refund and the pool safety factor.
Extracted verbatim from api/main.py.
"""

from typing import List

from models import RefundResponse

# ============ Core Calculation Logic ============

def calculate_refund(
    personal_score: float,
    pool_safety_factor: float,
    surplus_ratio: float,
    annual_premium: float
) -> RefundResponse:
    """
    Calculate the refund for a single driver.
    
    Logic:
    - refund_rate = min(0.15, ((0.7 * personal_score/100) + (0.3 * pool_safety_factor)) * surplus_ratio)
    - refund_amount = annual_premium * refund_rate
    
    Rules:
    - Only drivers with personal_score >= 70 are eligible
    - Refund rate capped at 15% maximum
    """
    # Cap surplus_ratio at 1
    surplus_ratio = min(surplus_ratio, 1.0)
    
    # Check eligibility
    eligible = personal_score >= 70
    
    if not eligible:
        return RefundResponse(
            eligible=False,
            refund_rate=0.0,
            refund_amount=0.0,
            net_cost=annual_premium
        )
    
    # Calculate refund rate
    raw_rate = ((0.7 * personal_score / 100) + (0.3 * pool_safety_factor)) * surplus_ratio
    refund_rate = min(0.15, raw_rate)
    
    # Calculate refund amount
    refund_amount = round(annual_premium * refund_rate, 2)
    
    # Calculate net cost
    net_cost = round(annual_premium - refund_amount, 2)
    
    return RefundResponse(
        eligible=True,
        refund_rate=round(refund_rate, 4),
        refund_amount=refund_amount,
        net_cost=net_cost
    )


def calculate_pool_safety_factor(scores: List[float]) -> float:
    """Calculate the pool safety factor from a list of scores."""
    if not scores:
        return 0.0
    drivers_above_80 = sum(1 for score in scores if score >= 80)
    return round(drivers_above_80 / len(scores), 4)


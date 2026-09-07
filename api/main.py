"""
Driiva Refund Calculator API
FastAPI application for calculating driver refunds based on driving scores and pool safety.
Includes mock risk scoring service that simulates XGBoost behavior.

The models, the maths and the route groups live in sibling modules; this file
wires them onto the app. Routers are included in the order the endpoints were
declared when they all lived here, so the route table is unchanged - including
the two GET "/" registrations, where the redirect below still shadows the
health handler in routers/calculator.py exactly as before.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from routers import calculator, drivers, scoring

# Initialize FastAPI app
app = FastAPI(
    title="Driiva Refund Calculator API",
    description="Calculate driver refunds based on personal driving scores, pool safety factors, and surplus ratios.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Redirect root to API documentation."""
    return RedirectResponse(url="/docs")

app.include_router(calculator.router)
app.include_router(drivers.router)
app.include_router(scoring.router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

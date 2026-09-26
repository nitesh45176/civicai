import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.routers import (
    analyze_router,
    complaints_router,
    authorities_router,
    location_router,
)
from app.services.escalation_service import process_overdue_complaints

import app.models  # ensure models are loaded


# Ensure local uploads directory exists
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Run SLA escalation checks periodically
async def escalation_scheduler():
    while True:
        try:
            db = SessionLocal()

            try:
                sent_count = process_overdue_complaints(db)

                if sent_count > 0:
                    print(
                        f"[SLA Scheduler] Sent {sent_count} escalation email(s)."
                    )

            finally:
                db.close()

        except Exception as e:
            print(f"[SLA Scheduler Error] {e}")

        # Check once every hour
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables for local development/sqlite ease
    Base.metadata.create_all(bind=engine)

    # Ensure resolution_image_url column exists in complaints table
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "ALTER TABLE complaints "
                    "ADD COLUMN resolution_image_url TEXT"
                )
            )
            conn.commit()
    except Exception:
        pass  # Column already exists

    # Auto-seed database with municipal authorities
    # and realistic sample complaints
    try:
        from app.seed import seed_database

        seed_database()

    except Exception as e:
        print(f"[Warning] Seed database error: {e}")

    # Start background SLA escalation scheduler
    scheduler_task = asyncio.create_task(
        escalation_scheduler()
    )

    print("[SLA Scheduler] Started. Checking every hour.")

    try:
        yield

    finally:
        # Stop scheduler when application shuts down
        scheduler_task.cancel()

        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass

        print("[SLA Scheduler] Stopped.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Production-quality REST API backend for "
        "CivicAI grievance redressal platform."
    ),
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Mount local uploads directory for static image serving
app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)


# Mount Routers under /api
app.include_router(
    analyze_router,
    prefix=settings.API_V1_STR,
)

app.include_router(
    complaints_router,
    prefix=settings.API_V1_STR,
)

app.include_router(
    authorities_router,
    prefix=settings.API_V1_STR,
)

app.include_router(
    location_router,
    prefix=settings.API_V1_STR,
)


@app.get(
    "/api/health",
    tags=["Health"],
    summary="API Health Check",
)
def health_check():
    """Health check endpoint confirming service status."""
    return {
        "status": "ok",
        "service": "CivicAI Backend",
    }


# Centralized Error Handlers

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "message": "Validation failed for incoming payload.",
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request,
    exc: Exception,
):
    # Log the exception internally without exposing stack traces
    # to the client.
    print(f"[Unhandled Error] {exc}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": (
                "An unexpected internal server error occurred. "
                "Please try again later."
            )
        },
    )
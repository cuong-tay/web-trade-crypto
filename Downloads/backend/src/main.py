import os
import sys
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import logging
import time
import traceback
from datetime import datetime
from src.utils.timezone import get_vietnam_now

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add src to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.config.settings import get_settings
from src.api.v1 import auth, users, market, trading, wallets, portfolio, watchlist, chatbot, p2p, debug, futures, admin

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="CTrading API",
    description="API cho nền tảng giao dịch Crypto - CTrading",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    # Log incoming request
    logger.info(f"{'='*80}")
    logger.info(f"INCOMING REQUEST: {request.method} {request.url.path}")
    logger.info(f"Client: {request.client.host if request.client else 'unknown'}:{request.client.port if request.client else 'unknown'}")
    logger.info(f"Headers: {dict(request.headers)}")
    logger.info(f"{'='*80}")

    response = await call_next(request)
    
    # Log response
    process_time = time.time() - start_time
    logger.info(f"RESPONSE: Status {response.status_code} - Time: {process_time:.3f}s")
    logger.info(f"{'='*80}")
    
    return response

# Add exception handler để log toàn bộ lỗi
from fastapi.exceptions import RequestValidationError

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"❌ UNHANDLED EXCEPTION: {str(exc)}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Request URL: {request.url}")
    
    # Lấy origin từ request
    origin = request.headers.get("origin", "*")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "error_type": type(exc).__name__,
            "timestamp": get_vietnam_now().isoformat()
        },
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin",
            "Content-Type": "application/json",
        }
    )

# Add handler cho HTTPException
from fastapi.exceptions import RequestValidationError

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"⚠️  HTTP EXCEPTION: {exc.status_code} - {exc.detail}")
    
    origin = request.headers.get("origin", "*")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "timestamp": get_vietnam_now().isoformat()
        },
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin",
            "Content-Type": "application/json",
        }
    )

# Add CORS Middleware - Cấu hình nâng cao để hỗ trợ tất cả các client
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://172.16.0.2:3000",
        "http://192.168.1.57:3000",
        "*"  # Cho phép tất cả origins cho development
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "*"
    ],
    expose_headers=["Content-Type", "Authorization"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(debug.router, prefix="/api/users", tags=["Debug"])
app.include_router(market.router, prefix="/api/market", tags=["Market"])
app.include_router(trading.router, prefix="/api/trading", tags=["Trading"])
app.include_router(futures.router, prefix="/api/futures", tags=["Futures Trading"])
app.include_router(wallets.router, prefix="/api/wallets", tags=["Wallets"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["Watchlist"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])
app.include_router(p2p.router, prefix="/api/p2p", tags=["P2P"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin Dashboard"])

# Mount static files for uploads (IMPORTANT: must be after API routers to avoid conflicts)
uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
    logger.info(f"✅ Static files mounted at /uploads: {uploads_dir}")
else:
    logger.warning(f"⚠️  Uploads directory not found: {uploads_dir}")
    # Create it if it doesn't exist
    os.makedirs(uploads_dir, exist_ok=True)
    os.makedirs(os.path.join(uploads_dir, 'avatars'), exist_ok=True)
    os.makedirs(os.path.join(uploads_dir, 'covers'), exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
    logger.info(f"✅ Created uploads directory and mounted at /uploads")

# Startup event
@app.on_event("startup")
async def startup_event():
    """Log when server starts"""
    logger.info("=" * 80)
    logger.info("✅ CTrading API Server Started Successfully!")
    logger.info(f"📚 API Documentation: http://localhost:{settings.api_port}/api/docs")
    logger.info(f"💚 Health Check: http://localhost:{settings.api_port}/health")
    logger.info("=" * 80)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.api_env
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to CTrading API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # Cho phép truy cập từ tất cả network interfaces
        port=settings.api_port,
        reload=True,  # Tự động reload khi có thay đổi
        log_level="info"
    )

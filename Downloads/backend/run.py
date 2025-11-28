#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script để chạy CTrading Backend API
Chạy: python run.py
"""

import os
import sys
import io

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Get absolute path of backend folder
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

if __name__ == "__main__":
    # Import after path setup
    from src.config.settings import get_settings
    import uvicorn
    
    settings = get_settings()
    
    # Get local IP addresses
    import socket
    hostname = socket.gethostname()
    try:
        local_ip = socket.gethostbyname(hostname)
    except:
        local_ip = "N/A"

    # Print banner before starting server
    print("\n")
    print("╔" + "="*78 + "╗")
    print("║" + " "*20 + "CTrading API Backend" + " "*38 + "║")
    print("║" + " "*25 + "Version: 1.0.0" + " "*39 + "║")
    print("║" + f" Environment: {settings.api_env.upper():15}" + " "*45 + "║")
    print("╚" + "="*78 + "╝")
    print("")
    print("🚀 Server đang chạy và có thể truy cập từ:")
    print(f"   ➜ Local:   http://localhost:{settings.api_port}")
    print(f"   ➜ Local:   http://127.0.0.1:{settings.api_port}")
    print(f"   ➜ Network: http://{local_ip}:{settings.api_port}")
    print("")
    print(f"📚 API Docs: http://localhost:{settings.api_port}/api/docs")
    print(f"💚 Health:   http://localhost:{settings.api_port}/health")
    print("")
    print("⚡ Backend có thể kết nối từ Vite frontend trên mọi network!")
    print("")
    print("Press CTRL+C to stop the server")
    print("="*80)
    print("")
    
    try:
        uvicorn.run(
            "src.main:app",
            host="0.0.0.0",
            port=settings.api_port,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n✓ Server stopped successfully")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)

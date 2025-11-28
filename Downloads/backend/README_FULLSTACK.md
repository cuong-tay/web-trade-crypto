# CTrading - Crypto Trading Platform

**Full-stack crypto trading platform** - Frontend + Backend hoàn chỉnh

🌐 **Frontend**: React + TypeScript + Vite  
⚙️ **Backend**: FastAPI + SQLAlchemy + SQL Server

---

## 📁 Cấu Trúc Repository

```
web-trade-crypto/
├── main (Frontend)              # React app
│   ├── src/
│   ├── public/
│   ├── vite.config.ts
│   ├── package.json
│   └── README.md
│
└── master (Backend)             # FastAPI app
    ├── src/
    │   ├── api/v1/              # 12 route modules
    │   ├── models/              # Database models
    │   ├── schemas/             # Pydantic schemas
    │   ├── services/            # Business logic
    │   ├── utils/               # Middleware, security
    │   └── config/              # Database config
    ├── create_db.py
    ├── run.py
    ├── requirements.txt
    └── README.md
```

---

## 🚀 Setup & Chạy

### Frontend (main branch)
```bash
git checkout main
npm install
npm run dev
# http://localhost:5173
```

### Backend (master branch)
```bash
git checkout master
pip install -r requirements.txt
python create_db.py
python run.py
# http://localhost:8000
```

---

## ✨ Tính Năng

### 🔐 Bảo Mật
- JWT authentication
- Role-based access (User/Admin)
- **Banned user protection** - Chặn giao dịch người bị cấm
- Password hashing (bcrypt)

### 📊 Giao Dịch
- **Spot trading** - Market/Limit orders
- **Futures trading** - Leverage 1x-100x
- Stop Loss / Take Profit
- Auto-fill market orders (tránh duplicate)

### 👥 Quản Lý
- User registration & login
- Profile management (Avatar, Cover)
- Activity logging & audit trails
- Admin reporting (4 báo cáo)
- Ban/Unban users

### 📈 Báo Cáo & Thống Kê
- User growth reports
- Top coins by volume
- Buy/Sell ratio analysis
- Activity heatmap (trades by hour)

### 🛠️ Khác
- Watchlist management
- P2P trading
- Chatbot integration
- Market data
- WebSocket support

---

## 📚 API Endpoints (12 Modules)

| Module | Endpoints | Status |
|--------|-----------|--------|
| **Auth** | Register, Login, Logout | ✅ |
| **Users** | Profile, Activity, Settings | ✅ |
| **Wallets** | Balance, Transactions, Withdraw | ✅ PROTECTED |
| **Trading** | Create Order, Cancel, Trades | ✅ PROTECTED |
| **Futures** | Positions, Orders, TP/SL | ✅ PROTECTED |
| **Admin** | Reports, Ban Users | ✅ |
| **Watchlist** | Add, Remove, List | ✅ |
| **Chatbot** | Chat, History | ✅ |
| **P2P** | Advertisements, Orders | ✅ |
| **Market** | Tickers, KLines, Stats | ✅ |
| **Portfolio** | Holdings, Performance | ✅ |
| **Debug** | Testing endpoints | ✅ |

**[PROTECTED]** = Banned users bị chặn

---

## 🔧 Tech Stack

### Frontend
| Tech | Version |
|------|---------|
| React | 18.x |
| TypeScript | 5.x |
| Vite | 5.x |
| TailwindCSS | 3.x |
| Axios | Latest |

### Backend
| Tech | Version |
|------|---------|
| FastAPI | 0.100+ |
| SQLAlchemy | 2.0+ |
| SQL Server | 2019+ |
| Python | 3.10+ |
| Pydantic | v2 |
| PyJWT | Latest |

---

## 🔐 Người Dùng Bị Cấm

### Không thể:
- ❌ Tạo lệnh giao dịch (spot & futures)
- ❌ Rút tiền
- ❌ Đóng position

### Có thể:
- ✅ Xem số dư
- ✅ Xem lịch sử giao dịch
- ✅ Xem positions (read-only)

### Response:
```json
HTTP 403 Forbidden
{
  "detail": "Tài khoản của bạn đã bị cấm. Không thể thực hiện giao dịch."
}
```

---

## 📝 Branch Strategy

| Branch | Purpose | Owner |
|--------|---------|-------|
| **main** | Frontend (React) | Frontend team |
| **master** | Backend (FastAPI) | Backend team |
| **develop** | Integration testing | - |
| **production** | Live deployment | - |

---

## 🚀 Deployment

### Development
```bash
# Frontend
npm run dev

# Backend
python run.py
```

### Production
```bash
# Frontend - Build
npm run build

# Backend - Uvicorn
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

---

## 📋 Checklist Setup

### Backend (master)
- [ ] Clone repository
- [ ] `pip install -r requirements.txt`
- [ ] Tạo `.env` từ `.env.example`
- [ ] `python create_db.py`
- [ ] `python setup_admin.py` (optional)
- [ ] `python run.py`
- [ ] Test API tại http://localhost:8000/api/docs

### Frontend (main)
- [ ] Checkout branch `main`
- [ ] `npm install`
- [ ] Tạo `.env` với API URL
- [ ] `npm run dev`
- [ ] Open http://localhost:5173

---

## 🐛 Troubleshooting

| Vấn Đề | Giải Pháp |
|--------|----------|
| Port conflict | Thay đổi PORT trong `.env` |
| Module not found | Cài lại dependencies |
| DB connection fail | Kiểm tra SQL Server & `.env` |
| CORS error | Kiểm tra CORS_ORIGINS |
| Token error | Đăng nhập lại |

---

## 📞 Support

- **Backend Issues**: Check `master` branch README
- **Frontend Issues**: Check `main` branch README
- **Database**: SQL Server 2019+
- **API Docs**: http://localhost:8000/api/docs

---

## 📄 License

Private project - All rights reserved. © 2025

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add feature"`
3. Push: `git push origin feature/your-feature`
4. Create Pull Request

---

**Last Updated**: November 28, 2025  
**Status**: ✅ Full stack ready for deployment

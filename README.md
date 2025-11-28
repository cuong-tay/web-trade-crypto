# CTrading Backend API

RESTful API backend cho nền tảng giao dịch tiền mã hóa - FastAPI + SQLAlchemy + SQL Server

## 📋 Mục Lục

- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [API Endpoints](#api-endpoints)
- [Tính Năng](#tính-năng)
- [Bảo Mật](#bảo-mật)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Cài Đặt & Chạy

### Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Tạo .env (copy từ .env.example)
# Thêm: DB_SERVER, DB_USER, DB_PASSWORD, SECRET_KEY

# 3. Tạo database
python create_db.py

# 4. Setup admin (optional)
python setup_admin.py
```

### Chạy Server
```bash
python run.py
# Server: http://localhost:8000
# Docs: http://localhost:8000/api/docs
```

---

## 📚 API Endpoints

### 🔑 Auth `/api/v1/auth`
- `POST /register` - Đăng ký
- `POST /login` - Đăng nhập
- `POST /logout` - Đăng xuất

### 👤 Users `/api/v1/users`
- `GET /me` - Thông tin hiện tại
- `PUT /me/profile` - Cập nhật profile
- `PUT /me/password` - Đổi mật khẩu
- `GET /me/activity` - Lịch sử hoạt động

### 💰 Wallets `/api/v1/wallets` [PROTECTED]
- `GET /` - Danh sách ví
- `GET /balance` - Số dư
- `GET /transactions` - Lịch sử giao dịch
- `POST /withdraw` - Rút tiền [BANNED BLOCKED]

### 📈 Trading Spot `/api/v1/trading` [PROTECTED]
- `POST /orders` - Tạo lệnh [BANNED BLOCKED]
- `GET /orders` - Danh sách lệnh
- `DELETE /orders/{id}` - Hủy lệnh [BANNED BLOCKED]
- `GET /trades` - Giao dịch

### 🚀 Futures `/api/v1/futures` [PROTECTED]
- `POST /positions` - Mở vị trí [BANNED BLOCKED]
- `GET /positions` - Danh sách vị trí
- `POST /positions/{id}/close` - Đóng vị trí [BANNED BLOCKED]
- `POST /positions/{id}/update-tpsl` - Cập nhật TP/SL [BANNED BLOCKED]
- `POST /orders` - Futures order [BANNED BLOCKED]
- `DELETE /orders/{id}` - Hủy order [BANNED BLOCKED]

### 📊 Admin `/api/v1/admin`
- `GET /reports/user-growth` - Tăng trưởng người dùng
- `GET /reports/top-coins` - Top coins
- `GET /reports/buy-sell-ratio` - Tỷ lệ mua/bán
- `GET /reports/activity-heatmap` - Hoạt động theo giờ
- `POST /ban-user` - Cấm user
- `POST /unban-user` - Gỡ cấm

### Khác
- 👁️ **Watchlist** `/api/v1/watchlist` - Thêm/xóa theo dõi
- 💬 **Chatbot** `/api/v1/chatbot` - Chat, lịch sử
- 🤝 **P2P** `/api/v1/p2p` - Giao dịch P2P
- 📊 **Market** `/api/v1/market` - Dữ liệu thị trường

---

## ✨ Tính Năng Chính

### 🔐 Bảo Mật
- JWT authentication
- Role-based access (User/Admin)
- **Banned user protection** - Chặn giao dịch người bị cấm
- Password hashing (bcrypt)

### 📊 Giao Dịch
- Spot trading (market/limit orders)
- Futures trading (leverage 1x-100x)
- Stop Loss / Take Profit
- Auto-fill market orders (tránh duplicate)

### 👥 Quản Lý
- User registration & login
- Profile + Avatar/Cover image
- Activity logging
- Ban/Unban users
- Admin reporting

### 📁 Cấu Trúc
```
src/
├── api/v1/          # 12 route modules
├── models/          # Database models
├── schemas/         # Pydantic validators
├── services/        # Business logic
├── utils/           # Dependencies, security
└── config/          # Database, settings
```

---

## 🔐 Bảo Mật

### JWT Token
```bash
# Sử dụng trong header
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Người Dùng Bị Cấm
- ❌ Không thể: Tạo lệnh, rút tiền, đóng position
- ✅ Có thể: Xem số dư, lịch sử giao dịch
- Response: `403 Forbidden` với message chi tiết

### Middleware
- `verify_token()` - Xác thực JWT
- `check_role()` - Kiểm tra Admin
- `check_user_not_banned()` - **Chặn banned users** (NEW)

---

## 🛠️ Công Nghệ

| Stack | Version |
|-------|---------|
| FastAPI | 0.100+ |
| SQLAlchemy | 2.0+ |
| SQL Server | 2019+ |
| Python | 3.10+ |
| Pydantic | v2 |
| PyJWT | - |

---

## 🐛 Troubleshooting

| Vấn Đề | Giải Pháp |
|--------|----------|
| Port đã dùng | Thay đổi `API_PORT` trong `.env` |
| Module không tìm | `pip install -r requirements.txt` |
| DB connection fail | Kiểm tra `.env` & SQL Server đang chạy |
| CORS error | Kiểm tra `CORS_ORIGINS` & `API_HOST=0.0.0.0` |
| Token error | Token hết hạn? Đăng nhập lại |

---

## 📝 Ghi Chú

- 🔄 Auto-reload development mode
- 🎯 Vietnam timezone (UTC+7)
- 🚀 Auto-fill orders (tránh duplicate)
- 📊 Báo cáo được cache
- ⚙️ Swagger UI tự động

## 🤝 Contribution

1. `git checkout -b feature/your-feature`
2. `git commit -m "Add feature"`
3. `git push origin feature/your-feature`

---

## 📄 License

Private project - All rights reserved. © 2025

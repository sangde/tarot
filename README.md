# Tarot — Rút bài & giải nghĩa

Web rút bài Tarot với giải nghĩa tiếng Việt (tham khảo [tarot.vn](https://tarot.vn/giai-y-nghia-78-la-bai-tarot/)).

## Phân quyền

| | Khách (không login) | Premium (mã / tài khoản kích hoạt) |
|---|---|---|
| Rút bài | **1 lần / IP** · chỉ 1 lá | Không giới hạn |
| Trải 3 lá / tình cảm | ✗ | ✓ |
| Lá ngược | ✗ | ✓ |
| Thư viện đầy đủ | Xem nhanh | ✓ |

Mã mặc định (đổi trên Vercel Env): `TAROT-VIP-2026`, `DEMO-UNLOCK`

## Chạy local

```bash
npx vercel dev
```

Mở URL mà CLI in ra (thường http://localhost:3000).

## Admin

Trang quản trị: `/admin.html`

Đăng nhập bằng:
- `ADMIN_EMAIL` (mặc định `admin@tarot.local`)
- `ADMIN_PASSWORD` (mặc định `TarotAdmin@2026` — **đổi ngay trên Vercel**)

Admin có thể:
- Tạo / bật / tắt / xóa mã kích hoạt
- Xem user, kích hoạt Premium, gán role admin, xóa user

## Biến môi trường (Vercel)

- `AUTH_SECRET` — chuỗi bí mật ký cookie (bắt buộc production)
- `ACTIVATION_CODES` — mã ENV cách nhau bởi dấu phẩy
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — tài khoản admin
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — (khuyến nghị) lưu user/mã bền vững

Không có Redis: dữ liệu admin/user có thể mất khi serverless restart.

## Deploy

```bash
npx vercel deploy --prod
```

## Dữ liệu lá bài

```bash
python3 scripts/scrape_cards.py
cp data/cards.json public/cards.json
```

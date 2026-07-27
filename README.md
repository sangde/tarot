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

## Biến môi trường (Vercel)

- `AUTH_SECRET` — chuỗi bí mật ký cookie (bắt buộc production)
- `ACTIVATION_CODES` — mã cách nhau bởi dấu phẩy, vd `TAROT-VIP-2026,KHACH-ABC`
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — (khuyến nghị) lưu IP/user bền vững

Không có Redis: vẫn chạy bằng memory + cookie guest (đủ dùng tạm; multi-instance có thể lệch).

## Deploy

```bash
npx vercel deploy --prod
```

## Dữ liệu lá bài

```bash
python3 scripts/scrape_cards.py
cp data/cards.json public/cards.json
```

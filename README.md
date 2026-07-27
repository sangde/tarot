# Tarot — Rút bài & giải nghĩa

Web rút bài Tarot (1 lá / 3 lá / tình cảm) với giải nghĩa tiếng Việt tham khảo từ [tarot.vn – Ý nghĩa 78 lá](https://tarot.vn/giai-y-nghia-78-la-bai-tarot/).

## Chạy local

```bash
cd public
python3 -m http.server 8765
```

Mở http://localhost:8765

## Dữ liệu

- `data/cards.json` — 78 lá (từ khóa, mô tả, xuôi/ngược theo chủ đề)
- `scripts/scrape_cards.py` — scraper cập nhật từ tarot.vn
- `public/` — giao diện tĩnh

```bash
python3 scripts/scrape_cards.py
cp data/cards.json public/cards.json
```

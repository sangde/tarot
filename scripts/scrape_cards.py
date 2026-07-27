#!/usr/bin/env python3
"""Scrape 78 tarot card meanings from tarot.vn into data/cards.json."""

from __future__ import annotations

import json
import re
import time
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URLS = (ROOT / "data" / "urls.txt").read_text().strip().splitlines()
OUT = ROOT / "data" / "cards.json"
CACHE = ROOT / "data" / "cache"
CACHE.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (compatible; TarotApp/1.0; +local research)"


def fetch(url: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "-", url.lower()).strip("-") + ".html"
    path = CACHE / key
    if path.exists() and path.stat().st_size > 1000:
        return path.read_text(errors="ignore")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as res:
        html = res.read().decode("utf-8", errors="ignore")
    path.write_text(html)
    time.sleep(0.2)
    return html


def extract_entry_html(html: str) -> str:
    m = re.search(
        r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)</div>\s*<div[^>]*class="[^"]*post-share',
        html,
    )
    if not m:
        m = re.search(
            r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)</div>\s*(?:<div[^>]*class="[^"]*next-prev|<footer)',
            html,
        )
    return m.group(1) if m else ""


def html_to_text(html: str) -> str:
    html = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", "", html, flags=re.I)
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    html = re.sub(r"</(p|h[1-6]|div|blockquote|tr)>", "\n\n", html, flags=re.I)
    html = re.sub(r"</li>", "\n", html, flags=re.I)
    html = re.sub(r"<li[^>]*>", "• ", html, flags=re.I)
    html = re.sub(r"<[^>]+>", "", html)
    text = unescape(html).replace("\xa0", " ").replace("\u200b", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def first_ul_items(entry_html: str) -> list[str]:
    # Keywords live in the first <ul> before "Trong Hành Động"
    head = entry_html
    cut = re.search(r"Trong Hành Động", entry_html, re.I)
    if cut:
        head = entry_html[: cut.start()]
    m = re.search(r"<ul[^>]*>([\s\S]*?)</ul>", head, re.I)
    if not m:
        return []
    items = re.findall(r"<li[^>]*>([\s\S]*?)</li>", m.group(1), re.I)
    out = []
    for item in items:
        t = re.sub(r"<[^>]+>", "", item)
        t = unescape(t).strip()
        if t:
            out.append(t)
    return out


def parse_action_blocks(entry_html: str) -> list[dict]:
    # From "Trong Hành Động" until opposing / description
    m = re.search(
        r"Trong Hành Động([\s\S]*?)(?:Một Vài Lá Bài Đối Lập|Mô Tả Chi Tiết)",
        entry_html,
        re.I,
    )
    if not m:
        return []
    block = m.group(1)
    # Split by strong headings followed by ul
    parts = re.findall(
        r"<strong>([\s\S]*?)</strong>[\s\S]*?<ul>([\s\S]*?)</ul>",
        block,
        re.I,
    )
    actions = []
    for title_html, ul_html in parts:
        title = re.sub(r"<[^>]+>", "", title_html)
        title = unescape(title).strip()
        items = []
        for li in re.findall(r"<li[^>]*>([\s\S]*?)</li>", ul_html, re.I):
            t = unescape(re.sub(r"<[^>]+>", "", li)).strip()
            if t:
                items.append(t)
        if title and items:
            actions.append({"title": title, "items": items})
    return actions


def parse_bullet_section(entry_html: str, start: str, ends: list[str]) -> list[str]:
    end_pat = "|".join(re.escape(e) for e in ends)
    m = re.search(rf"{re.escape(start)}([\s\S]*?)(?:{end_pat})", entry_html, re.I)
    if not m:
        return []
    items = []
    for li in re.findall(r"<li[^>]*>([\s\S]*?)</li>", m.group(1), re.I):
        t = unescape(re.sub(r"<[^>]+>", "", li)).strip()
        if t:
            items.append(t)
    return items


def parse_description(entry_html: str) -> str:
    m = re.search(
        r"Mô Tả Chi Tiết:?([\s\S]*?)(?:Ý Nghĩa Xuôi|Diễn Giải Xuôi|<h3|<div class=\"bs-ir)",
        entry_html,
        re.I,
    )
    if not m:
        return ""
    text = html_to_text(m.group(1))
    # drop trailing related content crumbs
    for stop in ["Ý Nghĩa Xuôi", "Diễn Giải", "4.5/5", "4.6/5", "Bài viết liên quan"]:
        i = text.find(stop)
        if i > 100:
            text = text[:i]
    return text.strip()[:4000]


SECTION_KEYS = [
    ("intro", ["Dẫn nhập:", "Dẫn nhập"]),
    ("overview", ["Tổng quan:", "Tổng quan"]),
    ("career", ["Công việc:", "Công Việc:"]),
    ("love", ["Tình yêu:", "Tình Yêu:"]),
    ("finance", ["Tài chính:", "Tài Chính:"]),
    ("health", ["Sức khỏe:", "Sức Khỏe:"]),
    ("spirit", ["Tinh thần:", "Tinh Thần:"]),
]


def parse_context_sections(entry_html: str) -> dict:
    text = html_to_text(entry_html)
    # Trim noise after main sections
    for stop in [
        "Bài viết liên quan",
        "TÀI TRỢ",
        "Bạn cũng có thể thích",
        "4.5/5",
        "4.6/5",
        "4.7/5",
        "4.8/5",
        "5/5 -",
        "(5★",
    ]:
        i = text.find(stop)
        if i > 300:
            text = text[:i].strip()

    # Remove title line
    text = re.sub(r"^Diễn Giải (Xuôi|Ngược) của Lá Bài .+\n+", "", text)

    positions: list[tuple[int, str, str]] = []
    for key, labels in SECTION_KEYS:
        for label in labels:
            i = text.find(label)
            if i >= 0:
                positions.append((i, key, label))
                break
    if not positions:
        return {"raw": text[:3500]} if text else {}

    positions.sort()
    result: dict[str, str] = {}
    for idx, (start, key, label) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else len(text)
        body = text[start + len(label) : end].strip(" :\n\t")
        body = re.sub(r"\n{3,}", "\n\n", body).strip()
        # Fix glued "thế giớiTinh thần" style leftovers already handled by section split
        if body:
            result[key] = body[:2800]
    return result


def classify(slug: str) -> tuple[str, str]:
    if "cups" in slug:
        return "minor", "Cups"
    if "pentacles" in slug:
        return "minor", "Pentacles"
    if "swords" in slug:
        return "minor", "Swords"
    if "wands" in slug:
        return "minor", "Wands"
    return "major", "Major"


def extract_main_card(html: str, url: str) -> dict:
    entry = extract_entry_html(html)
    text = html_to_text(entry)

    title_m = re.search(r"<title>Ý Nghĩa Lá Bài (.+?) Trong Tarot", html)
    if not title_m:
        title_m = re.search(r"Ý Nghĩa Lá Bài (.+?) Trong Tarot", text)
    name = title_m.group(1).strip() if title_m else url.rstrip("/").split("/")[-1]
    # Clean year suffixes from title tag
    name = re.sub(r"\s+20\d{2}$", "", name).strip()

    number_line = ""
    nm = re.search(r"<strong>[^<]*?(\d+\s*(?:&#8211;|–|-)\s*[^<]+)</", entry)
    if nm:
        number_line = unescape(nm.group(1)).replace("&#8211;", "–").strip()
    else:
        for ln in text.splitlines()[:8]:
            if re.match(r"^(\d+\s*[–—-]\s*.+|Ace of .+|\d+ of .+|Page of .+|Knight of .+|Queen of .+|King of .+)$", ln.strip()):
                number_line = ln.strip()
                break

    keywords = first_ul_items(entry)
    actions = parse_action_blocks(entry)
    opposing = parse_bullet_section(
        entry, "Một Vài Lá Bài Đối Lập", ["Một Vài Lá Bài Hỗ Trợ", "Mô Tả Chi Tiết"]
    )
    supporting = parse_bullet_section(
        entry, "Một Vài Lá Bài Hỗ Trợ", ["Mô Tả Chi Tiết", "Ý Nghĩa Xuôi"]
    )
    description = parse_description(entry)

    icons = re.findall(
        r'(https://tarot\.vn/wp-content/uploads/[^"\']+[Ii]con[^"\']*\.(?:png|jpg|jpeg|webp))',
        entry or html,
    )
    cards_img = re.findall(
        r'(https://tarot\.vn/wp-content/uploads/[^"\']+\d[^"\']*500\.(?:png|jpg|jpeg|webp))',
        entry or html,
    )
    image = (cards_img[0] if cards_img else None) or (icons[0] if icons else None)
    icon = icons[0] if icons else image

    upright_url = None
    reversed_url = None
    um = re.search(r'href="(https://tarot\.vn/dien-giai-xuoi-cua-la-bai-[^"]+)"', html)
    rm = re.search(r'href="(https://tarot\.vn/dien-giai-nguoc-cua-la-bai-[^"]+)"', html)
    if um:
        upright_url = um.group(1)
    if rm:
        reversed_url = rm.group(1)

    slug = url.rstrip("/").split("/")[-1].replace("y-nghia-la-bai-", "").replace("-trong-tarot", "")
    arcana, suit = classify(slug)

    return {
        "id": slug,
        "name": name,
        "numberLine": number_line,
        "arcana": arcana,
        "suit": suit,
        "url": url,
        "image": image,
        "icon": icon,
        "keywords": keywords[:12],
        "actions": actions,
        "opposing": opposing[:10],
        "supporting": supporting[:10],
        "description": description,
        "uprightUrl": upright_url,
        "reversedUrl": reversed_url,
    }


def scrape_orientation(url: str | None) -> dict:
    if not url:
        return {}
    try:
        html = fetch(url)
        entry = extract_entry_html(html)
        return parse_context_sections(entry)
    except Exception as e:
        return {"error": str(e)}


def main() -> None:
    cards = []
    for i, url in enumerate(URLS, 1):
        print(f"[{i}/{len(URLS)}] {url}")
        try:
            html = fetch(url)
            card = extract_main_card(html, url)
            card["upright"] = scrape_orientation(card.get("uprightUrl"))
            card["reversed"] = scrape_orientation(card.get("reversedUrl"))
            cards.append(card)
            print(
                f"  {card['name']}: kw={len(card['keywords'])} "
                f"act={len(card['actions'])} up={list(card['upright'].keys())}"
            )
        except Exception as e:
            print("  ERROR", e)
            cards.append({"id": url, "error": str(e), "url": url})

    OUT.write_text(json.dumps(cards, ensure_ascii=False, indent=2))
    print(f"Wrote {len(cards)} cards -> {OUT}")


if __name__ == "__main__":
    main()

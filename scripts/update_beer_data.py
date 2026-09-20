#!/usr/bin/env python3
"""Build the 2026 autumn shop/beer catalog from the festival's public pages.

Install: python3 -m pip install beautifulsoup4 pymupdf
Run:     python3 scripts/update_beer_data.py
"""

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen

from bs4 import BeautifulSoup
import pymupdf


ROOT = Path(__file__).resolve().parents[1]
BEER_URL = "https://www.beerkeyaki.jp/beer/"
MAP_URL = "https://www.beerkeyaki.jp/files/uploads/2026autumn.pdf"
DIGITS = {chr(0xF6B1 + i): str(i) for i in range(10)}


def clean(element):
    return element.get_text(" ", strip=True) if element else ""


def yen(value):
    match = re.fullmatch(r"([\d,]+)円", value)
    return int(match.group(1).replace(",", "")) if match else None


def millilitres(value):
    match = re.fullmatch(r"([\d,]+)ml", value)
    return int(match.group(1).replace(",", "")) if match else None


def map_positions(pdf_bytes):
    pdf = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page = pdf[0]
    positions = {}
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                label = "".join(DIGITS.get(char, char) for char in span["text"])
                if not label.isdigit() or span["size"] <= 10:
                    continue
                number = int(label)
                if not 1 <= number <= 52:
                    continue
                x0, y0, x1, y1 = span["bbox"]
                # No. 36 also occurs in the shop-name legend. The booth number
                # lies to the left of the central reservation area.
                if number == 36 and x0 > 300:
                    continue
                positions[number] = {
                    "x": round((x0 + x1) / 2 / page.rect.width, 5),
                    "y": round((y0 + y1) / 2 / page.rect.height, 5),
                }
    # The SORACHI 1984 stand is drawn on the map without its number.
    # Use the centre of its labelled booth in the same official PDF.
    positions[52] = {"x": 0.276, "y": 0.218}
    assert set(positions) == set(range(1, 53)), f"Missing map positions: {set(range(1, 53)) - set(positions)}"
    return positions


def catalog(html, positions):
    soup = BeautifulSoup(html, "html.parser")
    shops = []
    for section in soup.select(".beer__section"):
        number = int(re.search(r"出店番号\s*(\d+)", clean(section.select_one("h3"))).group(1))
        shop_link = section.select_one('a[href^="/shop/archives/"]')
        shop = {
            "booth": number,
            "name": clean(section.select_one(".beer__heading-name")),
            "region": clean(section.select_one(".beer__heading-area")),
            "tags": [clean(tag) for tag in section.select(".beer__heading-tag-list li")],
            "url": urljoin(BEER_URL, shop_link["href"]) if shop_link else None,
            "map_position": positions[number],
            "sets": [],
            "beers": [],
        }
        for item in section.select(".beer__primary-list-item"):
            descriptions = [clean(x) for x in item.select(".beer__definition-list-description")]
            shop["sets"].append({
                "name": clean(item.select_one(".beer__definition-list-term")),
                "description": descriptions[0] if descriptions else "",
                "price_text": descriptions[1] if len(descriptions) > 1 else "",
                "price_yen": yen(descriptions[1]) if len(descriptions) > 1 else None,
            })
        for item in section.select(".beer__secondary-list-item"):
            link = item.select_one('a[href^="/beer/archives/"]')
            beer = {
                "name": clean(item.select_one(".beer__secondary-list-item-name")),
                "tags": [clean(tag) for tag in item.select(".beer__secondary-list-item-tag-list li")],
                "url": urljoin(BEER_URL, link["href"]) if link else None,
                "prices": [],
            }
            for row in item.select("table tr"):
                cells = [clean(cell) for cell in row.find_all(["th", "td"], recursive=False)]
                assert len(cells) == 3, (number, beer["name"], cells)
                beer["prices"].append({
                    "size": cells[0],
                    "volume_text": cells[1],
                    "volume_ml": millilitres(cells[1]),
                    "price_text": cells[2],
                    "price_yen": yen(cells[2]),
                })
            shop["beers"].append(beer)
        shops.append(shop)
    assert [s["booth"] for s in shops] == list(range(1, 53))
    return shops


def main():
    html = urlopen(BEER_URL, timeout=30).read()
    pdf = urlopen(MAP_URL, timeout=30).read()
    shops = catalog(html, map_positions(pdf))
    result = {
        "source_url": BEER_URL,
        "map_url": MAP_URL,
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "shops": shops,
    }
    data_dir = ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "beers.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fields = ["booth", "shop", "region", "shop_url", "type", "name", "tags", "description", "size", "volume_text", "volume_ml", "price_text", "price_yen", "item_url"]
    with (data_dir / "beers.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for shop in shops:
            base = {"booth": shop["booth"], "shop": shop["name"], "region": shop["region"], "shop_url": shop["url"]}
            for item in shop["sets"]:
                writer.writerow({**base, "type": "set", "name": item["name"], "description": item["description"], "price_text": item["price_text"], "price_yen": item["price_yen"]})
            for beer in shop["beers"]:
                prices = beer["prices"] or [{}]
                for price in prices:
                    writer.writerow({**base, "type": "beer", "name": beer["name"], "tags": " / ".join(beer["tags"]), "item_url": beer["url"], **price})
    print(f"{len(shops)} shops, {sum(len(s['beers']) for s in shops)} beers, {sum(len(s['sets']) for s in shops)} sets")


if __name__ == "__main__":
    main()

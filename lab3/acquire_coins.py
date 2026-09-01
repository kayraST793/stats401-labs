"""
STATS 401 — Lab 3 Assignment
Acquire 1,000 cryptocurrency records from the CoinGecko public API.

Source : https://www.coingecko.com/  (free public REST API, no key required)
Method : REST API (requests -> JSON)
Output : ../data/coins.csv  and  ../data/coins.json
"""

import requests
import time
import pandas as pd

url = "https://api.coingecko.com/api/v3/coins/markets"

headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0"
}

records = []

for page in range(1, 6):                      # 4 pages x 250 = 1000 records

    params = {
        "vs_currency": "usd",
        "order": "market_cap_desc",
        "per_page": 250,
        "page": page
    }

    try:
        response = requests.get(
            url,
            params=params,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()

    except requests.RequestException as error:
        print(f"Failed on page {page}:", error)
        continue

    data = response.json()

    for coin in data:
        records.append({
            "rank": coin["market_cap_rank"],
            "id": coin["id"],
            "name": coin["name"],
            "symbol": coin["symbol"].upper(),
            "price_usd": coin["current_price"],
            "market_cap": coin["market_cap"],
            "volume_24h": coin["total_volume"],
            "change_24h_pct": coin["price_change_percentage_24h"]
        })

    print(f"Collected {len(records)} records")

    time.sleep(1)                             # rate limiting

# Save the dataset
df = pd.DataFrame(records)

df.to_csv("../data/coins.csv", index=False)
df.to_json("../data/coins.json", orient="records", indent=2)

print("Total records:", len(records))
print(df.head())

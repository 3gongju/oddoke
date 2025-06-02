
import os, time, requests
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from urllib.parse import quote

# === 설정 ===
CSV_PATH = "templates/retry_members.csv"
SAVE_DIR = "profile_images"
os.makedirs(SAVE_DIR, exist_ok=True)

# 크롬드라이버 설정
options = Options()
# options.add_argument("--headless")  # 필요 시 주석 해제
driver = webdriver.Chrome(options=options)

# CSV 로드
df = pd.read_csv(CSV_PATH)
df["search_query"] = df["artist_name"] + " " + df["member_name"]

def download_profile_image(query, filename):
    search_url = f"https://search.naver.com/search.naver?query={quote(query)}"
    driver.get(search_url)
    time.sleep(2)  # 페이지 로딩 대기

    try:
        img = driver.find_element(By.CSS_SELECTOR, ".thumb_item img")
        img_url = img.get_attribute("src")

        if not img_url.startswith("http"):
            print(f"⚠ URL 이상함: {img_url}")
            return

        res = requests.get(img_url)
        if res.status_code == 200:
            with open(os.path.join(SAVE_DIR, filename), "wb") as f:
                f.write(res.content)
            print(f"✅ 저장 완료: {filename}")
        else:
            print(f"❌ 다운로드 실패: {filename}")
    except Exception as e:
        print(f"❌ {query} 실패: {e}")

# 전체 멤버 순회
for _, row in df.iterrows():
    query = row["search_query"]
    fname = f"{row['artist_name']}_{row['member_name']}.jpg".replace(" ", "_")
    download_profile_image(query, fname)

driver.quit()

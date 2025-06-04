import os, time, requests
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from urllib.parse import quote

# === 설정 ===
CSV_PATH = "templates/_member.csv"  # 본인의 파일 경로에 맞게 조정 CSV_PATH = "retry_members.csv"
SAVE_DIR = "member_namu_images"
os.makedirs(SAVE_DIR, exist_ok=True)

# 크롬드라이버 옵션
options = Options()
# options.add_argument("--headless")  # 필요시 브라우저 숨기기
driver = webdriver.Chrome(options=options)

# 검색어 구성
df = pd.read_csv(CSV_PATH)
df["search_query"] = df["artist_name"] + " " + df["member_name"] + " 나무위키"

def download_image(query, filename):
    encoded = quote(query)
    url = f"https://search.naver.com/search.naver?query={encoded}"
    driver.get(url)
    time.sleep(2)

    try:
        img = driver.find_element(By.CSS_SELECTOR, ".thumb_single .thumb_link img")
        img_url = img.get_attribute("src")

        res = requests.get(img_url)
        if res.status_code == 200:
            with open(os.path.join(SAVE_DIR, filename), "wb") as f:
                f.write(res.content)
            print(f"✅ 저장됨: {filename}")
        else:
            print(f"❌ 다운로드 실패: {filename}")
    except Exception as e:
        print(f"❌ {query} 이미지 추출 실패: {e}")

# 전체 멤버 순회
for _, row in df.iterrows():
    query = row["search_query"]
    fname = f"{row['artist_name']}_{row['member_name']}.jpg".replace(" ", "_")
    download_image(query, fname)

driver.quit()

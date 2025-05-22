import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import time
import os

CSV_FILE_PATH = '아이돌 목록 - 멤버.csv'

# 월별 다중 블로그 URL
BLOG_URLS = {
    "01": [
        "https://blog.naver.com/myloveidolactor/223716096561",
        "https://blog.naver.com/myloveidolactor/223299501904",
        "https://blog.naver.com/myloveidolactor/222966938260",
    ],
    "02": [
        "https://blog.naver.com/myloveidolactor/223332137121",
        "https://blog.naver.com/myloveidolactor/221778652931",
    ],
    "03": [
        "https://blog.naver.com/myloveidolactor/223365561468",
        "https://blog.naver.com/myloveidolactor/222252497431",
        "https://blog.naver.com/myloveidolactor/223777697525",
    ],
    "04": [
        "https://blog.naver.com/myloveidolactor/223395853147",
        "https://blog.naver.com/myloveidolactor/222284826038",
        "https://blog.naver.com/myloveidolactor/223815824104",
    ],
    "05": [
        "https://blog.naver.com/myloveidolactor/223424732619",
        "https://blog.naver.com/myloveidolactor/222317668400",
        "https://blog.naver.com/myloveidolactor/223848872719",
    ],
    "06": [
        "https://blog.naver.com/myloveidolactor/223461265729",
        "https://blog.naver.com/myloveidolactor/222362852606",
    ],
    "07": [
        "https://blog.naver.com/myloveidolactor/223492031983",
        "https://blog.naver.com/myloveidolactor/222405038340",
    ],
    "08": [
        "https://blog.naver.com/myloveidolactor/223529051880",
        "https://blog.naver.com/myloveidolactor/222439389943",
    ],
    "09": [
        "https://blog.naver.com/myloveidolactor/223566159817",
        "https://blog.naver.com/myloveidolactor/222477597584",
    ],
    "10": [
        "https://blog.naver.com/myloveidolactor/223604267932",
        "https://blog.naver.com/myloveidolactor/222507586499",
    ],
    "11": [
        "https://blog.naver.com/myloveidolactor/223640848856",
        "https://blog.naver.com/myloveidolactor/222544736544",
    ],
    "12": [
        "https://blog.naver.com/myloveidolactor/223679701117",
        "https://blog.naver.com/myloveidolactor/222568771394",
    ],
}

def normalize(text):
    return re.sub(r"[^\w가-힣]", "", str(text)).strip().lower()

# 🎂 생일 정보 수집
def extract_birthday_from_blog(month: str, url: str):
    print(f"[{month}월] 크롤링 중: {url}")
    headers = {"User-Agent": "Mozilla/5.0"}
    mobile_url = url.replace("blog.naver.com", "m.blog.naver.com")
    response = requests.get(mobile_url, headers=headers)

    if response.status_code != 200:
        print(f"❌ 요청 실패: {response.status_code}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    birthdays = []

    current_day = None
    for tag in soup.find_all(["b", "span"]):
        if tag.name == "b":
            text = tag.get_text(strip=True)
            if text.isdigit():
                current_day = text.zfill(2)
        elif tag.name == "span" and current_day:
            content = tag.get_text(strip=True)
            if content.startswith("🎂"):
                match = re.match(r"🎂\s*([^\s_]+)_([^\s_]+)", content)
                if match:
                    member, group = match.groups()
                    birthdays.append({
                        "member_name": member,
                        "artist_name": group,
                        "member_bday": f"{month}-{current_day}"
                    })

    return birthdays

# 전체 월 크롤링
def collect_all_birthdays():
    all_birthdays = []
    for month, urls in BLOG_URLS.items():
        for url in urls:
            all_birthdays.extend(extract_birthday_from_blog(month, url))
            time.sleep(0.5)
    return pd.DataFrame(all_birthdays)

# CSV 업데이트
def update_csv_file(birthday_df: pd.DataFrame):
    try:
        df = pd.read_csv(CSV_FILE_PATH, encoding="utf-8-sig")
    except:
        df = pd.read_csv(CSV_FILE_PATH, encoding="cp949")

    original_count = df["member_bday"].notna().sum()
    update_count = 0

    # 인덱싱용 정규화 딕셔너리
    full_index = {
        (normalize(row["member_name"]), normalize(row["artist_name"])): i
        for i, row in df.iterrows()
    }

    name_only_index = {}
    name_counts = df["member_name"].value_counts()
    for i, row in df.iterrows():
        name = row["member_name"]
        if name_counts[name] == 1:
            name_only_index[normalize(name)] = i

    for _, row in birthday_df.iterrows():
        norm_name = normalize(row["member_name"])
        norm_group = normalize(row["artist_name"])

        key = (norm_name, norm_group)

        if key in full_index:
            i = full_index[key]
            if pd.isna(df.at[i, "member_bday"]):
                df.at[i, "member_bday"] = row["member_bday"]
                update_count += 1
        elif norm_name in name_only_index:
            i = name_only_index[norm_name]
            if pd.isna(df.at[i, "member_bday"]):
                df.at[i, "member_bday"] = row["member_bday"]
                update_count += 1

    updated_path = os.path.splitext(CSV_FILE_PATH)[0] + "_bday.csv"
    df.to_csv(updated_path, index=False, encoding="utf-8-sig")

    print("\n 저장 완료")
    print(f" 저장 파일: {updated_path}")
    print(f" 기존 생일 수: {original_count}")
    print(f" 새로 추가된 생일 수: {update_count}")
    print(f" 총 아이돌 수: {len(df)}")
    print(f" 생일 정보 보유율: {(df['member_bday'].notna().mean() * 100):.2f}%")

# 실행
def main():
    birthday_df = collect_all_birthdays().drop_duplicates(subset=["member_name", "artist_name", "member_bday"])
    print(f"\n총 수집된 생일 정보: {len(birthday_df)}명")
    update_csv_file(birthday_df)

if __name__ == "__main__":
    main()


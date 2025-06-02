
import os
import pandas as pd

# 이미지가 저장된 폴더
image_folder = "static/image/member_namu_images"

# 폴더 내 .jpg 파일 목록 수집
filenames = [f for f in os.listdir(image_folder) if f.endswith(".jpg")]

# 아티스트명, 멤버명 추출 (파일명 형식: "아티스트_멤버.jpg")
records = []
for fname in filenames:
    name_part = fname.replace(".jpg", "")
    if "_" in name_part:
        artist, member = name_part.split("_", 1)
        records.append({
            "artist_name": artist,
            "member_name": member,
            "file_name": fname
        })

# DataFrame 생성 및 저장
df = pd.DataFrame(records)
df.to_csv("member_images_index.csv", index=False, encoding="utf-8-sig")

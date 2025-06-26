import boto3
from django.conf import settings

AWS_ACCESS_KEY_ID = settings.AWS_ACCESS_KEY_ID,
AWS_SECRET_ACCESS_KEY =settings.AWS_SECRET_ACCESS_KEY,
AWS_STORAGE_BUCKET_NAME = 'oddoke-bucket'
AWS_S3_REGION_NAME = 'ap-northeast-2'

s3_client = boto3.client('s3',  aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY, region_name=AWS_S3_REGION_NAME)

s3_client.list_buckets()




import boto3
from django.conf import settings

# 문자열 형태로 강제 변환 후 클라이언트 생성
access_key = str(settings.AWS_ACCESS_KEY_ID).strip()
secret_key = str(settings.AWS_SECRET_ACCESS_KEY).strip()
region = str(settings.AWS_S3_REGION_NAME).strip()

print(f"Access Key 타입: {type(access_key)}")
print(f"Secret Key 타입: {type(secret_key)}")
print(f"Access Key 길이: {len(access_key)}")
print(f"Secret Key 길이: {len(secret_key)}")

# S3 클라이언트 생성
s3_client = boto3.client('s3',        aws_access_key_id=access_key,        aws_secret_access_key=secret_key,        region_name=region    )

# 버킷 목록 테스트
response = s3_client.list_buckets()
print("✅ S3 연결 성공!")
print(f"버킷 목록: {[bucket['Name'] for bucket in response['Buckets']]}")








s3_storage = S3Boto3Storage(bucket_name='oddoke-bucket',access_key=settings.AWS_ACCESS_KEY_ID,secret_key=settings.AWS_SECRET_ACCESS_KEY,region_name='ap-northeast-2',custom_domain='oddoke-bucket.s3.ap-northeast-2.amazonaws.com',default_acl=None
)
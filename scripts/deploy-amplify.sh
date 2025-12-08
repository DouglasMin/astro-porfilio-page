#!/usr/bin/env bash

set -euo pipefail

##
## Amplify + S3 기반 배포용 헬퍼 스크립트
## --------------------------------------
## 1) Astro 정적 사이트 빌드
## 2) dist → S3 버킷 동기화
## 3) (옵션) Amplify에 다시 배포 트리거
##
## 사용 전에 아래 변수들을 본인 환경에 맞게 채워주세요.
##

# 실제 환경에 맞춰 자동 설정됨
APP_ID="d3m8pthmupwl40"              # Amplify 앱 ID (astro portfolio website)
BRANCH_NAME="main"                    # Amplify 브랜치 이름
S3_BUCKET="astro-portfolio-website"   # S3 버킷 이름
S3_PREFIX=""                          # S3 prefix (루트면 빈 문자열)
AWS_PROFILE="dongik2"                 # AWS CLI 프로필

if [[ -z "$S3_BUCKET" ]]; then
  echo "❌ S3_BUCKET 이 설정되지 않았습니다. scripts/deploy-amplify.sh 파일을 열어 값을 채워주세요."
  exit 1
fi

echo "🚀 Astro 빌드 시작..."
npm run build

echo "📦 dist 폴더를 ZIP으로 압축 중..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ZIP_FILE="dist-${TIMESTAMP}.zip"
cd dist && zip -r ../"$ZIP_FILE" . && cd ..

echo "☁️ $ZIP_FILE → S3 업로드 중..."
aws s3 cp "$ZIP_FILE" "s3://$S3_BUCKET/$ZIP_FILE" --profile "$AWS_PROFILE"

ZIP_S3_URL="s3://$S3_BUCKET/$ZIP_FILE"
echo "📦 Amplify 재배포 트리거 중... (source: $ZIP_S3_URL)"
aws amplify start-deployment \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH_NAME" \
  --source-url "$ZIP_S3_URL" \
  --profile "$AWS_PROFILE" || {
    echo "⚠️ Amplify 재배포 실패."
    exit 1
  }

echo "🧹 로컬 ZIP 파일 정리..."
rm -f "$ZIP_FILE"

echo "✅ 배포 완료! Amplify가 S3에서 새 파일을 읽어와 배포 중입니다."
echo "   d3m8pthmupwl40.amplifyapp.com 에서 1~3분 내 확인 가능합니다."



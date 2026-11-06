#!/bin/sh
set -e
# 영구 디스크에 데이터·콘텐츠 폴더 준비. 콘텐츠가 없으면 기본 콘텐츠를 복사한다
# (이후 관리자 화면에서 고친 내용은 디스크에 남으므로 재배포해도 덮어쓰지 않는다).
mkdir -p "$DATA_DIR" "$CONTENT_DIR"
if ! ls "$CONTENT_DIR"/*.json >/dev/null 2>&1; then
  echo "[entrypoint] $CONTENT_DIR 가 비어 있어 기본 콘텐츠를 복사합니다."
  cp /app/content-default/*.json "$CONTENT_DIR"/
fi
chown -R node:node "$DATA_DIR" "$CONTENT_DIR"
exec su-exec node "$@"

import "server-only";
import path from "node:path";

// 배포 시 영구 디스크(볼륨)를 가리키도록 환경 변수로 바꿀 수 있다.
// 예) Render/Fly/Railway: DATA_DIR=/var/data/data, CONTENT_DIR=/var/data/content
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data"));
export const CONTENT_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.CONTENT_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "content"));

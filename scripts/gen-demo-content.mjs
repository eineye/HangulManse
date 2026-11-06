// content/*.json → lib/demo/default-content.json (브라우저 체험판의 기본 콘텐츠)
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("content");
const courses = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
fs.writeFileSync(path.resolve("lib/demo/default-content.json"), JSON.stringify(courses) + "\n");
console.log(`lib/demo/default-content.json: ${courses.length} courses`);

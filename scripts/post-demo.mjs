// 체험판 정적 출력(out/) 마무리: GitHub Pages용 .nojekyll
import fs from "node:fs";

fs.writeFileSync("out/.nojekyll", "");
const files = fs.readdirSync("out", { recursive: true }).filter((f) => f.endsWith(".html"));
console.log(`out/: ${files.length} HTML pages (${files.filter((f) => !f.includes("_next")).join(", ")})`);

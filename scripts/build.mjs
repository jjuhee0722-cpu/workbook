import { readFile, writeFile } from "node:fs/promises";
import { transform } from "@babel/standalone";

const sourcePath = new URL("../src/index.html", import.meta.url);
const outputPath = new URL("../index.html", import.meta.url);
const html = await readFile(sourcePath, "utf8");
const pattern = /<script type="text\/babel" data-presets="react">\n([\s\S]*?)\n<\/script>/;
const match = html.match(pattern);

if (!match) {
  throw new Error("src/index.html does not contain the expected React JSX script.");
}

const compiled = transform(match[1], {
  presets: [["react", { runtime: "classic" }]],
  compact: false,
  comments: true,
}).code;

const output = html
  .replace(/\n<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>/, "")
  .replace(match[0], `<script>\n${compiled}\n</script>`);

await writeFile(outputPath, output);
console.log(`Built index.html (${output.length} bytes)`);

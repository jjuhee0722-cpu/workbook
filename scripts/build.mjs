import { writeFile } from "node:fs/promises";
import { transform } from "@babel/standalone";
import {loadAppSource,sourcePattern} from './source.mjs';

const outputPath = new URL("../index.html", import.meta.url);
const {html,source}=await loadAppSource();

const compiled = transform(source, {
  presets: [["react", { runtime: "classic" }]],
  compact: false,
  comments: true,
}).code;

let included=false;
const output = html
  .replace(/\n<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>/, "")
  .replace(sourcePattern,()=>{
    if(included)return '';
    included=true;
    return `<script>\n${compiled}\n</script>`;
  });

await writeFile(outputPath, output);
console.log(`Built index.html (${output.length} bytes)`);

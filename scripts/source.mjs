import {readFile} from 'node:fs/promises';

export const sourcePattern=/<script type="text\/babel" data-presets="react" src="\.\/([^\"]+)"><\/script>/g;
export async function loadAppSource(){
  const template=new URL('../src/index.html',import.meta.url);
  const html=await readFile(template,'utf8');
  const files=[...html.matchAll(sourcePattern)].map(m=>m[1]);
  if(!files.length)throw new Error('No app source files found in src/index.html');
  const parts=await Promise.all(files.map(file=>{
    if(!/^[\w/.-]+\.(js|jsx)$/.test(file)||file.split('/').includes('..'))throw new Error('Invalid source file: '+file);
    return readFile(new URL(file,template),'utf8');
  }));
  return {html,files,source:parts.join('\n')};
}

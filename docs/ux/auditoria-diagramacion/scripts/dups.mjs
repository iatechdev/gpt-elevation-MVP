import fs from 'fs'; import path from 'path'
const files=[];(function w(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())w(p);else if(p.endsWith('.css'))files.push(p)}})('.')
const map=new Map()
for(const f of files){const src=fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' '))
 const lines=src.split('\n');let depth=0
 // rules at depth 0 and inside @media (record media)
 const re=/([^{}@][^{}]*)\{([^{}]*)\}/g;let m
 const stack=[]
 // simple: iterate with media tracking
 let i=0,media=''
 const tok=/(@media[^{]*\{)|([^{}]+)\{([^{}]*)\}|(\})/g
 let t,open=[]
 while((t=tok.exec(src))){
  if(t[1]){open.push(t[1].slice(0,-1).trim());continue}
  if(t[4]){open.pop();continue}
  const sel=t[2].trim(),body=t[3];if(sel.startsWith('@'))continue
  const line=src.slice(0,t.index+t[0].indexOf(sel)).split('\n').length
  const med=open.join(' ')
  for(const s of sel.split(',').map(x=>x.trim().replace(/\s+/g,' '))){
   for(const d of body.split(';')){const k=d.split(':')[0].trim();if(!k||k.startsWith('--'))continue
    const key=s+'|'+med+'|'+k
    if(!map.has(key))map.set(key,[]);map.get(key).push(f+':'+line+' '+d.trim().slice(0,60))}}}
}
const out=[]
for(const [k,v] of map){const fl=new Set(v.map(x=>x.split(':')[0]));if(fl.size>1)out.push(k+'  <= '+v.join(' || '))}
console.log(out.length);console.log(out.join('\n').slice(0,6000))

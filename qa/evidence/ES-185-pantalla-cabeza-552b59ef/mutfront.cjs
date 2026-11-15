const fs=require('fs');const p='C:/Users/Usuario/Documents/qa-pr-test/frontend/src/pages/admin/AdminContent.tsx';let s=fs.readFileSync(p,'utf8');
const a="...(p.isActive ? {} : { background: '#F1EFEC', border: '1px dashed #78716C' })";
if(s.split(a).length!==2) throw new Error('no unico');
fs.writeFileSync(p,s.replace(a,()=>"opacity: p.isActive ? 1 : 0.5"));console.log('mut ok');

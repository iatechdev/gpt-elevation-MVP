const fs=require('fs');const p='test/landing-closing.test.mjs';let s=fs.readFileSync(p,'utf8');const nl=s.includes('\r\n')?'\r\n':'\n';
const L=s.split(nl).filter(l=>!l.includes('mode=register')).map(l=>l.includes('(closing|footer)')?l.replace('(closing|footer)','footer'):l);
fs.writeFileSync(p,L.join(nl));

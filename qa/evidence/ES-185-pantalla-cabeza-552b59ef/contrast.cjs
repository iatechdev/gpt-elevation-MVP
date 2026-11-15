const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const cr=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2)};
const bg='#F1EFEC';for(const [n,f,b] of [['nombre #1C1917',"#1C1917",bg],['precio #4A4A4A',"#4A4A4A",bg],['identificador #57534E',"#57534E",bg],['característica #4A4A4A sobre #FFFFFF',"#4A4A4A","#FFFFFF"]])console.log(n,'→',cr(f,b));

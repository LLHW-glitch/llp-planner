const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'#tpl-wplan');await p.waitForTimeout(600);
for(const [d,t] of [[0,0],[1,1],[2,0],[3,2],[4,0],[5,3],[6,4]]){ await p.click(`.wpc >> nth=${d} >> .wpt button >> nth=${t}`); await p.waitForTimeout(120);} 
await p.fill('.wpc >> nth=0 >> input[aria-label="Exercise"] >> nth=0','Squats');await p.fill('.wpc >> nth=0 >> input[aria-label="Sets and reps"] >> nth=0','3×12');await p.click('.wpc >> nth=0 >> .wpdone');await p.waitForTimeout(200);
await p.screenshot({path:'s-wplan.png'});
await p.goto(url+'#day-20270105');await p.waitForTimeout(500);await p.screenshot({path:'s-rem.png',clip:{x:900,y:150,width:420,height:150}});
await p.goto(url+'#month-1');await p.waitForTimeout(600);await p.click('#stickerBtn');await p.waitForTimeout(300);await p.screenshot({path:'s-tray.png'});
// synthetic drop on a day cell
const cell=await p.$('a.cell[href="#day-20270112"]');const bb=await cell.boundingBox();
await p.evaluate(([x,y])=>{ stDrag='bin'; const ev=new DragEvent('drop',{clientX:x,clientY:y,bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}); document.getElementById('sheet').dispatchEvent(ev); },[bb.x+bb.width/2,bb.y+bb.height/2]);
await p.waitForTimeout(400);
await p.click('[data-sttab="cute"]');await p.waitForTimeout(200);for(const s of ['heart','flower','sparkle']){ await p.click(`[data-stadd="${s}"]`); await p.waitForTimeout(150);} 
await p.screenshot({path:'s-deco.png'});
// move a sticker
const st=await p.$('.stk >> nth=1');const sb=await st.boundingBox();await p.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2);await p.mouse.down();await p.mouse.move(sb.x+200,sb.y+100,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
await p.click('[data-stdone]');await p.waitForTimeout(300);await p.screenshot({path:'s-done.png'});
await p.goto(url+'#month-1');await p.waitForTimeout(600);console.log('pill', await p.$$eval('a.cell[href="#day-20270112"] *',x=>x.map(y=>y.textContent).join('|').slice(0,200)));
console.log(errs);await b.close();})();

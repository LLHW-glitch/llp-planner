const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'#tpl-reading');await p.waitForTimeout(500);await p.click('[data-bknew]');await p.waitForTimeout(250);await p.fill('.bkcard input[aria-label="Title"]','Atomic Habits');await p.fill('.bkcard input[aria-label="Author"]','James Clear');await p.press('.bkcard input[aria-label="Author"]','Tab');await p.setInputFiles('.bkcard input[type=file]','sample.jpg');await p.waitForTimeout(400);await p.click('.bprog button:has-text("60%")');await p.waitForTimeout(200);await p.click('[data-bkclose]');
await p.goto(url+'#brain');await p.waitForTimeout(600);await p.click('#stickerBtn');await p.click('[data-sttab="widgets"]');await p.waitForTimeout(200);await p.screenshot({path:'w-tray.png'});
const pos=[[17,28],[47,28],[77,28],[17,70],[47,70],[77,70]];const ws=['reading','listening','watching','quote','priorities','progress'];
await p.click('[data-stdone]');await p.waitForTimeout(200);
for(let i=0;i<ws.length;i++){ await p.click('#stickerBtn'); await p.waitForTimeout(100); if(i===0){ await p.click('[data-sttab="widgets"]'); } await p.click(`[data-stadd="w:${ws[i]}"]`); await p.click('[data-stdone]'); await p.waitForTimeout(150);
  const h=p.locator('.stk.isw .wgh').nth(i);const bb=await h.boundingBox();const sh=await p.locator('#sheet').boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(sh.x+sh.width*pos[i][0]/100,sh.y+sh.height*pos[i][1]/100-70,{steps:5});await p.mouse.up();await p.waitForTimeout(100);}
await p.screenshot({path:'w-mid.png'});await p.fill('.wg-listening input[aria-label="Title"]','Espresso');await p.fill('.wg-listening input[aria-label="Artist(s)"]','Sabrina Carpenter');await p.click('.wg-listening .wctrl button');await p.waitForTimeout(200);
await p.fill('.wg-watching input[aria-label="Title"]','The Bear');await p.fill('.wg-watching input[aria-label="Season / Episode"]','S3 E4');await p.click('.wg-watching .wstars button >> nth=3');await p.waitForTimeout(200);
await p.fill('.wg-quote textarea','Small steps every day.');await p.fill('.wg-priorities input >> nth=0','Finish the launch email');await p.click('.wg-priorities .wck >> nth=0');await p.waitForTimeout(200);
await p.fill('.wg-progress input','Planner launch');await p.click('.wg-progress .wprog button >> nth=1');await p.waitForTimeout(300);
await p.mouse.click(600,40);await p.waitForTimeout(200);await p.screenshot({path:'w-widgets.png'});
console.log(errs);await b.close();})();

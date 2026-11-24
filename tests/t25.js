const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'#brain');await p.waitForTimeout(600);
const ws=['loving3','playing','goals','tasks','list','groceries','habits','medication','eating','reflection','ratings','shopping'];
const sh=await p.locator('#sheet').boundingBox();
for(let i=0;i<ws.length;i++){ await p.click('#stickerBtn');await p.waitForTimeout(80); if(i===0) await p.click('[data-sttab="widgets"]'); await p.click(`[data-stadd="w:${ws[i]}"]`); await p.click('[data-stdone]'); await p.waitForTimeout(80);
  const h=p.locator('.stk.isw .wgh').nth(i);const bb=await h.boundingBox(); const cx=sh.x+sh.width*(0.13+0.25*(i%4)), cy=sh.y+sh.height*(0.08+0.32*Math.floor(i/4)); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(cx,cy,{steps:4});await p.mouse.up();
  // shrink to 18%
}
await p.click('.wg-habits .wdot >> nth=0');await p.click('.wg-habits .wdot >> nth=2');await p.click('.wg-eating .wwater button >> nth=4');await p.click('.wg-tasks .wcb >> nth=0');await p.fill('.wg-tasks .wi >> nth=0','Book MOT');await p.click('.wg-ratings .wstars button >> nth=3');
await p.mouse.click(700,40);await p.waitForTimeout(300);await p.screenshot({path:'w2.png'});
// undo test
const before=await p.$$eval('.wg-ratings .wstars button.on',x=>x.length);await p.click('#undoBtn');await p.waitForTimeout(300);const after=await p.$$eval('.wg-ratings .wstars button.on',x=>x.length);console.log('undo rating',before,'->',after);
await p.click('#undoBtn');await p.waitForTimeout(300);console.log('undo task text',await p.inputValue('.wg-tasks .wi >> nth=0'));
// recipes
await p.goto(url+'#recipes');await p.waitForTimeout(400);for(const n of ['Banana pancakes','Chicken traybake','Lemon drizzle']){ await p.click('[data-newrecipe]');await p.waitForTimeout(250);await p.fill('input[aria-label="Recipe name"]',n);await p.press('input[aria-label="Recipe name"]','Tab');await p.waitForTimeout(150);} await p.screenshot({path:'r2.png'});
// notes/labels
await p.goto(url+'#day-20270105');await p.waitForTimeout(500);await p.click('#stickerBtn');await p.click('[data-sttab="notes"]');await p.click('[data-stadd="c:note|check"]');await p.click('[data-stadd="c:note|grid"]');await p.click('[data-stadd="c:note|dots"]');await p.click('[data-stadd="c:tb|"]');await p.click('[data-sttab="labels"]');await p.click('[data-stadd="c:plbl|"]');await p.click('[data-stdone]');await p.waitForTimeout(200);
const P=[[60,35],[78,35],[60,75],[25,45],[80,80]];for(let i=4;i>=0;i--){ const bb=await p.locator('.stk').nth(i).boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(sh.x+sh.width*P[i][0]/100,sh.y+sh.height*P[i][1]/100,{steps:4});await p.mouse.up();}
await p.click('.stk.k-note .ckb >> nth=0');await p.click('.stk.k-note .ckb >> nth=2');
const tb=p.locator('.stk.k-tb');await tb.dblclick();await p.keyboard.type('Gym');await p.keyboard.press('Enter');await tb.click();const hb=await p.locator('.stk.k-tb .srs').boundingBox();await p.mouse.move(hb.x+5,hb.y+5);await p.mouse.down();await p.mouse.move(hb.x+40,hb.y+140,{steps:4});await p.mouse.up();
const pl=p.locator('.stk.k-plbl');await pl.dblclick();await p.keyboard.type('Pick up kids');await p.keyboard.press('Enter');await pl.click();await p.waitForTimeout(100);await pl.click();await p.waitForTimeout(100);await p.locator('.stk.k-plbl .pre').fill('Kids');await p.keyboard.press('Enter');
await p.mouse.click(700,40);await p.waitForTimeout(300);await p.screenshot({path:'n2.png'});
console.log(errs);await b.close();})();

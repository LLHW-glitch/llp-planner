const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'#recipes');await p.waitForTimeout(500);
for(const [n,c] of [['Banana pancakes',0],['Chicken traybake',2],['Lemon drizzle',4]]){ await p.click('[data-newrecipe]');await p.waitForTimeout(300);await p.fill('input[aria-label="Recipe name"]',n);await p.press('input[aria-label="Recipe name"]','Tab');await p.click(`.rcats button >> nth=${c}`);await p.waitForTimeout(200);}
await p.fill('input[aria-label="Serves"]','8');await p.fill('input[aria-label="Prep and cook time"]','1 hr');
for(const [j,t] of [[0,'225g self-raising flour'],[1,'225g butter'],[2,'225g caster sugar'],[3,'4 eggs'],[4,'2 lemons']]){ await p.fill(`.rcard2 >> nth=0 >> input.line >> nth=${j}`,t); }
await p.click('.rcard2 >> nth=0 >> input.chk >> nth=0');await p.waitForTimeout(200);await p.click('.rcard2 >> nth=0 >> input.chk >> nth=1');await p.waitForTimeout(200);
await p.fill('.rstep >> nth=0','Heat the oven to 180C and line a loaf tin.');await p.fill('.rstep >> nth=1','Beat the butter and sugar until pale and fluffy.');
await p.click('.rheart');await p.waitForTimeout(200);await p.setInputFiles('.rbig input[type=file]','sample.jpg');await p.waitForTimeout(500);
await p.screenshot({path:'r1.png'});
await p.click('[data-ui="recFilter|fav"]');await p.waitForTimeout(200);console.log('fav cards',await p.$$eval('.rcard b',x=>x.map(y=>y.textContent)));
// labels stickers
await p.goto(url+'#day-20270105');await p.waitForTimeout(500);await p.click('#stickerBtn');await p.click('[data-sttab="labels"]');await p.waitForTimeout(200);await p.screenshot({path:'l-tray.png'});
await p.click('[data-stadd="c:lbl|Call"]');await p.click('[data-stadd="c:plbl|Call"]');await p.click('[data-stadd="c:fill|Thankful for"]');await p.click('[data-sttab="notes"]');await p.waitForTimeout(200);await p.screenshot({path:'n-tray.png'});await p.click('[data-stadd="c:note|pin"]');await p.click('[data-stadd="c:tb|"]');await p.click('[data-stadd="c:num|5"]');await p.click('[data-stdone]');await p.waitForTimeout(200);
const sh=await p.locator('#sheet').boundingBox();const P=[[60,40],[60,52],[85,60],[60,80],[25,40],[90,90]];
for(let i=5;i>=0;i--){ const bb=await p.locator('.stk').nth(i).boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(sh.x+sh.width*P[i][0]/100,sh.y+sh.height*P[i][1]/100,{steps:4});await p.mouse.up();}
// edit label via dblclick
const pl=p.locator('.stk.k-plbl');await pl.dblclick();await p.keyboard.type('Mum 6pm');await p.keyboard.press('Enter');
const nt=p.locator('.stk.k-note');await nt.dblclick();await p.keyboard.type('Buy birthday card');await p.mouse.click(700,40);
// stretch time block
const tb=p.locator('.stk.k-tb');await tb.click();const hb=await p.locator('.stk.k-tb .srs').boundingBox();await p.mouse.move(hb.x+5,hb.y+5);await p.mouse.down();await p.mouse.move(hb.x+60,hb.y+90,{steps:4});await p.mouse.up();await p.mouse.click(700,40);await p.waitForTimeout(300);
await p.screenshot({path:'l-day.png'});
await p.evaluate(()=>{document.documentElement.dataset.tone='blush'});await p.waitForTimeout(200);await p.screenshot({path:'l-day-blush.png'});
console.log(errs);await b.close();})();

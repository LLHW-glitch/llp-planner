const {chromium,devices}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const ctx=await b.newContext({...devices['iPhone 13']});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const routes=['dashboard','year','month-1','week','day-20270105','templates','tpl-travel','tpl-wplan','tpl-weight','tpl-gratitude','tpl-cleaning','tpl-wish','tpl-income','tpl-launch','tpl-reading','tpl-movie','recipes','brain','setup','tpl-savings','tpl-c52','meals'];
const over=[];
for(const r of routes){ await p.goto(url+'#'+r);await p.waitForTimeout(450); const w=await p.evaluate(()=>[document.documentElement.scrollWidth,innerWidth, [...document.querySelectorAll('#sheet *')].filter(e=>{const b=e.getBoundingClientRect();return b.right>innerWidth+2&&b.width>0&&!e.closest('.scroll,.hab,.ttabs,.stabs,.gstrip')}).slice(0,3).map(e=>e.tagName+'.'+(e.className||'').toString().slice(0,30))]); over.push(r+': '+JSON.stringify(w)); await p.screenshot({path:`mob-${r}.png`,fullPage:false}); }
console.log(over.join('\n'));
await p.goto(url+'#day-20270105');await p.waitForTimeout(400);await p.click('#stickerBtn');await p.waitForTimeout(300);await p.screenshot({path:'mob-tray.png'});await p.click('[data-stadd="misc-29"]');await p.click('[data-sttab="widgets"]');await p.click('[data-stadd="w:quote"]');await p.click('[data-sttab="labels"]');await p.click('[data-stadd="c:lbl|Call"]');await p.click('[data-stdone]');await p.waitForTimeout(300);await p.screenshot({path:'mob-stk.png'});
console.log(errs);await b.close();})();

const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
const go=async h=>{await p.goto(url+'#'+h);await p.waitForTimeout(600);};
await go('tpl-travel'); for(const n of ['France','Italy','Spain','United States of America','Japan']) { await p.click(`.wmap path:has(title:text-is("${n}"))`,{force:true}); await p.waitForTimeout(120);} await p.click(`.wmap path:has(title:text-matches("^Australia"))`,{force:true});await p.waitForTimeout(120);await p.click(`.wmap path:has(title:text-matches("^Australia"))`,{force:true});await p.waitForTimeout(150);
await p.fill('input[aria-label="Destination"]','Lisbon');await p.press('input[aria-label="Destination"]','Tab');await p.waitForTimeout(200);await p.screenshot({path:'v-travel.png'});
await go('tpl-savings'); await p.fill('input[placeholder="What are you saving for?"]','Holiday'); await p.fill('input[placeholder^="Target"]','1000'); await p.press('input[placeholder^="Target"]','Tab'); await p.waitForTimeout(200); await p.screenshot({path:'v-savings.png'});
for(const t of ['debt','c52','c30','weight','gratitude','selfcare','cleaning','wish','movie','series','subs']){ await go('tpl-'+t); if(t==='c30'){ for(const d of [1,2,3,5]) { await p.click(`.dc >> nth=${d-1}`); await p.waitForTimeout(120);} } if(t==='weight'){ for(const [w,v] of [[0,70],[1,69.4],[2,69],[4,68.2]]){ await p.fill(`.wc input >> nth=${w}`,String(v)); } await p.fill('input[aria-label="Goal weight"]','65'); await p.press('input[aria-label="Goal weight"]','Tab'); await p.waitForTimeout(300);} if(t==='gratitude'){ await p.click('.faces button >> nth=3'); await p.waitForTimeout(200);} await p.screenshot({path:'v-'+t+'.png'}); }
await go('templates'); await p.screenshot({path:'v-hub.png'});
const over=await p.evaluate(()=>document.documentElement.scrollHeight>innerHeight);console.log('page scroll',over);
console.log(errs);await b.close();})();

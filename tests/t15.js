const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'#tpl-savings');await p.waitForTimeout(700);await p.click('a.pill:has-text("All templates")');await p.waitForTimeout(300);console.log('all templates goes to',await p.evaluate(()=>location.hash));
await p.goto(url+'#tpl-reading');await p.waitForTimeout(600);
const books=[['Becoming','Michelle Obama',448,5,100],['Atomic Habits','James Clear',320,4,60],['The Midnight Library','Matt Haig',288,4,100],['Educated','Tara Westover',352,5,30],['Big Magic','Elizabeth Gilbert',288,3,0],['Untamed','Glennon Doyle',352,4,0]];
for(const [t,a,pg,r,pr] of books){ await p.click("[data-bknew]"); await p.waitForTimeout(250); await p.fill('.bkcard input[aria-label="Title"]',t); await p.fill('.bkcard input[aria-label="Author"]',a); await p.fill('.bkcard input[aria-label="No. of pages"]',String(pg)); await p.press('.bkcard input[aria-label="No. of pages"]','Tab');
  await p.click(`.bkcard .bstars button >> nth=${r-1}`); await p.waitForTimeout(150); if(pr) { await p.click(`.bprog button:has-text("${pr}%")`); await p.waitForTimeout(150);} if(t==='Becoming'){ await p.setInputFiles('.bkcard input[type=file]','sample.jpg'); await p.waitForTimeout(400); await p.fill('.quotebox textarea','Do we settle for the world as it is, or do we work for the world as it should be?'); await p.fill('[aria-label="Notes"].box, .bkcard .box.fill','Loved it'); }
  if(t==='Becoming') await p.screenshot({path:'bk-pop.png'}); await p.click('[data-bkclose]'); await p.waitForTimeout(200); }
await p.screenshot({path:'bk-shelf.png'});await p.click('[data-bkview="shelf"]');await p.waitForTimeout(300);await p.screenshot({path:'bk-covers.png'});await p.click('[data-bkview="quotes"]');await p.waitForTimeout(300);await p.screenshot({path:'bk-quotes.png'});
console.log(errs);await b.close();})();

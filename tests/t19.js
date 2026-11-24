const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
const go=async h=>{await p.goto(url+'#'+h);await p.waitForTimeout(600);};
await go('tpl-travel');await p.fill('input[aria-label="Destination"]','Lisbon');await p.fill('input[aria-label="Country"]','Portugal');await p.press('input[aria-label="Country"]','Tab');await p.waitForTimeout(300);
await p.click('text=+ New trip');await p.waitForTimeout(300);await p.fill('input[aria-label="Destination"]','Tokyo');await p.fill('input[aria-label="Country"]','Japan');await p.press('input[aria-label="Country"]','Tab');await p.waitForTimeout(300);await p.screenshot({path:'w-travel.png'});
await go('vision');const fi=await p.$$('input[type=file]');for(let i=0;i<3&&i<fi.length;i++){ await (await p.$$('input[type=file]'))[i].setInputFiles('sample.jpg'); await p.waitForTimeout(400);} 
for(const h of ['year','tpl-c52','tpl-income','tpl-launch','tpl-clients','tpl-bgoals','dashboard','templates']){ await go(h); await p.screenshot({path:'w-'+h+'.png'}); }
console.log(errs);await b.close();})();

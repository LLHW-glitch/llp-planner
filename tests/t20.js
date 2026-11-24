const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();
await p.goto(url+'#setup');await p.waitForTimeout(600);await p.click('button.sw:has-text("Arctic")');await p.waitForTimeout(300);
for(const h of ['dashboard','month-1','week','tpl-travel','tpl-c52','templates']){await p.goto(url+'#'+h);await p.waitForTimeout(600);await p.screenshot({path:'a-'+h+'.png'});}
await b.close();})();

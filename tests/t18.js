const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(url+'#tpl-travel');await p.waitForTimeout(600);
const tabs=async()=>console.log(await p.$$eval('.trtabs button',x=>x.map(y=>y.textContent+(y.classList.contains('solid')?'*':''))));
await tabs(); await p.click('text=+ New trip');await p.waitForTimeout(300);await tabs();await p.click('text=+ New trip');await p.waitForTimeout(300);await tabs();
await p.screenshot({path:'v-trip.png'});console.log(errs);await b.close();})();

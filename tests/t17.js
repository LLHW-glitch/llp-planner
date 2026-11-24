const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();
await p.goto(url+'#tpl-savings');await p.waitForTimeout(600);await p.fill('input[placeholder^="Target"]','1000');await p.fill('td input[aria-label="amt"] >> nth=0','420');await p.press('td input[aria-label="amt"] >> nth=0','Tab');await p.waitForTimeout(300);
await p.goto(url+'#tpl-debt');await p.waitForTimeout(600);await p.fill('input[placeholder="Balance"]','2000');await p.fill('td input[aria-label="amt"] >> nth=0','1300');await p.press('td input[aria-label="amt"] >> nth=0','Tab');await p.waitForTimeout(300);await p.screenshot({path:'v-debt2.png',clip:{x:40,y:200,width:700,height:300}});
await p.goto(url+'#tpl-savings');await p.waitForTimeout(600);await p.screenshot({path:'v-sav2.png',clip:{x:40,y:200,width:700,height:300}});await b.close();})();

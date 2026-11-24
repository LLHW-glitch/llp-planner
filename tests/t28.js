const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
fs.writeFileSync('t2.html','<!doctype html><html><head><meta charset=utf-8><script>'+fs.readFileSync('mock.js','utf8')+'</script></head><body>'+fs.readFileSync('index.html','utf8')+'</body></html>');
const url='file://'+process.cwd()+'/t2.html';const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();p.on('pageerror',e=>errs.push(e.message));
const rs=['templates','tpl-sinking','tpl-paycheck','tpl-nospend','tpl-fitgoals','tpl-contacts','tpl-lists','tpl-christmas','tpl-events','tpl-matrix','tpl-routines','tpl-meetings','tpl-memories','tpl-mmeal','tpl-c52'];
for(const r of rs){ await p.goto(url+'#'+r);await p.waitForTimeout(450);
 if(r==='tpl-sinking'){ await p.fill('.sfcard >> nth=0 >> input.line >> nth=0','Christmas');await p.fill('.sfcard >> nth=0 >> .sft','600');await p.fill('.sfcard >> nth=0 >> .sfs','240'); }
 if(r==='tpl-nospend'){ for(const i of [3,4,6,9]) await p.click(`.nsd >> nth=${i}`); }
 if(r==='tpl-meetings'){ await p.click('[data-mtnew]');await p.waitForTimeout(300);await p.fill('.sctitle','Team catch up'); }
 if(r==='tpl-contacts'){ await p.fill('.ctc >> nth=0 >> input >> nth=0','Sarah Jones'); }
 if(r==='tpl-memories'){ await p.setInputFiles('.memph input >> nth=0','sample.jpg');await p.waitForTimeout(300);await p.fill('.memcap >> nth=0','First day of school'); }
 await p.screenshot({path:'n-'+r+'.png'}); }
await p.goto(url+'#tpl-contacts');await p.waitForTimeout(300);await p.click('[data-ui="tpl-contacts:t|p"]');await p.waitForTimeout(200);await p.screenshot({path:'n-tpl-pw.png'});
console.log(errs);await b.close();})();

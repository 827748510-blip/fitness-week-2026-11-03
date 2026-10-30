// Uses the already installed cloud Chromium. No hosted CI or real sync access.
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  fs.mkdirSync(path.join(__dirname,'../output/playwright'),{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
  const results=[];
  const suites=process.argv.slice(2);
  try{
    for(const name of suites.length?suites:['browser-smoke','cloud-extended-browser-smoke','cloud-journal-browser-smoke','gallery-browser-smoke']){
      const page=await browser.newPage();
      try{
        const run=vm.runInThisContext('('+fs.readFileSync(path.join(__dirname,name+'.js'),'utf8')+')');
        await run(page);
        const reports=await page.evaluate(()=>Object.fromEntries(Object.getOwnPropertyNames(globalThis).filter(key=>/^fitness.*Report$/.test(key)).map(key=>[key,globalThis[key]])));
        results.push({suite:name,status:'PASS',reports});console.log(JSON.stringify(results.at(-1)));
      }catch(error){results.push({suite:name,status:'FAIL',error:error.stack});console.log(JSON.stringify(results.at(-1)));}
      finally{await page.close();}
    }
    fs.writeFileSync(path.join(__dirname,'../output/playwright/cloud-browser-results.json'),JSON.stringify(results,null,2)+'\n');
    if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
  }finally{await browser.close();}
})();

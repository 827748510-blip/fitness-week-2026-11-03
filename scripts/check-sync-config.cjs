// Read-only publication preflight. It never contacts a sync service.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context={window:{},URL};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'sync-config.js'),'utf8'),context);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const policy=html.slice(html.indexOf('function validateSyncConfig('),html.indexOf('const SYNC ='));
vm.runInContext(policy,context);
const config=context.validateSyncConfig(context.window.FITNESS_SYNC_CONFIG,'https://827748510-blip.github.io/fitness-week-2026-11-03/');
const unsafe=Object.keys(context.window.FITNESS_SYNC_CONFIG||{}).some(key=>!['enabled','endpoint'].includes(key))||/https?:\/\/[^\s"']*\.invalid\b|editToken\s*:|Authorization\s*:\s*["']Bearer/.test(html+fs.readFileSync(path.join(root,'sync-config.js'),'utf8'));
console.log(JSON.stringify({syncConfigured:config.enabled,reason:config.reason||'Requires independent authenticated relay verification',unsafeInlineConfig:unsafe,networkRequests:0}));
if(unsafe)process.exitCode=1;
else if(process.argv.includes('--require-sync')&&!config.enabled)process.exitCode=2;

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
test('all 64 reference sheets have complete, hash-matched previews and clear images',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/reference/manifest.json'),'utf8'));
  assert.equal(manifest.assets.length,64);
  const files=new Set();let bytes=0;
  for(const entry of manifest.assets){
    for(const size of ['thumb','full']){
      const output=entry.output[size],file=fs.readFileSync(path.join(root,output.src));
      assert.equal(file.length,output.bytes);assert.equal(crypto.createHash('sha256').update(file).digest('hex'),output.sha256);
      assert.equal(file.subarray(8,12).toString(),'WEBP');assert(!files.has(output.src));files.add(output.src);bytes+=file.length;
    }
  }
  assert.equal(files.size,128);assert(bytes<12_000_000);
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'reference-data.js'),'utf8'),context);
  const data=context.window.FitnessReferenceData;assert.equal(data.length,32);
  assert.deepEqual(Array.from(data.filter(item=>item.pending),item=>item.id),['F01','F04','F14','F24','F26','F27']);
  for(const item of data)for(const kind of ['pose','muscle'])for(const size of ['thumb','full'])assert(files.has(item[kind][size].src));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const template=fs.readFileSync('src/index.template.html','utf8');
const root=fs.readFileSync('image-pipeline-builder.html','utf8');
const consumer=html=>html.slice(html.indexOf('      const Core = globalThis.NodeEditorCore;'));
const stable=html=>html.replace(/("generatedAtUtc"\s*:\s*")[^"]*(")/g,'$1BUILD_TIME$2').replaceAll('\r\n','\n');

test('root downloadable HTML contains the current Consumer shell',()=>assert.equal(consumer(root),consumer(template)));
test('canonical Core remains byte-for-byte aligned',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync('src/core/node-editor-core.mjs')).digest('hex'),'4a128cc388ee53df6beeaf3a8edf7c8b0db5347479884cdf669806908c619897');
});
test('aggregate repository check runs the complete Core and Consumer test suite',()=>{
  const check=fs.readFileSync('scripts/check-repository.ps1','utf8');
  assert.match(check,/node --test/);assert.match(check,/LASTEXITCODE/);
});
test('generated readable and self-extract releases match the downloadable root', {skip:!fs.existsSync('dist/index.html')},()=>{
  const readable=fs.readFileSync('dist/index.html','utf8');
  assert.equal(stable(root),stable(readable));
  const compact=fs.readFileSync('dist/index.self-extract.html','utf8');
  const payload=compact.match(/id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)?.[1];
  assert.ok(payload);assert.equal(gunzipSync(Buffer.from(payload,'base64')).toString('utf8'),readable);
});

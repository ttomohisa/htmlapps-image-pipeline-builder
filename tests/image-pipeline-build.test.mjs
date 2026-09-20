import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build = fs.readFileSync('build-standalone.ps1', 'utf8');
const template = fs.readFileSync('src/index.template.html', 'utf8');

test('standalone build injects the Image Pipeline consumer source exactly once', () => {
  assert.equal((template.match(/\/\* IMAGE_PIPELINE_SOURCE \*\//g) || []).length, 1);
  assert.match(build, /ImagePipelineSourcePath/);
  assert.match(build, /\/\* IMAGE_PIPELINE_SOURCE \*\//);
  assert.match(build, /Image Pipeline browser embed still contains an ES module export statement/);
});

test('consumer source is embedded before app bootstrap can read the consumer global', () => {
  const placeholderIndex = template.indexOf('/* IMAGE_PIPELINE_SOURCE */');
  const bootstrapIndex = template.indexOf("const Core = globalThis.NodeEditorCore;");
  assert.ok(placeholderIndex >= 0);
  assert.ok(bootstrapIndex > placeholderIndex);
});

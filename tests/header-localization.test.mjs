import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
const coreSource = fs.readFileSync('src/core/node-editor-core.mjs', 'utf8').replace(/export default NodeEditorCore;?/, '');

function element(source, id) {
  const tag = source.match(new RegExp(`<[^>]*id="${id}"[^>]*>`));
  assert.ok(tag, `${id} exists`);
  const attrs = Object.fromEntries([...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  const dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k,v]) => [k.slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase()),v]));
  return { id, attrs, dataset, textContent: '', title: attrs.title || '', setAttribute: (k, v) => { attrs[k] = v; } };
}
for (const file of ['src/index.template.html', 'dist/index.html', 'dist/index.self-extract.html', 'image-pipeline-builder.html']) {
  if (file.startsWith('dist/') && !fs.existsSync(file)) {
    test(`${file}: localized header requires a standalone build`, { skip: true }, () => {});
    continue;
  }
  let source = fs.readFileSync(file, 'utf8');
  if (file.includes('self-extract')) {
    const payload = source.match(/id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
    assert.ok(payload);
    source = gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
  }
  for (const [language, visible, label, help] of [['ja', 'EN', '英語に切り替え', '使い方'], ['en', 'JA', 'Switch to Japanese', 'Help']]) {
    test(`${file}: ${language} header and zoom labels stay localized`, () => {
      const controls = new Map(['languageButton', 'helpButton', 'zoomOutButton', 'zoomInButton'].map(id => ['#' + id, element(source, id)]));
      const helpButton = controls.get('#helpButton');
      const badge = { dataset: { i18n: 'localBadge' }, textContent: '' };
      const document = { documentElement: {}, querySelectorAll: selector => ({ '[data-i18n]': [badge], '[data-i18n-title]': [...controls.values()].filter(el => el.dataset.i18nTitle), '[data-i18n-aria-label]': [...controls.values()].filter(el => el.dataset.i18nAriaLabel) }[selector] || []) };
      const state = { sourceItems: [{ id: 'existing' }], batchResult: { name: 'existing.png' }, graph: { nodes: [{ id: 'existing' }] } };
      const before = JSON.stringify(state);
      const context = vm.createContext({ ...state, language, document, APP_CONFIG: { name: 'Image Pipeline Builder' }, $: id => controls.get(id), nodeCanvas: { setTranslator() {} }, renderInspector() {}, renderGraphStatus() {}, renderRecipeList() {}, renderQuickRecipes() {}, applyPaletteSearch() {} });
      const start = source.indexOf('const messages={');
      const end = source.indexOf('const AppToast=', start);
      assert.ok(start >= 0 && end > start);
      vm.runInContext(coreSource + '\nconst Core = globalThis.NodeEditorCore;\n' + source.slice(start, end), context);
      context.setTextTranslations();
      const languageButton = controls.get('#languageButton');
      assert.equal(languageButton.textContent, visible);
      assert.equal(languageButton.attrs['aria-label'], label);
      assert.equal(languageButton.title, label);
      assert.equal(helpButton.attrs['aria-label'], help);
      assert.equal(helpButton.title, help);
      for (const [id, ja, en] of [['zoomOutButton', '縮小', 'Zoom out'], ['zoomInButton', '拡大', 'Zoom in']]) {
        const button = controls.get('#' + id);
        assert.equal(button.attrs['aria-label'], language === 'ja' ? ja : en);
        assert.equal(button.title, language === 'ja' ? ja : en);
      }
      assert.equal(badge.textContent, language === 'ja' ? '完全ローカル処理' : 'Fully local processing');
      assert.equal(JSON.stringify(state), before);
    });
  }
}

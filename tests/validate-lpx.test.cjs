const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
for (const name of ['红果短剧去广告', '盯盯拍去广告', '百度地图去广告']) {
  test(`${name} 的 lpx 和原插件内容一致`, () => {
    const dir = path.join(__dirname, '../Plugin');
    assert.equal(fs.readFileSync(path.join(dir, name + '.lpx'), 'utf8'), fs.readFileSync(path.join(dir, name + '.plugin'), 'utf8'));
  });
}


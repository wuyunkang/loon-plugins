const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function diagnostic() {
  const filename = 'BaiduMap_remove_ads.lpx';
  const content = fs.readFileSync(path.join(__dirname, '../Plugin', filename), 'utf8');
  const date = /^#!date=(.+)$/m.exec(content)[1];
  const version = date.replace(/[-: ]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
  const lines = content.split(/\r?\n/);
  const headers = lines.filter(line => /^(request|response) /.test(line) && line.includes('.header.')).map(line => {
    const match = /^(request|response) if \$\{url\} ~= \/(.*)\/i then (.+)$/.exec(line);
    assert.ok(match, line);
    const commands = match[3].split(' | ').map(command => {
      const action = /^(request|response)\.header\.(set|del)\((.+)\)$/.exec(command);
      assert.ok(action, command);
      assert.equal(action[1], match[1]);
      const args = JSON.parse(`[${action[3]}]`);
      assert.equal(args.length, action[2] === 'set' ? 2 : 1);
      return { action: action[2], args };
    });
    return { phase: match[1], pattern: new RegExp(match[2], 'i'), commands };
  });
  return { content, date, version, filename, headers };
}

function applyHeaders(phase, url, original) {
  const result = structuredClone(original);
  for (const rule of diagnostic().headers.filter(rule => rule.phase === phase && rule.pattern.test(url))) {
    for (const command of rule.commands) {
      const [name, value] = command.args;
      for (const key of Object.keys(result)) if (key.toLowerCase() === name.toLowerCase()) delete result[key];
      if (command.action === 'set') result[name] = value;
    }
  }
  return result;
}

test('诊断版名称与响应标记使用同一个带时分的版本，沿用原导入文件路径', () => {
  const { content, date, version, filename, headers } = diagnostic();
  assert.match(date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.ok(content.includes(`#!name=百度地图去广告·诊断 ${date}\n`));
  assert.ok(content.includes(`#!date=${date}\n`));
  assert.equal(filename, 'BaiduMap_remove_ads.lpx');
  assert.equal(headers.length, 3);
  assert.doesNotMatch(content, /^\[Script\]|script-path=|\.jq_file\(/m);
});

test('首页与我的响应标记可区分，不伪称 JQ 已成功修改正文', () => {
  const { version } = diagnostic();
  for (const [pathname, target] of [
    ['/feed/govui/rich_content', 'rich-content'], ['/usercenter/mine/page', 'mine-page'],
  ]) {
    const result = applyHeaders('response', `https://newclient.map.baidu.com${pathname}?sv=22.2.0`,
      { 'Content-Type': 'application/json', 'X-Server': 'keep' });
    assert.equal(result['X-BMap-Diag-Version'], version);
    assert.equal(result['X-BMap-Diag-Target'], target);
    assert.equal(result['Cache-Control'], 'no-store');
    assert.equal(result['X-Server'], 'keep');
    assert.ok(!Object.keys(result).some(key => /jq.*success/i.test(key)));
  }
});

test('只对两个诊断接口取消 HTTP 条件缓存，保留认证及业务请求头', () => {
  const original = { 'if-none-match': 'fixture-etag', 'If-Modified-Since': 'fixture-date',
    'Cache-Control': 'max-age=60', Authorization: 'fixture-token', Cookie: 'fixture-cookie', Accept: 'application/json' };
  const before = structuredClone(original);
  for (const pathname of ['/feed/govui/rich_content', '/usercenter/mine/page']) {
    const result = applyHeaders('request', `https://newclient.map.baidu.com:443${pathname}/?from=homepage`, original);
    assert.deepEqual(result, { Authorization: 'fixture-token', Cookie: 'fixture-cookie',
      Accept: 'application/json', 'Cache-Control': 'no-cache' });
  }
  assert.deepEqual(original, before);
});

test('相似路径、伪造主机、定位和导航接口不加入诊断标记', () => {
  for (const url of [
    'https://newclient.map.baidu.com/client/phpui2/?qt=multinavi',
    'https://newclient.map.baidu.com/client/phpui2/?qt=rgc',
    'https://newclient.map.baidu.com/usercenter/mine/pageOther',
    'https://newclient.map.baidu.com/feed/govui/rich_content/other',
    'https://newclient.map.baidu.com.example.test/usercenter/mine/page',
    'https://ecom.map.baidu.com/usercenter/mine/page',
  ]) {
    assert.deepEqual(applyHeaders('request', url, { Keep: 'original' }), { Keep: 'original' });
    assert.deepEqual(applyHeaders('response', url, { Keep: 'original' }), { Keep: 'original' });
  }
});

test('诊断版首页返回可见文字作为渲染探针，运动仍使用同一显式空对象处理', () => {
  const { content } = diagnostic();
  for (const [url, body, check] of [
    ['https://newclient.map.baidu.com/feed/govui/rich_content?from=homepage',
      { errno: 0, data: { posts: { content: [1], remain_num: 1, title: 'fixture' },
        themes: { content: [{ selected: true, query: { topic: 'default' } }] } } },
      data => {
        const component = data.data.posts.content[0].components[0].data;
        assert.equal(component.text, '百度地图');
        assert.equal(component.iconUrl, '');
        assert.equal(component.darkIconUrl, '');
      }],
    ['https://newclient.map.baidu.com/usercenter/mine/page',
      { error: 2000, data: { sport_card: { title: '百度运动' }, car: { keep: true } } },
      data => { assert.deepEqual(data.data.sport_card, {}); assert.deepEqual(data.data.car, { keep: true }); }],
  ]) {
    const filters = content.split(/\r?\n/).filter(line => line.includes('then response.json.jq(')).map(line => {
      const match = /^response if \$\{url\} ~= \/(.*)\/i && \$\{response\.status\} == 200 then response\.json\.jq\((".*")\)$/.exec(line);
      assert.ok(match, line);
      return { pattern: new RegExp(match[1], 'i'), jq: JSON.parse(match[2]) };
    }).filter(rule => rule.pattern.test(url));
    assert.equal(filters.length, 1);
    const result = spawnSync(process.env.BAIDUMAP_JQ_PATH || 'jq', ['-c', '--', filters[0].jq],
      { input: JSON.stringify(body), encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    check(JSON.parse(result.stdout));
  }
});

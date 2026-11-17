const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '../Script/ddpai-adblock.js');
const pluginPath = path.join(__dirname, '../Plugin/DDPai_remove_ads.lpx');
const adPath = '/onroad/api/v1/ad/list';
const bannerPaths = ['/onroad/api/v2/banner/list', '/market/api/v1/banner/list'];
const activityPaths = ['/onroad/api/v1/activity/list', '/onroad/api/v2/activity/list'];

function run(url, body, status = 200) {
  const calls = [];
  const request = { url, method: 'POST' };
  const response = { body: typeof body === 'string' ? body : JSON.stringify(body), status };
  const before = JSON.stringify({ request, response });
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), {
    $request: request, $response: response,
    $done: result => calls.push(JSON.parse(JSON.stringify(result))),
  }, { timeout: 1000 });
  assert.equal(calls.length, 1, '每次执行必须且只能调用一次 $done');
  assert.equal(JSON.stringify({ request, response }), before, '不修改运行时传入对象');
  return calls[0];
}

function url(p, host = 'appgw.ddpai.com:18080', scheme = 'http') {
  return `${scheme}://${host}${p}`;
}

test('清空抓包中的开屏、Banner、信息流和回前台第三方广告配置，保留其他字段', () => {
  const data = { error_code: 0, error_info: { thirdAds: [1, 2, 3, 4].map(position => ({
    code: 'tencent', position, status: 0, frequency: position === 1 ? 9070 : 5,
  })), other: { enabled: true } }, version: 'v1' };
  const result = JSON.parse(run(url(adPath), data).body);
  assert.deepEqual(result, { ...data, error_info: { ...data.error_info, thirdAds: [] } });
});

for (const p of bannerPaths) {
  for (const host of ['app.ddpai.com', 'appgw.ddpai.com:18080']) {
    for (const scheme of ['http', 'https']) {
      test(`清空横幅：${scheme}://${host}${p}，保留版本和成功码`, () => {
        const data = { error_info: [{ id: 2, coverPath: 'https://img1.ddpai.com/banner.png' }],
          error_code: 0, version: 'v0.0.0.2' };
        assert.deepEqual(JSON.parse(run(url(p, host, scheme) + '?position=1', data).body),
          { ...data, error_info: [] });
      });
    }
  }
}

for (const p of activityPaths) {
  test(`过滤延保推广，保留产品支持与应急服务：${p}`, () => {
    const promo = { id: 28, adLink: 'https://cdn.static.ddpai.com/h5/market/warranty/yanbao.html?ddpjs=input' };
    const support = { id: 1, adLink: 'https://www.ddpai.com/service/product-support/dash-cam' };
    const emergency = { id: 16, adLink: 'https://cdn.static.ddpai.com/h5/emergency.html' };
    const unknown = { id: 99, adLink: 'https://example.com/new-service' };
    const data = { error_code: 0, error_info: [promo, support, { ...promo, id: 13 }, emergency, unknown, null] };
    assert.deepEqual(JSON.parse(run(url(p), data).body),
      { ...data, error_info: [support, emergency, unknown, null] });
  });
}

for (const p of [
  '/d/api/v1/account/login', '/d/api/v1/termdev/', '/d/api/v2/app/config',
  '/d/api/v2/device/config', '/d/api/v1/storage/qquptoken', '/onroad/api/v1/story/list',
  '/version/api/v2/version/checkVersion', '/onroad/api/v1/devGuide/getMatchOne',
  '/onroad/api/v1/appRes/getMatchOne', '/subscription/api/v1/subscription/status',
  '/market/api/v1/ware/getWareDetail', '/market/api/v1/coupon/manage/couponShow',
  '/onroad/api/v1/promptArea/manage/queryAppPromptAreaList',
  '/onroad/api/v1/serviceArea/manage/queryAppServiceAreaList',
]) {
  test(`业务接口原样放行：${p}`, () => {
    assert.deepEqual(run(url(p), { error_code: 0, error_info: [{ adLink: 'keep' }] }), {});
  });
}

test('非目标主机、伪造主机、相似路径均不处理', () => {
  for (const u of [url(adPath, 'example.com'), url(adPath, 'app.ddpai.com.evil.test'),
    url(adPath + '/other'), url('/other' + adPath), 'not a url',
    'https://app.ddpai.com@evil.test' + adPath]) {
    assert.deepEqual(run(u, { error_code: 0, error_info: { thirdAds: [1] } }), {});
  }
});

test('失败响应、非 JSON、空内容和未知结构均原样放行', () => {
  const bodies = ['', '<html>error</html>', '{broken', 'null', '[]', '42',
    { error_code: 1, error_info: [1] }, { error_info: [1] },
    { error_code: '0', error_info: [1] }, { error_code: 0, error_info: {} },
    { error_code: 0, error_info: null }];
  for (const body of bodies) assert.deepEqual(run(url(bannerPaths[0]), body), {});
  for (const status of [302, 401, 500]) {
    assert.deepEqual(run(url(bannerPaths[0]), { error_code: 0, error_info: [1] }, status), {});
  }
  assert.deepEqual(run(url(adPath), { error_code: 0, error_info: { thirdAds: {} } }), {});
});

test('无广告和重复执行均不重写响应', () => {
  for (const p of [...bannerPaths, ...activityPaths]) {
    assert.deepEqual(run(url(p), '{ "error_code": 0, "error_info": [] }'), {});
  }
  assert.deepEqual(run(url(adPath), { error_code: 0, error_info: { thirdAds: [] } }), {});
  const changed = run(url(bannerPaths[0]), { error_code: 0, error_info: [1] });
  assert.deepEqual(run(url(bannerPaths[0]), changed.body), {});
});

test('插件只挂接目标接口，使用远程脚本和两个精确 MITM 主机', () => {
  const plugin = fs.readFileSync(pluginPath, 'utf8');
  const line = plugin.split(/\r?\n/).find(s => s.startsWith('http-response '));
  assert.ok(line, '必须注册响应脚本');
  const [, pattern, options] = line.match(/^http-response (\S+) (.+)$/);
  const re = new RegExp(pattern);
  for (const p of [adPath, ...bannerPaths, ...activityPaths]) {
    assert.ok(re.test(url(p)), p);
    assert.ok(re.test(url(p, 'app.ddpai.com', 'https') + '?x=1'), p);
    assert.ok(!re.test(url(p + '/other')), '路径必须完整匹配');
  }
  for (const u of [url('/d/api/v1/account/login'), url(adPath, 'evil.test'),
    url(adPath, 'app.ddpai.com.evil.test')]) assert.ok(!re.test(u), u);
  assert.match(options, /(?:^|,)\s*script-path=https:\/\/raw\.githubusercontent\.com\/wuyunkang\/loon-plugins\/main\/Script\/ddpai-adblock\.js(?:,|$)/);
  assert.match(options, /requires-body=true/);
  assert.match(plugin, /^hostname\s*=\s*app\.ddpai\.com,\s*appgw\.ddpai\.com\s*$/m);
  assert.doesNotMatch(plugin, /^DOMAIN(?:-SUFFIX)?,|^http-request |^hostname.*\*/m);
});

module.exports = { run };


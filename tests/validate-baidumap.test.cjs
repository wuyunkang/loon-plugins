const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

const pluginPath = path.join(__dirname, '../Plugin/BaiduMap_remove_ads.lpx');

function readPlugin() {
  const content = fs.readFileSync(pluginPath, 'utf8').replace(/\r\n/g, '\n');
  const sections = {};
  let section;
  for (const original of content.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#')) continue;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      section = header[1];
      assert.equal(sections[section], undefined, `不应重复声明配置段：${section}`);
      sections[section] = [];
    } else {
      assert.ok(section, `配置行必须属于某一段：${line}`);
      sections[section].push(line);
    }
  }
  assert.ok(sections.Rewrite?.length, '必须包含复写规则');
  const rewrites = sections.Rewrite.filter(line => !/^(?:request|response) /.test(line)).map(line => {
    const match = /^(\S+)\s+(reject(?:-200)?)$/.exec(line);
    assert.ok(match, `只能使用文档支持的本地拒绝动作：${line}`);
    return { pattern: new RegExp(match[1], 'i'), action: match[2] };
  });
  const hostname = /^hostname\s*=\s*(.+)$/.exec(sections.MITM?.[0] || '');
  assert.ok(hostname, '必须声明 HTTPS 解密主机');
  const hosts = hostname[1].split(',').map(value => value.trim());
  const domains = (sections.Rule || []).map(line => {
    const match = /^DOMAIN,([^,\s]+),REJECT$/.exec(line);
    assert.ok(match, `只允许精确的广告域名规则：${line}`);
    return match[1].toLowerCase();
  });
  const filters = sections.Rewrite.filter(line => line.includes('then response.json.jq(')).map(line => {
    const match = /^response if \$\{url\} ~= \/(.*)\/i && \$\{response\.status\} == 200 then response\.json\.jq\((".*")\)$/.exec(line);
    assert.ok(match, `JSON 复写必须限定 URL、HTTP 200 并使用内联 JQ：${line}`);
    return { pattern: new RegExp(match[1], 'i'), jq: JSON.parse(match[2]), status: 200 };
  });
  return { content, sections, rewrites, hosts, domains, filters };
}

function actions(url) {
  return readPlugin().rewrites.filter(rule => rule.pattern.test(url)).map(rule => rule.action);
}

const apiOrigin = 'https://newclient.map.baidu.com';

test('开屏广告命中，包括 22.2.0 的版本参数及任意参数顺序', () => {
  for (const query of ['qt=ads', 'qt=ads&sv=22.2.0', 'sv=22.2.0&qt=ads',
    'sv=22.2.0&qt=ads&os=iphone', 'qt=ads&x=a%26b', 'x=&qt=ads&']) {
    for (const pathname of ['/client/phpui2', '/client/phpui2/']) {
      assert.deepEqual(actions(`${apiOrigin}${pathname}?${query}`), ['reject-200']);
    }
  }
});

for (const qt of ['bar', 'hw']) {
  test(`首页横幅或搜索推广 qt=${qt} 精确匹配`, () => {
    const paths = qt === 'hw' ? ['/client/phpui', '/client/phpui2'] : ['/client/phpui2'];
    for (const pathname of paths) {
      for (const query of [`qt=${qt}`, `sv=22.2.0&qt=${qt}&x=1`]) {
        assert.deepEqual(actions(`${apiOrigin}${pathname}/?${query}`), ['reject-200']);
      }
    }
  });
}

for (const endpoint of ['/client/noticebar/get', '/client/crossmarketing']) {
  test(`首页通知横条或商业推广：${endpoint}`, () => {
    for (const suffix of ['', '/', '?sv=22.2.0', '/?sv=22.2.0']) {
      assert.deepEqual(actions(`${apiOrigin}${endpoint}${suffix}`), ['reject-200']);
    }
    assert.deepEqual(actions(`${apiOrigin}${endpoint}Other`), []);
    assert.deepEqual(actions(`${apiOrigin}${endpoint}/business`), []);
  });
}

test('API 规则兼容 HTTP、HTTPS 和显式端口', () => {
  for (const scheme of ['http', 'https']) {
    for (const port of ['', ':443', ':18080']) {
      for (const target of ['/client/phpui2/?qt=ads', '/client/phpui2/?qt=bar',
        '/client/phpui/?qt=hw', '/client/noticebar/get', '/client/crossmarketing']) {
        assert.deepEqual(actions(`${scheme}://newclient.map.baidu.com${port}${target}`),
          ['reject-200']);
      }
    }
  }
});

test('只拦截已知 tam-ogel 广告目录里的 JPG 和 MP4 素材', () => {
  for (const extension of ['jpg', 'mp4']) {
    for (const suffix of ['', '?v=2']) {
      for (const scheme of ['http', 'https']) {
        assert.deepEqual(actions(`${scheme}://dss0.bdstatic.com:443/abc/tam-ogel/ad.${extension}${suffix}`),
          ['reject']);
      }
    }
  }
});

// 以下是合成的边界用例，用来验证规则范围，不是用户的真实抓包。
for (const qt of ['s', 'sug', 'con', 'nav', 'bt', 'walk2', 'rgc', 'auth', 'weather',
  'ads_extra', 'ads2', 'barrier', 'hweather']) {
  test(`常规查询或相似参数原样放行：qt=${qt}`, () => {
    for (const pathname of ['/client/phpui', '/client/phpui2']) {
      assert.deepEqual(actions(`${apiOrigin}${pathname}/?qt=${qt}&sv=22.2.0`), []);
    }
  });
}

for (const target of [
  '/client/phpui2/?xqt=ads', '/client/phpui2/?q=qt=ads',
  '/client/phpui2/?redirect=https%3A%2F%2Fexample.com%2F%3Fqt%3Dads',
  '/client/phpui2/?qt=s&word=ads', '/client/phpui2/?qt=s#&qt=ads',
  '/client/phpui2/?qt=ads%26qt%3Ds', '/client/phpui2/?qt=ads%20',
  '/client/phpui2/other?qt=ads', '/client/phpui22/?qt=ads',
  '/client/phpui/?qt=ads', '/other/client/phpui2/?qt=ads',
  '/client/usersystem/home/dynamic', '/client/usersystem/mine/page',
  '/client/footprint', '/client/login', '/client/crossmarketing_config',
]) {
  test(`非目标接口或伪广告参数原样放行：${target}`, () => {
    assert.deepEqual(actions(`${apiOrigin}${target}`), []);
  });
}

test('地图、定位、导航、离线地图和账号业务主机不被拦截', () => {
  for (const host of ['map.baidu.com', 'api.map.baidu.com', 'newvector.map.baidu.com',
    'newloc.map.baidu.com', 'offnavi.map.baidu.com', 'dlnav.baidu.com',
    'passport.baidu.com', 'httpdns.baidubce.com', 'ugc.map.baidu.com']) {
    for (const target of ['/client/phpui2/?qt=ads', '/client/crossmarketing', '/']) {
      assert.deepEqual(actions(`https://${host}${target}`), []);
    }
  }
});

test('精确校验主机边界，广告字样出现在其他站点或参数中时不拦截', () => {
  for (const host of ['example.com', 'newclient.map.baidu.com.example.com',
    'newclientXmap.baidu.com', 'newclient.map.baidu.com@other.test']) {
    assert.deepEqual(actions(`https://${host}/client/phpui2/?qt=ads`), []);
  }
  for (const url of [
    'https://dss0.bdstatic.com.example.com/abc/tam-ogel/ad.jpg',
    'https://example.com/?next=https://newclient.map.baidu.com/client/phpui2/?qt=ads',
    'https://example.com/?next=https://dss0.bdstatic.com/abc/tam-ogel/ad.jpg',
    'not a URL',
  ]) assert.deepEqual(actions(url), []);
});

test('同一 CDN 的普通图片、图标和相似目录原样放行', () => {
  for (const target of [
    '/abc/map/tile.jpg', '/abc/icons/navigation.png',
    '/abc/tam-ogel-backup/ad.jpg', '/abc/tam-ogel/ad.jpg.backup',
    '/abc/tam-ogel/config.json', '/abc/tam-ogel/ad.mp4/route',
    '/abc/normal.jpg?next=/tam-ogel/ad.mp4',
    '/abc/normal.jpg#next=/tam-ogel/ad.mp4',
  ]) assert.deepEqual(actions(`https://dss0.bdstatic.com${target}`), []);
});

test('单文件插件只包含内置复写及精确广告域名，无 JS 或本地附加文件依赖', () => {
  const { content, sections, rewrites, hosts, domains, filters } = readPlugin();
  const version = /^#!date=(\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d)$/m.exec(content);
  assert.ok(version, '版本日期必须包含北京时间的时分');
  assert.ok(content.includes(`#!name=百度地图去广告·诊断 ${version[1]}\n`), '插件名称应显示同一版本时间');
  assert.deepEqual(Object.keys(sections).sort(), ['MITM', 'Rewrite', 'Rule']);
  assert.deepEqual(hosts.sort(), ['dss0.bdstatic.com', 'ecom.map.baidu.com', 'newclient.map.baidu.com']);
  assert.equal(sections.MITM.length, 1);
  assert.ok(rewrites.every(rule => rule.pattern.source.startsWith('^')));
  assert.doesNotMatch(content, /^DOMAIN-SUFFIX,|^IP-CIDR,|^\[(?:Script|Resource)\]|script-path=|\.jq_file\(|data-path=|\.js\b/m);
  assert.deepEqual(domains.slice().sort(), adDomains.slice().sort());
  assert.equal(filters.length, 4);
  assert.match(content, /^#!loon_version=3\.5\.1\(978\)$/m);
  assert.ok(!fs.existsSync(path.join(__dirname, 'baidumap-adblock.js')), '废弃的本地脚本已从交付目录移除');
  for (const rule of rewrites) {
    assert.ok(hosts.some(host => rule.pattern.test(
      `https://${host}${host === 'dss0.bdstatic.com' ? '/abc/tam-ogel/ad.jpg' : '/client/phpui2/?qt=ads'}`
    ) || rule.pattern.test(`https://${host}/client/phpui2/?qt=bar`) ||
      rule.pattern.test(`https://${host}/client/phpui/?qt=hw`) ||
      rule.pattern.test(`https://${host}/client/noticebar/get`) ||
      rule.pattern.test(`https://${host}/client/crossmarketing`) ||
      rule.pattern.test(`https://${host}/feed-server/nearby/ads`)),
    '每条 HTTPS 规则都应有对应的 MITM 主机');
  }
});

// 下列结构依据 504_1794889990809.zip 中的字段制作，值已替换为合成样例。
const adDomains = [
  'afd.baidu.com', 'afdconf.baidu.com', 'api.yunxish.com', 'cdn.yunxish.com',
  'cpc-service-square.yunxish.com', 'cpc-service-square.iggrowth.cn',
  'sdkquic.e.qq.com', 'oss.cdn.aiclk.com', 'rcv.aiclk.com',
];
const splashUrl = 'https://ecom.map.baidu.com/ad-ops/afd/entry?sv=22.2.0';
const homeUrl = `${apiOrigin}/feed/govui/rich_content?sv=22.2.0`;
const homepageFeedUrl = `${apiOrigin}/feed/govui/rich_content?from=homepage&sv=22.2.0`;
const mineUrl = `${apiOrigin}/usercenter/mine/page?sv=22.2.0`;

function splashFixture() {
  return { code: 0, message: '', result: {
    policy: { show_limit: { expose_interval: 1, expose_times: 50 },
      screen: { maximum_startup_time: 1700 }, speed_limit: { speed_switch: 1 } },
    ad_info: Array.from({ length: 13 }, (_, i) => ({
      material_id: `fixture-${i}`, template_id: 1006 + i, show_time: 5,
      use_preload_data: 1, animation_data: { baidu_map: [] },
    })), req_id: 'fixture-request',
  }, other: { keep: true } };
}

function homeFixture() {
  return { errno: 0, errmsg: '', data: {
    conf: { ceil: false, newUrl: 'https://example.test/feed' },
    location: { name: '测试地点', loc_x: 0, loc_y: 0 },
    posts: { content: [
      { content_type: 'pulse_card_sector', articleInfo: { keep: true } },
      { content_type: 'feed_dynamic_card_new', components: [] },
      { content_type: 'article', headline: '普通文章', unique_id: 'fixture-article' },
      { content_type: 'feed_fengchao_ad_card', ext: { creative: 'fixture-ad' } },
      { content_type: 'video', headline: '普通视频' },
      { content_type: 'unknown_future_card', is_ad: 1, keep: true }, null,
    ], remain_num: 192, title: 'fixture-title' },
    themes: { content: [{ name: '推荐', selected: true }] },
  } };
}

function runResponse(url, body, status = 200) {
  const filters = readPlugin().filters.filter(rule => rule.status === status && rule.pattern.test(url || ''));
  if (!filters.length) return {};
  let source = typeof body === 'string' ? body : JSON.stringify(body);
  let original;
  try { original = JSON.parse(source); } catch { return {}; }
  for (const filter of filters) {
    const result = spawnSync(process.env.BAIDUMAP_JQ_PATH || 'jq', ['-c', '--', filter.jq], {
      input: source, encoding: 'utf8', timeout: 5000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    });
    assert.ifError(result.error, '验证需要 jq；可通过 BAIDUMAP_JQ_PATH 指定 jq 可执行文件');
    assert.equal(result.status, 0, result.stderr);
    const outputs = result.stdout.trim().split(/\r?\n/);
    assert.equal(outputs.length, 1, '内联 JQ 必须对每份 JSON 恰好输出一份响应');
    source = outputs[0];
  }
  // 比较 JSON 语义；Loon 和 jq 的空白格式差异不作为数据变更。
  return isDeepStrictEqual(original, JSON.parse(source)) ? {} : { body: source };
}

test('新版开屏响应清空 13 条广告配置，保留策略和其他响应字段', () => {
  const data = splashFixture();
  assert.deepEqual(JSON.parse(runResponse(splashUrl, data).body),
    { ...data, result: { ...data.result, ad_info: [] } });
});

test('非首页来源只移除广告卡，保留文章、视频、位置和未知卡片', () => {
  const data = homeFixture();
  const expected = structuredClone(data);
  expected.data.posts.content.splice(3, 1);
  assert.deepEqual(JSON.parse(runResponse(homeUrl, data).body), expected);
});

test('非首页来源多个广告卡均被清理，未知类型及空条目保留', () => {
  const data = homeFixture();
  data.data.posts.content.push({ content_type: 'feed_fengchao_ad_card', ext: 'other' });
  const output = JSON.parse(runResponse(homeUrl, data).body);
  assert.equal(output.data.posts.content.length, data.data.posts.content.length - 2);
  assert.ok(output.data.posts.content.some(item => item?.content_type === 'unknown_future_card'));
  assert.ok(output.data.posts.content.includes(null));
});

test('内置 JSON 复写兼容 HTTP、HTTPS、显式端口、查询参数和末尾斜杠', () => {
  for (const scheme of ['http', 'https']) {
    for (const port of ['', ':443', ':18080']) {
      for (const suffix of ['', '/', '?sv=22.2.0', '/?sv=22.2.0']) {
        const output = runResponse(`${scheme}://ecom.map.baidu.com${port}/ad-ops/afd/entry${suffix}`, splashFixture());
        assert.deepEqual(JSON.parse(output.body).result.ad_info, []);
        const home = runResponse(`${scheme}://newclient.map.baidu.com${port}/feed/govui/rich_content${suffix}`, homeFixture());
        assert.equal(JSON.parse(home.body).data.posts.content.length, 6);
      }
    }
  }
});

test('异步开屏素材响应有广告列表时清理，抓包中的空素材结构原样放行', () => {
  const url = 'https://ecom.map.baidu.com/ad-ops/afd/material_async';
  assert.deepEqual(JSON.parse(runResponse(url, splashFixture()).body).result.ad_info, []);
  assert.deepEqual(runResponse(url, { code: 0, message: '', result: { req_id: 'fixture' } }), {});
});

test('非目标主机、相似路径和其他地图业务原样放行', () => {
  for (const url of [
    `${apiOrigin}/client/phpui2/?qt=rgc`, `${apiOrigin}/client/phpui2/?qt=multinavi`,
    `${apiOrigin}/client/imap/dl/s/UpdateInfo.php`, `${apiOrigin}/feed-server/feed/nearby_flow`,
    `${apiOrigin}/feed-server/nearby/poi_rec`, `${apiOrigin}/living/nearby/api`,
    `${apiOrigin}/usercenter/mine/pageOther`, `${apiOrigin}/feed/govui/rich_contentOther`,
    `${apiOrigin}/feed/govui/rich_content/other`,
    'https://ecom.map.baidu.com/ad-ops/afd/entryOther',
    'https://ecom.map.baidu.com/ad-ops/afd/entry/other',
    'https://ecom.map.baidu.com/order/create',
    'https://ecom.map.baidu.com.example.test/ad-ops/afd/entry',
    'https://newclient.map.baidu.com.example.test/feed/govui/rich_content',
    'https://ecom.map.baidu.com@other.test/ad-ops/afd/entry',
    `${apiOrigin}/ad-ops/afd/entry`,
    'https://ecom.map.baidu.com/feed/govui/rich_content', 'not a URL',
  ]) {
    assert.deepEqual(runResponse(url, splashFixture()), {}, url);
    assert.deepEqual(runResponse(url, homeFixture()), {}, url);
    assert.deepEqual(actions(url), [], url);
    assert.ok(!readPlugin().filters.some(filter => filter.pattern.test(url)), url);
  }
});

test('失败响应、非 JSON、空正文和未知结构原样放行', () => {
  for (const status of [0, 204, 206, 302, 401, 500, 'invalid', '200', null]) {
    assert.deepEqual(runResponse(splashUrl, splashFixture(), status), {});
    assert.deepEqual(runResponse(homeUrl, homeFixture(), status), {});
  }
  for (const body of ['', 'null', '[]', '42', 'true', '<html>error</html>', '{broken',
    { code: 1, result: splashFixture().result }, { code: '0', result: splashFixture().result },
    { code: 0, result: { ad_info: null } }, { code: 0, result: { ad_info: {} } },
    { errno: 1, data: homeFixture().data }, { errno: '0', data: homeFixture().data },
    { errno: 0, data: { posts: { content: {} } } }, { data: homeFixture().data },
  ]) {
    assert.deepEqual(runResponse(splashUrl, body), {});
    assert.deepEqual(runResponse(homeUrl, body), {});
  }
});

test('缺少 URL、状态码或响应正文时不执行 JSON 修改', () => {
  assert.deepEqual(runResponse(undefined, splashFixture()), {});
  assert.deepEqual(runResponse(splashUrl, splashFixture(), null), {});
  assert.deepEqual(runResponse(splashUrl, undefined), {});
});

test('无广告及重复执行保持 JSON 内容不变', () => {
  const splash = splashFixture();
  splash.result.ad_info = [];
  assert.deepEqual(runResponse(splashUrl, JSON.stringify(splash, null, 2)), {});
  const changedHome = runResponse(homeUrl, homeFixture());
  assert.deepEqual(runResponse(homeUrl, changedHome.body), {});
  const changedSplash = runResponse(splashUrl, splashFixture());
  assert.deepEqual(runResponse(splashUrl, changedSplash.body), {});
});

test('内置 JSON 复写匹配已确认接口，且与请求拒绝规则不重叠', () => {
  for (const url of [splashUrl, homeUrl, homepageFeedUrl, mineUrl, 'https://ecom.map.baidu.com/ad-ops/afd/material_async']) {
    assert.deepEqual(actions(url), [], '响应修改需要收到原始正文');
    assert.equal(readPlugin().filters.filter(filter => filter.pattern.test(url)).length, 1, url);
    assert.ok(readPlugin().hosts.includes(new URL(url).hostname), url);
  }
});

test('首页独立广告接口命中，周边 POI 和正文信息流保留', () => {
  for (const suffix of ['', '/', '?qt=feed', '/?qt=feed']) {
    assert.deepEqual(actions(`${apiOrigin}/feed-server/nearby/ads${suffix}`), ['reject-200']);
  }
  for (const pathname of ['/feed-server/nearby/ads_report', '/feed-server/nearby/ads/other',
    '/feed-server/nearby/poi_rec', '/feed-server/feed/nearby_flow']) {
    assert.deepEqual(actions(apiOrigin + pathname), []);
  }
});

test('只拒绝确定的广告 SDK 主机，同公司的普通业务域名和伪造主机放行', () => {
  const { domains } = readPlugin();
  for (const domain of adDomains) assert.ok(domains.includes(domain), domain);
  for (const domain of ['baidu.com', 'qq.com', 'aiclk.com', 'yunxish.com', 'bcebos.com',
    'ecom.map.baidu.com', 'appnavi.baidu.com', 'cnloc.map.baidu.com',
    'yongche.baidu.com', 'wappass.baidu.com', 'afdconf.baidu.com.example.test']) {
    assert.ok(!domains.includes(domain), domain);
  }
});

test('非首页来源数组中的非对象条目和未知结构保持不变', () => {
  const data = homeFixture();
  data.data.posts.content.push(42, false, 'fixture-text', ['fixture-array']);
  const output = JSON.parse(runResponse(homeUrl, data).body);
  const expected = structuredClone(data);
  expected.data.posts.content.splice(3, 1);
  assert.deepEqual(output, expected);
});

function mineFixture() {
  // 抓包的业务成功码为 2000，以下账号、车辆、余额和 URL 均为合成值。
  return { error: 2000, msg: 'ok', data: {
    avatar: { name: 'fixture-user', keep: true },
    card_list: ['car', 'ugc', 'voice', 'gold', 'future-card'],
    gold: { activity: [{ title: '领打车金' }], head: { num: 0, type: 'coin' } },
    gold_coin_card: { money: 0, coin: 0, card_data: [
      { title: '每日签到' }, { title: '领餐补' }, { title: '白拿现金' },
    ] },
    finance: { title: '借钱', loanStatus: 1,
      insuranceInfo: { title: '出行保', amount: 'fixture-amount' },
      loanInfo: { title: '借钱' }, loan: { title: '借钱' } },
    shop: {},
    corner_marks: { dxm: { position: 'dxm', text: '额度高' },
      shop: { position: 'shop', text: '推广' }, voice: { text: '保留' }, future: { keep: true } },
    car: { name: 'fixture-car', keep: true },
    voice_card: { banner: ['fixture'], rcmdtopics: { keep: true } },
    footPrint: { keep: true }, street_view_card: { keep: true },
    order_info: { processing_cnt: 0, notice: [] },
    skin: { theme: 'fixture-theme' }, sport_card: { keep: true },
    future_module: { title: '借钱只是普通文本，不按关键词删除其他模块' },
  }, extra: { keep: true } };
}

function expectedMine(data) {
  const expected = structuredClone(data);
  delete expected.data.gold;
  delete expected.data.gold_coin_card;
  delete expected.data.finance;
  delete expected.data.shop;
  expected.data.sport_card = {};
  expected.data.card_list = expected.data.card_list.filter(item => item !== 'gold');
  delete expected.data.corner_marks.dxm;
  delete expected.data.corner_marks.shop;
  return expected;
}

test('我的页清除天天领钱、出行保、借钱及店铺字段，保留正常功能', () => {
  const data = mineFixture();
  assert.deepEqual(JSON.parse(runResponse(mineUrl, data).body), expectedMine(data));
});

test('清理度小满及我的店铺营销角标，保留其他角标和未知字段', () => {
  const data = mineFixture();
  const actual = JSON.parse(runResponse(mineUrl, data).body);
  assert.deepEqual(actual.data.corner_marks, { voice: { text: '保留' }, future: { keep: true } });
  assert.deepEqual(actual.data.future_module, data.data.future_module);
  assert.deepEqual(actual.data.car, data.data.car);
  assert.deepEqual(actual.data.voice_card, data.data.voice_card);
});

test('金币布局项全部删除，保留其他卡片原有顺序', () => {
  const data = mineFixture();
  data.data.card_list = ['gold', 'car', 'gold', 'ugc', 'voice', 'gold', 'future-card'];
  const actual = JSON.parse(runResponse(mineUrl, data).body);
  assert.deepEqual(actual.data.card_list, ['car', 'ugc', 'voice', 'future-card']);
});

test('我的页清理兼容 HTTP、HTTPS、显式端口、末尾斜杠和参数', () => {
  for (const scheme of ['http', 'https']) for (const port of ['', ':443', ':18080']) {
    for (const suffix of ['', '/', '?sv=22.2.0', '/?sv=22.2.0']) {
      const url = `${scheme}://newclient.map.baidu.com${port}/usercenter/mine/page${suffix}`;
      assert.deepEqual(JSON.parse(runResponse(url, mineFixture()).body), expectedMine(mineFixture()));
    }
  }
});

test('我的页失败状态、未知业务码、异常结构和非 JSON 不改动', () => {
  for (const status of [0, 204, 206, 302, 401, 500, null]) {
    assert.deepEqual(runResponse(mineUrl, mineFixture(), status), {});
  }
  for (const error of [0, 1, 2001, '2000', null, undefined]) {
    const data = mineFixture();
    data.error = error;
    assert.deepEqual(runResponse(mineUrl, data), {});
  }
  for (const body of ['', 'null', '[]', '42', 'true', '<html>error</html>', '{broken',
    { error: 2000 }, { error: 2000, data: null }, { error: 2000, data: [] },
    { error: 2000, data: 'unknown' }]) assert.deepEqual(runResponse(mineUrl, body), {});
});

test('我的页未知布局和角标类型保留，不新建缺失字段', () => {
  for (const value of [null, {}, 'unknown', 42]) {
    const data = { error: 2000, data: { finance: { title: '借钱' },
      card_list: value, corner_marks: value, car: { keep: true } } };
    assert.deepEqual(JSON.parse(runResponse(mineUrl, data).body),
      { ...data, data: { card_list: value, corner_marks: value, car: { keep: true } } });
  }
  assert.deepEqual(runResponse(mineUrl, { error: 2000, data: { car: { keep: true } } }), {});
});

test('我的页相似路径、其他业务路径和伪造主机不处理', () => {
  for (const url of [
    `${apiOrigin}/usercenter/mine/pageOther`, `${apiOrigin}/usercenter/mine/page/other`,
    `${apiOrigin}/other/usercenter/mine/page`, `${apiOrigin}/usercenter/mine/order`,
    `${apiOrigin}/client/usersystem/mine/page`,
    'https://ecom.map.baidu.com/usercenter/mine/page',
    'https://newclient.map.baidu.com.example.test/usercenter/mine/page',
    'https://example.test/?next=https://newclient.map.baidu.com/usercenter/mine/page',
  ]) {
    assert.deepEqual(runResponse(url, mineFixture()), {});
    assert.ok(!readPlugin().filters.some(filter => filter.pattern.test(url)), url);
  }
});

test('我的页清理重复执行保持 JSON 数据不变', () => {
  const cleaned = runResponse(mineUrl, mineFixture());
  assert.ok(cleaned.body);
  assert.deepEqual(runResponse(mineUrl, cleaned.body), {});
});

function homepageFixture() {
  const data = homeFixture();
  data.data.themes = { content: [
    { name: '推荐', selected: true, md5: 'fixture-default', query: { rqt: '', topic: 'default' } },
    { name: '看世界' }, { name: '附近' },
  ], themeShow: true, iconExist: true, labelStyle: true, future: { keep: true } };
  return data;
}

function expectedHomepage(data) {
  return { ...data, data: { ...data.data,
    posts: { ...data.data.posts, content: [blankHomepageCard()], remain_num: 0, title: '' },
    themes: { ...data.data.themes, content: [blankHomepageTheme(data.data.themes.content[0])],
      themeShow: false, iconExist: false, labelStyle: false },
  } };
}

function blankHomepageCard() {
  // 诊断版用可见文字探针检查响应渲染，保留紧凑的卡片内边距。
  return { content_type: 'feed_dynamic_card_new', content_type_modify: 'fullline', cover: '\u200b',
    dynamicBoxStyle: { 'background-color': 'null', 'padding-bottom': '6', 'padding-top': '46' },
    components: [{ componentType: 'img-text', data: {
      text: '百度地图', textLineClamp: 1, colorDark: '#d3d9e6',
      iconUrl: '',
      darkIconUrl: '',
      iconStyle: { height: '0', width: '0', 'margin-left': '0', 'margin-right': '0',
        opacity: 0.18, filter: 'grayscale(1)' },
      imgTextStyle: { flex: 1, 'justify-content': 'center', 'align-items': 'center' },
      textStyle: { color: '#9aa3b2', 'font-family': 'PingFang SC',
        'font-size': 15, 'font-weight': 400, 'letter-spacing': '0%', 'margin-bottom': 0, 'text-align': 'center' },
    } }],
  };
}

function blankHomepageTheme(original = {}) {
  return { ...original, name: '\u200b', icon: '', nameIcon: '', nameIconDark: '', labels: [],
    selected: true, query: original.query && typeof original.query === 'object' && !Array.isArray(original.query)
      ? original.query : { rqt: '', topic: 'default' } };
}

test('首页推荐替换为文字探针卡和默认分类，避免两个列表都为空', () => {
  const data = homepageFixture();
  assert.deepEqual(JSON.parse(runResponse(homepageFeedUrl, data).body), expectedHomepage(data));
});

test('首页探针配置为居中文字，内边距收紧且无图片请求或推广跳转', () => {
  const actual = JSON.parse(runResponse(homepageFeedUrl, homepageFixture()).body);
  assert.equal(actual.data.posts.content.length, 1);
  const card = actual.data.posts.content[0];
  assert.equal(card.content_type, 'feed_dynamic_card_new');
  assert.equal(card.content_type_modify, 'fullline');
  assert.equal(card.components.length, 1);
  assert.equal(card.components[0].componentType, 'img-text');
  assert.equal(card.components[0].data.text, '百度地图');
  const component = card.components[0].data;
  assert.equal(component.iconUrl, '');
  assert.equal(component.darkIconUrl, component.iconUrl);
  assert.equal(component.imgTextStyle['justify-content'], 'center');
  assert.equal(component.imgTextStyle['align-items'], 'center');
  assert.equal(component.iconStyle.opacity, 0.18);
  assert.equal(component.iconStyle.width, '0');
  assert.equal(component.iconStyle.height, '0');
  assert.equal(component.textStyle['text-align'], 'center');
  assert.equal(card.dynamicBoxStyle['padding-top'], '46');
  assert.equal(card.dynamicBoxStyle['padding-bottom'], '6');
  assert.doesNotMatch(JSON.stringify(card), /baidumap:|detailUrl|jumpUrl|headline|author/);
});

test('空白默认分类保留原查询和标识，隐藏标签内容', () => {
  const data = homepageFixture();
  const actual = JSON.parse(runResponse(homepageFeedUrl, data).body);
  assert.equal(actual.data.themes.content.length, 1);
  const theme = actual.data.themes.content[0];
  assert.deepEqual(theme.query, data.data.themes.content[0].query);
  assert.equal(theme.md5, data.data.themes.content[0].md5);
  assert.equal(theme.selected, true);
  assert.equal(theme.name.replace(/\u200b/g, '').trim(), '');
  assert.deepEqual(theme.labels, []);
});

test('服务器原本返回空列表时也提供文字探针，重复处理仍稳定', () => {
  const data = homepageFixture();
  data.data.posts.content = [];
  data.data.themes.content = [];
  const changed = runResponse(homepageFeedUrl, data);
  const actual = JSON.parse(changed.body);
  assert.deepEqual(actual.data.posts.content, [blankHomepageCard()]);
  assert.deepEqual(actual.data.themes.content, [blankHomepageTheme()]);
  assert.deepEqual(runResponse(homepageFeedUrl, changed.body), {});
});

test('空白分类优先保留原选中项，异常查询结构补齐默认值', () => {
  const data = homepageFixture();
  data.data.themes.content = [null,
    { name: 'other', selected: false, query: { topic: 'other' } },
    { name: 'selected', selected: true, md5: 'selected-fixture', query: { rqt: '', topic: 'selected' } }];
  const selected = JSON.parse(runResponse(homepageFeedUrl, data).body).data.themes.content[0];
  assert.deepEqual(selected, blankHomepageTheme(data.data.themes.content[2]));
  data.data.themes.content[2].query = 'unknown';
  const repaired = JSON.parse(runResponse(homepageFeedUrl, data).body).data.themes.content[0];
  assert.deepEqual(repaired.query, { rqt: '', topic: 'default' });
});

test('首页推荐条数归零，并保留定位及其他未知配置', () => {
  const data = homepageFixture();
  const actual = JSON.parse(runResponse(homepageFeedUrl, data).body);
  assert.equal(actual.data.posts.remain_num, 0);
  assert.equal(actual.data.posts.title, '');
  assert.deepEqual(actual.data.location, data.data.location);
  assert.deepEqual(actual.data.conf, data.data.conf);
  assert.deepEqual(actual.data.themes.future, data.data.themes.future);
});

test('首页推荐标记兼容参数顺序、协议、端口和末尾斜杠', () => {
  for (const scheme of ['http', 'https']) for (const port of ['', ':443', ':18080']) {
    for (const slash of ['', '/']) for (const query of [
      'from=homepage', 'from=homepage&sv=22.2.0', 'sv=22.2.0&from=homepage',
      'sv=22.2.0&from=homepage&pn=0',
    ]) {
      const url = `${scheme}://newclient.map.baidu.com${port}/feed/govui/rich_content${slash}?${query}`;
      assert.deepEqual(JSON.parse(runResponse(url, homepageFixture()).body), expectedHomepage(homepageFixture()));
      assert.equal(readPlugin().filters.filter(filter => filter.pattern.test(url)).length, 1);
    }
  }
});

test('周边来源、无来源及相似参数保持原有广告卡过滤，正文和标签保留', () => {
  for (const query of ['from=nearby', 'from=nearby_flow', 'sv=22.2.0',
    'xfrom=homepage', 'from=homepage_extra', 'from=homepage%20',
    'next=from=homepage', 'next=https%3A%2F%2Fexample.test%3Ffrom%3Dhomepage']) {
    const url = `${apiOrigin}/feed/govui/rich_content?${query}`;
    const data = homepageFixture();
    const expected = structuredClone(data);
    expected.data.posts.content.splice(3, 1);
    assert.deepEqual(JSON.parse(runResponse(url, data).body), expected, query);
    assert.equal(readPlugin().filters.filter(filter => filter.pattern.test(url)).length, 1);
  }
});

test('首页推荐异常状态、失败业务及未知响应结构保持不变', () => {
  for (const status of [0, 204, 206, 302, 401, 500, null]) {
    assert.deepEqual(runResponse(homepageFeedUrl, homepageFixture(), status), {});
  }
  for (const body of ['', 'null', '[]', '42', '<html>error</html>', '{broken',
    { errno: 1, data: homepageFixture().data }, { errno: '0', data: homepageFixture().data },
    { data: homepageFixture().data }, { errno: 0, data: [] }, { errno: 0, data: null },
    { errno: 0, data: { posts: { content: {} }, themes: { content: 'unknown' } } },
  ]) assert.deepEqual(runResponse(homepageFeedUrl, body), {});
});

test('首页推荐字段分别检查类型，不创建缺失字段或改写未知类型', () => {
  const data = { errno: 0, data: { posts: { content: ['fixture'], remain_num: 'unknown', title: 42 },
    themes: { content: ['fixture'], themeShow: 'unknown', iconExist: 1, labelStyle: null }, keep: true } };
  assert.deepEqual(JSON.parse(runResponse(homepageFeedUrl, data).body), { errno: 0, data: {
    posts: { content: [blankHomepageCard()], remain_num: 'unknown', title: 42 },
    themes: { content: [blankHomepageTheme()], themeShow: 'unknown', iconExist: 1, labelStyle: null }, keep: true,
  } });
  assert.deepEqual(JSON.parse(runResponse(homepageFeedUrl,
    { errno: 0, data: { posts: { content: [1] } } }).body),
  { errno: 0, data: { posts: { content: [blankHomepageCard()] } } });
  assert.deepEqual(JSON.parse(runResponse(homepageFeedUrl,
    { errno: 0, data: { themes: { content: [1], themeShow: true } } }).body),
  { errno: 0, data: { themes: { content: [blankHomepageTheme()], themeShow: false } } });
});

test('首页推荐重复处理幂等，相似路径及伪造主机不匹配', () => {
  const cleaned = runResponse(homepageFeedUrl, homepageFixture());
  assert.ok(cleaned.body);
  assert.deepEqual(runResponse(homepageFeedUrl, cleaned.body), {});
  for (const url of [
    `${apiOrigin}/feed/govui/rich_contentOther?from=homepage`,
    `${apiOrigin}/feed/govui/rich_content/other?from=homepage`,
    'https://newclient.map.baidu.com.example.test/feed/govui/rich_content?from=homepage',
    'https://ecom.map.baidu.com/feed/govui/rich_content?from=homepage',
  ]) {
    assert.deepEqual(runResponse(url, homepageFixture()), {});
    assert.ok(!readPlugin().filters.some(filter => filter.pattern.test(url)), url);
  }
});

test('我的页百度运动数据显式置空，足迹、街景和其他功能保留', () => {
  const data = mineFixture();
  data.data.sport_card = { title: '百度运动', content: 'fixture', button: '开始运动' };
  const actual = JSON.parse(runResponse(mineUrl, data).body);
  assert.ok(Object.hasOwn(actual.data, 'sport_card'));
  assert.deepEqual(actual.data.sport_card, {});
  assert.deepEqual(actual.data.footPrint, data.data.footPrint);
  assert.deepEqual(actual.data.street_view_card, data.data.street_view_card);
  assert.deepEqual(actual.data.order_info, data.data.order_info);
  assert.deepEqual(actual.data.avatar, data.data.avatar);
});

test('按字段合并缓存时，显式空运动数据可覆盖旧模块内容', () => {
  const data = { error: 2000, msg: 'ok', data: { sport_card: {
    title: '百度运动', subtitle: 'fixture-text', users_count: 123,
    total: { count: 0, calorie: 0, distance: 0, duration: 0 },
  }, car: { keep: true } } };
  const output = JSON.parse(runResponse(mineUrl, data).body);
  // 这是缓存合并模型的回归用例，不等同于已确认百度地图的内部缓存实现。
  const merged = { ...structuredClone(data.data), ...output.data };
  assert.deepEqual(merged.sport_card, {});
  assert.deepEqual(merged.car, data.data.car);
  assert.deepEqual(runResponse(mineUrl, output), {});
});

test('运动字段缺失、为 null 或未知类型时保留，不创建新模块', () => {
  for (const value of [null, [], 'unknown', 42, false]) {
    assert.deepEqual(runResponse(mineUrl, { error: 2000, data: { sport_card: value, car: { keep: true } } }), {});
  }
  assert.deepEqual(runResponse(mineUrl, { error: 2000, data: { car: { keep: true } } }), {});
});

module.exports = { readPlugin, runResponse };

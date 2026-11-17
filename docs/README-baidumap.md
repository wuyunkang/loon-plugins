# 百度地图去广告 · Loon 插件

2026-11-17 紧凑 Logo 与运动显式清空修正版，针对 iOS 百度地图 **22.2.0**。依据用户提供的 `504_1794889990809.zip` 修正，处理开屏、首页底部地点推荐及指定的“我的”页推广和百度运动。

**只需导入一个插件文件。** 源文件位于 `Plugin/BaiduMap_remove_ads.lpx`。清理使用内置 JQ，Logo 自动读取百度官方图片，无需额外导入脚本或图片。需要 **Loon 3.5.1（978）或更新版本**。已通过抓包回放，最新运动清空和 Logo 显示效果尚未手机实测。

## 安装或更新

1. 在 Loon 中先停用旧版，再导入仓库中的百度地图插件，确保只启用一份，然后重载配置。
2. 开启 Loon 的**复写、MitM（HTTPS 解密）**，安装并在 iOS 中完全信任 Loon 证书。
3. 确认解密主机包括 `newclient.map.baidu.com`、`ecom.map.baidu.com`、`dss0.bdstatic.com`。
4. 完全退出百度地图后重新打开。若旧广告仍在，尝试百度地图自身的缓存清理选项，再退出重开；网络插件无法直接删除应用此前缓存的广告文件。

可通过仓库首页提供的原始文件 URL 添加。

手动合并到主配置时，将文件中的 `[Rule]`、`[Rewrite]` 内容分别加入对应段，MITM 主机追加到原有列表；已有段名不重复添加。

JSON 清理采用 Loon 3.5.1（978）起支持的原生 `response.json.jq`，筛选表达式直接写在插件内。响应规则同时限定精确 URL 和 HTTP 200；旧版请求拒绝规则沿用兼容语法。参见 [Loon 原生复写文档](https://nsloon.app/docs/Rewrite/rewrite_v2/)及[JSON Action 说明](https://nsloon.app/docs/Rewrite/rewrite_v2/#json)。

## 本次修正

抓包显示，旧版覆盖的 `qt=ads`、`qt=bar` 和 `crossmarketing` 请求之外，还有独立的开屏广告接口，以及混在正常首页信息流里的广告卡。旧版缺少这些接口的处理与 `ecom.map.baidu.com` 的解密配置。

| 接口或内容 | 本版处理 |
| --- | --- |
| `ecom.map.baidu.com/ad-ops/afd/entry` | 成功 JSON 响应中的 `result.ad_info` 清空；每份抓包响应包含 13 条广告、聚合 SDK 或预加载配置 |
| 同主机 `/ad-ops/afd/material_async` | 返回同结构广告列表时清理；抓包中只有请求标识的响应保持原样 |
| `newclient.map.baidu.com/feed/govui/rich_content`，`from=homepage` | 用紧凑官方 Logo 卡片替换地点推荐，保留一个空白默认分类和正常成功状态 |
| 同一接口的其他来源 | 只移除 `content_type=feed_fengchao_ad_card` 的广告卡，保留文章、视频、位置及其他卡片 |
| 同主机 `/feed-server/nearby/ads` | 拦截首页周边独立广告接口 |
| 同主机 `/usercenter/mine/page` | 清理天天领钱、金融、店铺、百度运动字段，删除金币布局项和度小满、店铺营销角标 |
| 抓包中出现的广告 SDK 主机 | 精确拦截百度 AFD 配置、趣盟广告请求及素材、腾讯广告 SDK、部分广告素材和曝光接口 |

广告 SDK 规则使用精确主机：`afd.baidu.com`、`afdconf.baidu.com`、`api.yunxish.com`、`cdn.yunxish.com`、`cpc-service-square.yunxish.com`、`cpc-service-square.iggrowth.cn`、`sdkquic.e.qq.com`、`oss.cdn.aiclk.com`、`rcv.aiclk.com`。`afd.baidu.com` 是公开规则中的补充主机，其余 8 个主机均出现在本次抓包中。这些广告服务可能被其他 App 共用，启用规则也会拦截其他 App 到相同主机的请求。

原有开屏 `qt=ads`、首页横幅 `qt=bar`、搜索推广 `qt=hw`、`noticebar/get`、`crossmarketing` 及 `tam-ogel` 下 JPG、MP4 广告素材规则保留。接口兼容 HTTP/HTTPS、显式端口、末尾斜杠及不同参数顺序。

## 首页底部地点推荐

按用户要求精简截图中首页下方的“推荐 / 看世界 / 附近”等标签及笔记、地点和视频内容。抓包确认该请求具有 `from=homepage` 参数。此前清空列表后出现“加载失败”，改为非空占位后，用户截图已显示为空白区域。本次进一步收紧卡片自身的内边距，加入按“我的”页底部样式淡化居中的百度地图字标：

- `data.posts.content` 保留一张 `feed_dynamic_card_new` 卡片，使用已有的 `img-text` 组件。图片采用[百度地图官方字标](https://api.map.baidu.com/images/copyright_logo_hd.png)，原图 136×50，显示尺寸 68×25；配置居中、灰度和 0.18 透明度样式，没有推广跳转。
- 卡片内边距从上 18、下 14 改为上下各 6。该配置控制卡片自身，整个底部面板的最小高度仍由 App 布局决定。
- `data.themes.content` 保留一个空白默认分类，优先沿用原选中项的查询参数及标识，隐藏名称、图片和标签；原列表为空时提供默认分类。
- 已有且为数字的 `data.posts.remain_num` 置零，已有的推荐标题清空。
- 已确认为布尔值的 `themeShow`、`iconExist`、`labelStyle` 置为 `false`。

此项包含正常的推荐笔记和视频。定位、其他响应配置以及上方功能入口的接口继续保留。周边来源和未指定来源的推荐响应沿用广告卡过滤；`feed-server/feed/nearby_flow` 未被整体拦截。

已验证成功状态、占位结构、Logo 地址返回有效 PNG，以及原始抓包回放。最新版的 Logo 样式和整体面板高度尚未手机确认；部分样式是否生效取决于原生渲染器的支持。真实 HTTP 错误及业务错误继续保留。

## 我的页清理

用户指定清理“天天领钱”“出行保”“借钱”“百度运动”，以及顶部“度小满”“我的店铺”入口。规则只处理 `newclient.map.baidu.com/usercenter/mine/page` 的 HTTP 200 响应；抓包确认该接口的业务成功码为 **`error=2000`**。

| 字段 | 处理 |
| --- | --- |
| `data.gold`、`data.gold_coin_card` | 删除金币活动和天天领钱配置 |
| `data.card_list` 中的 `gold` | 删除布局引用，保留其他卡片顺序 |
| `data.finance` | 删除借钱、出行保及关联金融下发数据 |
| `data.shop` | 删除我的店铺下发数据 |
| `data.sport_card` | 已有运动对象显式置为 `{}`，保留字段以覆盖旧值；缺失、null 和未知类型保持原样 |
| `data.corner_marks.dxm`、`data.corner_marks.shop` | 删除度小满、我的店铺营销角标 |

用户实测反馈：上版删除 `sport_card` 字段后，百度运动仍然显示。本版改为显式返回空对象，尝试覆盖客户端的旧运动数据。测试证明该输出可以覆盖按字段合并的缓存模型，但这只是兼容性模型，**尚未证实百度地图内部缓存实现，也尚未确认运动模块在手机上隐藏**。

车辆、语音、足迹、街景、订单、皮肤及未知模块数据保留。“我的店铺”按钮在后续截图中仍然显示，确认删除店铺字段和角标没有隐藏这个固定入口；现有抓包未返回完整的顶部菜单配置，**本版仍不能保证隐藏度小满、我的店铺的原生按钮本身**。

## 保留范围

不整域拦截地图、定位、导航、离线地图、登录或通用 HTTPDNS。首页底部推荐按要求替换为 Logo 占位，其他来源的信息流保留正常文章、视频和未知类型卡片。定位数据、非目标配置和功能组件更新包保留。

当前尚未找到底部 AI“长按说话”入口的显示开关。抓包中的 AI、语音配置涉及导航播报触发和语音资源，不能据此确认如何隐藏底栏入口；本版没有加入该入口的移除规则。

本次没有处理酒店、打车及“我的”页其他未指定内容，也不隐藏所有原生推广入口或解锁付费功能。内联过滤只修改已确认结构中的目标字段；HTTP 非 200、非 JSON、未知业务码、未知响应结构和非目标接口的数据保持不变。Loon 对命中的 JSON 响应进行重新编码时，空格和缩进可能变化。不记录账号、设备、坐标或请求内容；响应过滤本身不发起网络请求，首页 Logo 由 App 从百度官方地址自动加载。

## 验证结果

按 TDD 流程先增加失败用例，再把脚本替换为内联 JQ。手机直接使用 Loon 内置能力；以下是电脑上的开发验证步骤，需要 Node.js 和 [jq](https://github.com/jqlang/jq/releases)：

```powershell
# jq 已加入 PATH 时直接运行
node --test tests/validate-baidumap.test.cjs
# 也可先指定电脑上的 jq 可执行文件路径
# $env:BAIDUMAP_JQ_PATH = 'C:\Tools\jq.exe'
```

**75 项测试全部通过**，使用 jq 1.8.2 执行插件内真实的过滤表达式，覆盖单文件交付、新版开屏配置、紧凑 Logo 卡片、有效默认分类、首页来源参数边界、其他来源广告卡过滤、运动字段显式清空与缓存合并模型、店铺配置与营销角标、失败响应、未知结构、重复执行和正常业务放行。过滤器使用 `if`、`type`、`map`、`select`、`del` 等标准语法。

对本次抓包的 1105 条请求逐条回放，其中 1028 条具有响应头：

| 检查 | 结果 |
| --- | --- |
| 广告域名规则 | 命中 16 条请求 |
| 请求复写规则 | 命中 56 条请求，其中 3 条为新增周边广告接口 |
| 原生 JSON 响应规则 | 命中 12 条响应，实际修改 9 份，3 份无广告列表的异步素材响应数据保持不变 |
| 新版开屏清理 | 3 份响应共移除 39 条广告配置 |
| 首页底部推荐 | 3 份首页响应中的 27 个原内容条目和 39 个原标签被替换，每份响应保留 1 张紧凑 Logo 卡片和 1 个空白默认分类 |
| 我的页清理 | 3 份响应共删除 12 个目标模块字段、6 个营销角标和 3 个金币布局引用，另将 3 个运动对象显式清空 |
| 其他请求 | 1021 条无规则命中 |

回放同时检查：修改后的 JSON 除指定目标字段和广告列表外与原响应一致，重复处理不再改变数据，每个过滤器恰好输出一份 JSON，域名、请求拒绝和响应修改规则没有重复处理同一抓包请求。我的页原有车辆、语音、订单等字段逐项保持一致。

上述数字是本地回放结果，不能等同于手机上已看不到所有广告。抓包中 77 条请求没有响应头，无法验证这些请求在应用中的实际响应行为。原始抓包、账号、定位和设备数据没有加入安装包；测试中的响应样例使用合成值。

## 排查

- 新开屏仍显示时，先检查 Loon 版本符合要求、插件和复写已开启，以及 `ecom.map.baidu.com` 已加入 MitM。规则命中 `entry` 后，响应中的 `result.ad_info` 应为 `[]`。
- 首页底部应显示 Logo 占位。检查 `from=homepage` 响应中的 `posts.content` 是否为一张含官方字标地址的 `feed_dynamic_card_new` 卡片，`themes.content` 是否保留一个无可见名称的默认分类；两个数组应各有一项。整体面板仍可能保留原生最小高度。
- 更新后完全退出百度地图再重新进入“我的”页。百度运动应下发为 `"sport_card":{}`。若运动仍显示，需要核对这次实际收到的响应及其他数据来源；当前仅能确认空对象输出。天天领钱和金融字段仍按原规则删除。“我的店铺”按钮属于尚未解决的固定菜单入口。
- 如果启用插件后出现网络异常，先关闭本插件恢复使用，再检查 Loon 的配置加载和 HTTPS 解密错误。本插件不能解除应用的证书校验。

## 公开参考

本次修正以用户抓包为主要依据。旧接口与广告平台分类另外参考以下公开维护记录，查阅于 2026-11-17：

- [fmz200 百度地图插件](https://github.com/fmz200/wool_scripts/blob/387707db00a8e7e1346fe333cfe870e1784c7d95/Loon/plugin/split/partB/BaiduMaps.lpx)：AFD 主机、旧开屏接口及素材路径。
- [Moli-X 百度地图配置](https://github.com/Moli-X/Resources/blob/63a1376e68cb86adb434a8136df6bfd2df59aae6/Rewrite/BaiduMap.conf)：搜索推广与商业推广接口。
- [RuCu6 百度地图处理脚本存档](https://github.com/jqyisbest/RuCu6/blob/a9fbeac4ac28af42a52f6fcc0a77ffe298aa8921/Scripts/baidu/map.js)：通知横条结构。
- [DD-AD 广告规则](https://github.com/afwfv/DD-AD/blob/fc31a0d02c05ed8873dd535a29fcf9355801a69f/rule/DD-AD.txt)：趣盟与 aiclk 广告域名分类。
- [腾讯广告 SDK 接口拦截示例](https://github.com/ZenmoFeiShi/Qx/blob/5df3cafc468419e7b58b0f4a1b75df0786ab1c67/xhey-ad-clean.snippet)：`sdkquic.e.qq.com/launch`。
- [运动对象清空的公开实现](https://github.com/yisaings/surge/blob/86346ebeaca5a2fca70ba562b729e7ed5b242c04/baidumap/baidumap-ad.js)：`sport_card = {}` 的处理线索；不作为当前手机显示效果的验证证据。

本项目独立编写内联 JQ、匹配规则和测试；没有打包第三方二进制处理库或远程脚本。


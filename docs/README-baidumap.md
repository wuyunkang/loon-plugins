# 百度地图去广告 · Loon 插件

当前发布：**2026-11-17 14:39（北京时间）诊断版**，适配规则依据 iOS 百度地图 **22.2.0** 抓包编写。用户使用 Loon **3.5.3**；原生 JQ 复写要求 **3.5.1（978）或更新版本**。

本次直接替换原来的 `Plugin/BaiduMap_remove_ads.lpx`，已有导入地址保持不变。插件名称和日期均包含时分。只需导入这一个插件，无需单独导入 JS 或图片。

用户反馈上一版首页 Logo、百度运动均未生效。本版增加首页文字探针和响应版本标记，用于核对实际匹配、JSON 改写及客户端渲染，**尚未确认修复这两个问题**。

## 安装或更新

[导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2FBaiduMap_remove_ads.lpx) · [原始插件](https://raw.githubusercontent.com/wuyunkang/loon-plugins/main/Plugin/BaiduMap_remove_ads.lpx)

1. 已使用上述地址的用户，在 Loon 更新该插件；如之前导入本地文件，停用旧版后通过上述链接导入，确保只启用一份。
2. 确认插件名为“百度地图去广告·诊断 2026-11-17 14:39”。
3. 开启复写和 MitM，安装并在 iOS 中完全信任 Loon 证书。解密主机为 `newclient.map.baidu.com`、`ecom.map.baidu.com`、`dss0.bdstatic.com`。
4. 完全退出百度地图，重新打开首页和“我的”各一次，再导出新抓包以核对实际响应。诊断步骤见[诊断说明](README-baidumap-diagnostic.md)。

## 规则内容与范围

下表描述插件的匹配和数据处理，不能等同于每个模块已在手机界面隐藏。

| 位置 | 处理 |
| --- | --- |
| 旧开屏、横幅、搜索推广、通知横条及商业推广 | 精确匹配已知接口后拒绝请求，保留其他地图和导航接口 |
| `ecom.map.baidu.com/ad-ops/afd/entry`、`material_async` | HTTP 200 且 `code=0`、字段类型符合时清空 `result.ad_info` |
| `feed/govui/rich_content?from=homepage` | 成功响应的推荐列表换为一张可见“百度地图”文字探针卡，保留一个空白默认分类；尝试将卡片上内边距设为 46、下内边距设为 6，使文字下移；实际位置以手机显示为准 |
| 同一信息流接口的其他来源 | 只移除 `feed_fengchao_ad_card` 广告卡，保留其他内容 |
| `usercenter/mine/page` | HTTP 200 且 `error=2000` 时删除金币、金融、店铺下发字段和相关角标、金币布局项；已有对象类型的 `sport_card` 改为 `{}` |
| 广告主机和素材 | 精确广告域名与已知素材路径拦截，不使用整站百度域名封锁 |
| 两个诊断接口 | 移除条件缓存头，增加固定版本及目标响应头，详见诊断说明 |

清理字段包括 `gold`、`gold_coin_card`、`finance`、`shop`、`corner_marks.dxm`、`corner_marks.shop`，以及 `card_list` 中的 `gold`。百度运动空对象处理不为缺失、null 或未知类型新增模块。

广告精确域名为 `afd.baidu.com`、`afdconf.baidu.com`、`api.yunxish.com`、`cdn.yunxish.com`、`cpc-service-square.yunxish.com`、`cpc-service-square.iggrowth.cn`、`sdkquic.e.qq.com`、`oss.cdn.aiclk.com`、`rcv.aiclk.com`。这些服务可能被其他 App 共用，启用后也会影响其他 App 到相同主机的广告请求。

## 已知限制

- 用户截图确认上一版文字位置偏上、百度运动卡片仍显示。本版尝试下移文字，运动规则暂未改变；两项效果均待手机验证。
- 首页面板整体最小高度由 App 控制，改写卡片内边距不能保证缩小整个空白区域。
- 删除店铺下发字段和营销角标不能保证隐藏本地“我的店铺”等功能按钮；目前未找到可靠的按钮隐藏配置。
- 底部 AI“长按说话”入口仍未实现隐藏，不能仅凭语音资源字段推断其显示开关。
- 诊断头只证明相应头部规则命中，不能证明 JQ 成功或 App 使用了改写结果。抓包若导出改写前内容，应结合 Loon 复写日志判断。
- 真实 HTTP 或业务错误正文保持原样；定位、路线和导航相关接口不加入诊断头。

## 本地验证

需要 Node.js 和 [jq](https://github.com/jqlang/jq/releases)。jq 放入 PATH，或通过 `BAIDUMAP_JQ_PATH` 指向本机 jq 可执行文件。

```powershell
node --test tests/validate-baidumap.test.cjs tests/validate-baidumap-diagnostic.test.cjs
```

共 80 项检查覆盖接口边界、真实 jq 执行、业务错误保留、数据类型、重复处理、文字探针、版本标记及缓存头范围。它们验证规则和响应数据，不是手机界面验收。

原始抓包、账号、坐标、Cookie、令牌和设备信息不随插件或测试发布。诊断规则不记录或发送这些内容。

## 参考

[Loon 原生复写文档](https://nsloon.app/docs/Rewrite/rewrite_v2/)

- [fmz200 百度地图插件](https://github.com/fmz200/wool_scripts/blob/387707db00a8e7e1346fe333cfe870e1784c7d95/Loon/plugin/split/partB/BaiduMaps.lpx)：AFD 主机、旧开屏接口及素材路径。
- [Moli-X 百度地图配置](https://github.com/Moli-X/Resources/blob/63a1376e68cb86adb434a8136df6bfd2df59aae6/Rewrite/BaiduMap.conf)：搜索推广与商业推广接口。
- [RuCu6 百度地图处理脚本存档](https://github.com/jqyisbest/RuCu6/blob/a9fbeac4ac28af42a52f6fcc0a77ffe298aa8921/Scripts/baidu/map.js)：通知横条结构。
- [DD-AD 广告规则](https://github.com/afwfv/DD-AD/blob/fc31a0d02c05ed8873dd535a29fcf9355801a69f/rule/DD-AD.txt)：趣盟与 aiclk 广告域名分类。
- [腾讯广告 SDK 接口拦截示例](https://github.com/ZenmoFeiShi/Qx/blob/5df3cafc468419e7b58b0f4a1b75df0786ab1c67/xhey-ad-clean.snippet)：`sdkquic.e.qq.com/launch`。
- [运动对象清空的公开实现](https://github.com/yisaings/surge/blob/86346ebeaca5a2fca70ba562b729e7ed5b242c04/baidumap/baidumap-ad.js)：`sport_card = {}` 的处理线索；不作为当前手机显示效果的验证证据。

本项目独立编写内联 JQ、匹配规则和测试，没有打包第三方远程脚本或二进制处理库。

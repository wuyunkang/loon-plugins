# 百度地图诊断版 2026-11-17 14:44

本版尝试收起首页空白区域，并保留我的页诊断。它仍是单个 Loon 插件，不需要额外 JS；手机效果尚待验证。

## 使用

1. 更新原地址的百度地图插件，或停用本地旧版后[导入本版](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2FBaiduMap_remove_ads.lpx)，仅启用一份。仓库文件为 [`Plugin/BaiduMap_remove_ads.lpx`](../Plugin/BaiduMap_remove_ads.lpx)。
2. 在 Loon 插件列表确认名称显示“百度地图去广告·诊断 2026-11-17 14:44”。日期和时分采用北京时间。
3. 保持复写、HTTPS 解密开启。解密主机沿用原插件。
4. 完全退出百度地图后重新打开，停留首页，再进入“我的”页各一次。
5. 导出这次抓包，用来核对两个接口和实际响应。无需反复清缓存或重装 App。

用户反馈使用 Loon 3.5.3，高于文档标注的新版复写最低版本。当前检查重点是实际规则匹配、响应数据和客户端渲染，而不是继续猜隐藏字段。

## 本版增加的诊断

| 位置 | 内容 |
| --- | --- |
| 首页推荐响应头 | `X-BMap-Diag-Version: 20261117-1444`、`X-BMap-Diag-Target: rich-content` |
| 我的页响应头 | `X-BMap-Diag-Version: 20261117-1444`、`X-BMap-Diag-Target: mine-page` |
| 首页渲染探针 | 清空推荐内容和分类，移除文字占位卡，尝试让客户端收起区域；效果需手机验证 |
| HTTP 缓存 | 仅对这两个接口移除 If-None-Match / If-Modified-Since，要求重新验证；响应设为 no-store |
| 百度运动 | 沿用显式空对象处理，便于检查实际下发的 `sport_card` |

标记只证明相应诊断规则匹配，**不能证明 JQ 已成功执行、App 使用了改写数据或模块已经隐藏**。若抓包工具导出的是改写前原始响应，可能看不到标记，需要结合 Loon 复写日志判断，不能仅凭缺少标记下结论。

需要核对的接口：

- `newclient.map.baidu.com/feed/govui/rich_content`：首页来源为 `from=homepage`；检查实际内容中 `posts.content` 和 `themes.content` 是否为空数组。
- `newclient.map.baidu.com/usercenter/mine/page`：检查业务成功响应里的 `data.sport_card` 是否为 `{}`。

HTTP 错误会有诊断响应头，但错误正文不作 JSON 清理。诊断不打印请求、账号、坐标、Cookie 或授权信息，也不加入这些数据到插件。

## 本地检查的边界

当前插件的 77 项测试通过。它们验证内联 JQ、版本一致、请求头处理范围、标记和空列表输出，不是手机界面验收。

诊断版只改变两个接口的缓存头和增加版本响应头；原有广告过滤继续保留，首页不再插入文字探针或占位卡。关闭本版即可撤销诊断头和缓存策略。

[Loon 原生复写文档](https://nsloon.app/docs/Rewrite/rewrite_v2/)

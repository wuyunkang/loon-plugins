# Loon 插件

个人维护的 Loon 插件，按应用整理。点击安装链接可在 Loon 中导入；也可以复制原始链接到 Loon 的插件添加页面。

| 插件 | 功能与说明 | 安装 |
| --- | --- | --- |
| 红果短剧 | 拦截广告接口和连播广告节点；金币任务及福利奖励不可用。 | [导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2FHongguo_remove_ads.lpx) · [原始文件](https://raw.githubusercontent.com/wuyunkang/loon-plugins/main/Plugin/Hongguo_remove_ads.lpx) |
| 盯盯拍 | 清理第三方广告配置、社区和商城横幅及延保推广。[详细说明](docs/README-ddpai.md) | [导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2FDDPai_remove_ads.lpx) · [原始文件](https://raw.githubusercontent.com/wuyunkang/loon-plugins/main/Plugin/DDPai_remove_ads.lpx) |
| 百度地图 | 2026-11-17 14:14 诊断版：保留开屏及推广清理，增加首页文字探针和响应版本标记。[详细说明](docs/README-baidumap.md) | [导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2FBaiduMap_remove_ads.lpx) · [原始文件](https://raw.githubusercontent.com/wuyunkang/loon-plugins/main/Plugin/BaiduMap_remove_ads.lpx) |

## 使用说明

启用插件后按需开启复写、脚本和 MitM，并在 iOS 安装并信任 Loon 证书。百度地图和红果短剧插件要求 Loon 3.5.1 (978) 或更新版本。盯盯拍插件引用本仓库的远程脚本，使用时需要能够访问 GitHub。

去广告效果会随应用版本变化；用户反馈百度地图上一版 Logo 和百度运动未生效，当前发布为诊断版，尚未确认修复。盯盯拍插件尚未完成手机实测。插件可能影响共享广告域名或相关福利功能，遇到异常可停用插件排查。

## 目录与验证

- `Plugin/`：Loon 插件。
- `Script/`：插件引用的脚本。
- `docs/`：安装细节、适用范围和已知限制。
- `tests/`：本地验证；Node.js 测试中百度地图用例还需要 jq。

```powershell
node --test tests/validate-ddpai.test.cjs tests/validate-baidumap.test.cjs tests/validate-baidumap-diagnostic.test.cjs
./tests/validate-hongguo-plugin.ps1
```

原始抓包和个人数据不包含在仓库中。

# Loon 插件

个人维护的 Loon 插件，按应用整理。点击安装链接可在 Loon 中导入；也可以复制原始链接到 Loon 的插件添加页面。

| 插件 | 功能与说明 | 安装 |
| --- | --- | --- |
| 红果短剧 | 拦截广告接口和连播广告节点；金币任务及福利奖励不可用。 | [导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2F%E7%BA%A2%E6%9E%9C%E7%9F%AD%E5%89%A7%E5%8E%BB%E5%B9%BF%E5%91%8A.plugin) · [原始文件](https://raw.githubusercontent.com/wuyunkang/loon-plugins/main/Plugin/%E7%BA%A2%E6%9E%9C%E7%9F%AD%E5%89%A7%E5%8E%BB%E5%B9%BF%E5%91%8A.plugin) |
| 盯盯拍 | 清理第三方广告配置、社区和商城横幅及延保推广。[详细说明](docs/README-ddpai.md) | [导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2F%E7%9B%AF%E7%9B%AF%E6%8B%8D%E5%8E%BB%E5%B9%BF%E5%91%8A.plugin) · [原始文件](https://raw.githubusercontent.com/wuyunkang/loon-plugins/main/Plugin/%E7%9B%AF%E7%9B%AF%E6%8B%8D%E5%8E%BB%E5%B9%BF%E5%91%8A.plugin) |
| 百度地图 | 清理开屏和部分推广，首页推荐替换为 Logo 占位。[详细说明](docs/README-baidumap.md) | [导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fwuyunkang%2Floon-plugins%2Fmain%2FPlugin%2F%E7%99%BE%E5%BA%A6%E5%9C%B0%E5%9B%BE%E5%8E%BB%E5%B9%BF%E5%91%8A.plugin) · [原始文件](https://raw.githubusercontent.com/wuyunkang/loon-plugins/main/Plugin/%E7%99%BE%E5%BA%A6%E5%9C%B0%E5%9B%BE%E5%8E%BB%E5%B9%BF%E5%91%8A.plugin) |

## 使用说明

启用插件后按需开启复写、脚本和 MitM，并在 iOS 安装并信任 Loon 证书。百度地图和红果短剧插件要求 Loon 3.5.1 (978) 或更新版本。盯盯拍插件引用本仓库的远程脚本，使用时需要能够访问 GitHub。

去广告效果会随应用版本变化；百度地图新版 Logo 和运动清理、盯盯拍插件尚未完成手机实测。插件可能影响共享广告域名或相关福利功能，遇到异常可停用插件排查。

## 目录与验证

- `Plugin/`：Loon 插件。
- `Script/`：插件引用的脚本。
- `docs/`：安装细节、适用范围和已知限制。
- `tests/`：本地验证；Node.js 测试中百度地图用例还需要 jq。

```powershell
node --test tests/validate-ddpai.test.cjs tests/validate-baidumap.test.cjs
./tests/validate-hongguo-plugin.ps1
```

原始抓包和个人数据不包含在仓库中。


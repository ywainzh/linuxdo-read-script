# GreasyFork 美化增强版

将 Greasy Fork 和 Sleazy Fork 页面重绘为 GitHub 风格，并修复站内页面跳转时原生红色界面短暂闪现的问题。

## 安装

- [从 GitHub Raw 安装](https://raw.githubusercontent.com/ywainzh/linuxdo-read-script/main/plugins/GreasyFork%E7%BE%8E%E5%8C%96%E5%A2%9E%E5%BC%BA%E7%89%88/greasyfork-github-redesign.user.js)
- [从 Greasy Fork 安装](https://greasyfork.org/zh-CN/scripts/589199-greasyfork-%E7%BE%8E%E5%8C%96%E5%A2%9E%E5%BC%BA%E7%89%88-github-redesign)

需要 Tampermonkey、Violentmonkey 等用户脚本管理器。脚本匹配：

- `https://greasyfork.org/*`
- `https://sleazyfork.org/*`

## 本版修复

- 在 `document-start` 阶段立即应用当前明暗主题并隐藏尚未改造的原生页面。
- 页面完成 GitHub 风格改造后，在下一绘制帧显示内容，避免站内跳转时闪出旧版红色界面。
- 同站链接和表单提交时启用主题一致的离场遮罩，修复点击“论坛”等入口时的轻微闪屏。
- 初始化失败时最多等待 2500ms 即恢复原页面，避免异常导致页面一直不可见。
- 兼容浏览器前进、后退缓存恢复。
- 个人页将“脚本”入口移动到“控制台”下方，便于配合批量发布助手使用。

## 上游与许可

本脚本基于 [GreasyFork 美化 | GreasyFork GitHub Redesign 1.2.3](https://greasyfork.org/zh-CN/scripts/587412-greasyfork-%E7%BE%8E%E5%8C%96-greasyfork-github-redesign) 修改。

- 原作者：咸鱼真人
- 修复维护：ywainzh
- 上游源码 SHA-256：`01A93DD1AF1B9E6F08578790795F5E369E2ED0D1EF910BCFD6893DE0E4A1ACC0`
- 许可证：MIT

原作者和第三方依赖的版权声明均保留在用户脚本源码中。

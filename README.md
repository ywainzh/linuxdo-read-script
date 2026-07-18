# LinuxDo 便捷脚本

> 在 LINUX DO 与 IDC Flare 列表页点击标题即可弹窗预览整帖，支持楼中楼、互动、原图灯箱、已读进度与 Obsidian 首帖快照——无需离开列表页，也无需反复返回。

![version](https://img.shields.io/badge/version-1.1.15-blue)
![platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey-orange)
![license](https://img.shields.io/badge/license-MIT-green)
[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-安装脚本-red)](https://greasyfork.org/zh-CN/scripts/586863-linuxdo-%E4%BE%BF%E6%8D%B7%E8%84%9A%E6%9C%AC)

## 简介

[LINUX DO](https://linux.do) 与 [IDC Flare](https://idcflare.com) 均基于 Discourse 构建。本脚本利用当前论坛的 Discourse JSON 接口，在话题列表页拦截标题点击，以**弹窗**形式直接预览帖子内容，避免频繁跳转与"返回即刷新、丢失浏览位置"的困扰。所有交互（点赞、回复、收藏、已读）均使用当前域名的接口和浏览器登录态，两个论坛之间不会混用数据。

## 功能特性

- **智能续读与通知直达**：列表标题会从第一条未读回复继续阅读；通知/用户菜单中的具体楼层链接会直接定位并高亮目标楼层。
- **楼中楼评论**：依据 `reply_to_post_number` 还原嵌套回复结构，缩进展示父子关系。
- **双向分片加载**：基于目标楼层前后窗口按需加载，滚动到顶部或底部自动补齐前后楼层；向上插入时保持当前视口不跳动。
- **流畅滚动优化**：时间轴使用常量级当前楼层探测，楼层批量插入，并跳过离屏内容的绘制，长帖滚动时不逐帧扫描全部楼层。
- **右侧时间轴**：弹窗内显示类似原帖的楼层进度与首尾日期；点击顶部日期回到开头，点击底部日期会加载剩余楼层并跳到最新回复。
- **请求限流与自动重试**：只读请求统一串行并保持最小间隔；遇到 HTTP 429 会遵循 `Retry-After` 或指数退避后自动重试。
- **未读蓝点**：弹窗内未读楼层会显示类似原帖的小蓝点，阅读并成功上报后自动消失。
- **点赞 / 取消赞**：显示点赞数，支持一键点赞与取消（取消受 Discourse 时间窗限制）。
- **用户详情卡片**：点击弹窗内楼层头像可查看用户详情；在详情卡片中再次点击头像会新开标签进入用户主页。
- **楼内回复**：可对任意楼层回复，发送后即时插入为该楼的楼中楼子节点。
- **整帖收藏 / 取消收藏**：调用 Discourse 书签接口。
- **原图灯箱**：点击正文图片、图片信息条或图片右下角的放大控件，均以原图地址（外层 `a.lightbox` 的 `href`）打开脚本灯箱；点图片、点空白、按 Esc、点右上角 × 均可关闭。
- **Base64 解码**：在原帖或弹窗正文中选中 Base64 文本，可从浮动菜单直接解码，并复制或关闭解码结果。
- **保存到 Obsidian**：原帖标题区与阅读弹窗均可把楼主首帖保存为 Markdown 笔记；同一帖子重复保存时更新原文件，并支持 Local REST API 静默写入和 Obsidian URI 兜底模式。
- **OP / ME 标识**：楼主所有楼层标注蓝色 `OP`，本人楼层标注绿色 `ME`。
- **打开原帖**：头部一键在新标签页打开帖子原始页面。
- **已读上报**：仅对**滚动进入视口并停留足够时间**的楼层，按真实阅读节奏调用 `topics/timings` 上报，使弹窗阅读也能计入 Connect 进度。

## 安装

1. 安装用户脚本管理器：[Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. 打开 [Greasy Fork 脚本页](https://greasyfork.org/zh-CN/scripts/586863-linuxdo-%E4%BE%BF%E6%8D%B7%E8%84%9A%E6%9C%AC) 并点击安装。
3. 刷新 `https://linux.do` 或 `https://idcflare.com` 任意页面即可生效。

## 发布更新

仓库内提供了一个 Greasy Fork 发布助手：[tools/greasyfork-update-helper.user.js](./tools/greasyfork-update-helper.user.js)。
先安装 [Greasy Fork 发布助手](https://raw.githubusercontent.com/ywainzh/linuxdo-read-script/main/tools/greasyfork-update-helper.user.js)，后续更新流程：

1. 修改 `LinuxDo 便捷脚本.user.js`，并递增脚本头里的 `@version`。
2. 提交并推送到 GitHub `main` 分支。
3. 打开 [Greasy Fork 脚本页](https://greasyfork.org/zh-CN/scripts/586863-linuxdo-%E4%BE%BF%E6%8D%B7%E8%84%9A%E6%9C%AC)，点击页面右下角的“拉取 GitHub 最新版并发布”。
4. 如 Greasy Fork 要求登录或 GitHub 授权，按页面提示完成即可，发布助手会继续处理后续步骤。

## 使用说明

| 操作 | 效果 |
| --- | --- |
| 点击列表标题 | 弹窗预览该帖；存在未读时自动定位到第一条未读回复 |
| 点击通知中的帖子 | 直接定位并高亮通知对应楼层 |
| 滚动弹窗 | 自动向上/向下补齐楼层，并按停留时长上报已读 |
| 右侧顶部日期 | 跳到帖子顶部 |
| 右侧底部日期 | 加载剩余楼层并跳到最新回复 |
| 点击楼层头像 | 弹出用户详情卡片 |
| 点击详情卡片头像 | 新标签页打开用户主页 |
| 点击图片或放大控件 | 原图灯箱查看，再次点击/Esc 关闭 |
| 保存到 Obsidian | 将楼主首帖、帖子信息、标签和原帖链接保存为 Markdown 笔记 |
| Obsidian 设置按钮 | 配置 REST API、URI 模式、Vault 名称和基础目录 |
| ♥ 按钮 | 点赞 / 取消赞 |
| ↩ 回复 | 展开回复框，发送后插入楼中楼 |
| ☆ 收藏本帖 | 收藏 / 取消收藏整帖 |
| ↗ 打开原帖 | 新标签页打开原始帖子页面 |
| Esc / 点击遮罩 / × | 关闭当前最上层的详情卡片、灯箱或弹窗 |

## 保存到 Obsidian

脚本只保存楼主首帖，不抓取评论。同一站点、同一帖子只对应一个笔记，第一次保存时创建文件；再次保存会先提示“检测到已保存的帖子”，确认后才更新原文件，不产生重复副本。笔记不生成重复的 YAML 属性和正文标题，元数据统一汇总到“帖子信息”，标签显示在其下方。默认路径为：

```text
论坛收藏/{LINUX DO 或 IDC Flare}/{分类}/{标题}.md
```

脚本会在油猴私有存储中按“站点 + 帖子 ID + 基础目录”记录笔记路径，因此帖子改名后仍会更新原文件；如果不同帖子恰好同名，则自动使用 `{标题}-2.md`、`{标题}-3.md` 避免互相覆盖。此前已生成的时间戳副本不会自动删除。

首次点击“保存到 Obsidian”会打开配置：

1. **直接写入 Vault（默认）**：在 Obsidian 安装并启用社区插件 Local REST API，保持 Obsidian 运行；地址默认使用 `http://127.0.0.1:27123`，填写插件提供的 API Key 后可先测试连接。保存时不会打开或切换到 Obsidian。
2. **Obsidian URI**：无需 Local REST API。脚本先把 Markdown 写入剪贴板，再调用 `obsidian://new` 打开 Obsidian；Vault 名称可留空以使用当前 Vault。

API Key 只保存在用户脚本管理器的私有存储中。REST 地址强制限制为 `localhost` 或 `127.0.0.1`，不会把 Key 发送到外部服务器。图片保留论坛原始链接，不会自动下载到 Vault 附件目录。

## 配置项

脚本顶部提供可调常量：

```js
const PAGE_SIZE = 20;          // 每次分块加载的楼层数
const SLICE_RADIUS = 20;       // 定位时目标楼层前后各预加载的数量
const READ_THRESHOLD = 1500;   // 单楼累计可见超过该毫秒数才算"读过"
const FLUSH_INTERVAL = 5000;   // 已读增量上报间隔（毫秒）
const REQUEST_MIN_INTERVAL = 300; // 相邻只读请求最小间隔（毫秒）
const RETRY_MAX_ATTEMPTS = 3;     // HTTP 429 最大重试次数
const RETRY_BASE_DELAY = 500;     // 指数退避基础延迟（毫秒）
```

想更保守地上报已读，可调大 `READ_THRESHOLD`（如 `3000`）；若仍频繁遇到限流，可适当增大 `REQUEST_MIN_INTERVAL`。

## 工作原理

- **数据获取与定位**：`GET /t/{id}.json` 取得话题信息和完整 `post_stream.stream`；续读或通知直达时用 `GET /t/{id}.json?post_number={楼层}` 精确定位，再通过 `GET /t/{id}/posts.json?post_ids[]=...` 加载目标窗口。
- **双向续加载**：目标窗口上下各维护一个游标，顶部/底部哨兵进入视口时分别加载前一批或后一批；向上加载根据内容高度变化补偿滚动位置。
- **请求队列**：所有只读 GET 请求串行执行且保持最小间隔；HTTP 429 最多重试 3 次，优先采用服务端 `Retry-After`，否则按 500/1000/2000ms 退避。写操作不自动重试。
- **楼中楼**：以楼层号建立映射，按 `reply_to_post_number` 挂到父节点；跨分块未就绪的父级先暂存，块加载完后回扫归位。
- **已读上报**：用 `IntersectionObserver` 记录楼层进入/离开视口的时间戳累计停留时长，达阈值后通过 `POST /topics/timings`（带 `topic_time`、`timings[楼层]=毫秒`）增量上报；切后台自动暂停计时，避免虚增。
- **交互接口**：点赞 `POST/DELETE /post_actions`、回复 `POST /posts`、收藏 `POST/DELETE /bookmarks`，均携带 `X-CSRF-Token`。
- **Obsidian 快照**：复用已加载的楼主首帖或 `GET /t/{id}.json`，将 Discourse `cooked` HTML 转为 Markdown；REST 模式通过油猴跨域接口向本机 Local REST API 执行单次 `PUT`，URI 模式通过剪贴板交给 `obsidian://new`。

## ⚠️ 风控与使用须知

已读上报本质上是程序化提交阅读数据，LINUX DO 对**异常自动化访问**有风控机制。本脚本已尽量贴近真人节奏（按可见性、按停留阈值、增量上报、后台不计时），正常浏览强度下风险较低。但请勿配合任何脚本批量、高频地刷帖，否则可能被判定为异常访问，导致统计不计入甚至账号风险。**请按正常阅读节奏使用，风险自负。**

本脚本不生成、不代写任何用于发布到社区的内容；回复功能仅转发你本人手动输入的文字。

## 兼容性

- 适用于基于 Discourse 的 `https://linux.do` 与 `https://idcflare.com`；脚本只在这两个明确配置的域名运行。
- IDC Flare 的 Cloudflare 验证需由用户在浏览器中正常完成；通过后脚本复用当前页面的同源 Cookie，不绕过站点验证。
- 依赖现代浏览器特性：`fetch`、`IntersectionObserver`、`ResizeObserver`、`URLSearchParams` 和 CSS `content-visibility`。
- 大部分功能需登录后才能成功调用（点赞、回复、收藏、已读上报）。
- Obsidian REST 模式需要用户脚本管理器允许访问 `localhost/127.0.0.1`；脚本更新后管理器可能要求重新确认新增权限。

## 常见问题

**Q：点击通知面板里的帖子没反应？**
A：不同 Discourse 版本的用户菜单 DOM 结构不同，可在脚本第 11 节的 `MENU_PANEL_SEL` 中补充该面板的实际容器类名。

**Q：图片没按原图显示？**
A：脚本会在捕获阶段优先接管正文图片、图片信息条和右下角放大控件，取外层 `a.lightbox` 的 `href` 作为原图；若某图无该外层链接，会回退到 `src` 显示。

**Q：已读没生效？**
A：确认已登录，且该楼确实滚动进入视口并停留超过 `READ_THRESHOLD`；后台标签页不计时。

**Q：滚动较快时出现 429 或加载失败？**
A：脚本会自动排队并退避重试；如果仍频繁出现，可适当增大 `REQUEST_MIN_INTERVAL`。

## 许可证

[MIT](./LICENSE)

## 免责声明

本项目为个人学习与效率工具，与 LINUX DO 官方无关。使用本脚本所产生的一切后果由使用者自行承担。

Obsidian Markdown 转换与写入流程移植并改编自 zsq 的 MIT 脚本 [linux.do 帖子保存到 Obsidian](https://greasyfork.org/zh-CN/scripts/587200-linux-do-%E5%B8%96%E5%AD%90%E4%BF%9D%E5%AD%98%E5%88%B0-obsidian)。


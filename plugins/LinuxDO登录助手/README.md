# Linux DO 登录助手

独立用户脚本，用于在第三方网站优先选择 Linux DO 登录，并在 Linux DO Connect OAuth 页面自动执行授权。

当前版本：`1.3.1`

## 功能

- 识别包含“使用 Linux DO 继续”等文字的登录按钮，并在倒计时结束后自动点击。
- 在 `https://connect.linux.do/oauth2/` 页面识别“允许”按钮并自动授权。
- 自动登录和自动授权可分别开启、关闭，并可分别设置 `0.5` 至 `60` 秒等待时间。
- 支持所有域名、黑名单以外和仅白名单三种执行范围，域名规则支持子域名。
- 页面边缘提供可拖动的设置按钮；自动操作前显示倒计时，可取消本次操作。
- 所有设置只保存在用户脚本管理器的私有存储中，不会上传到外部服务器。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. 打开 [GitHub Raw 安装地址](https://raw.githubusercontent.com/ywainzh/linuxdo-read-script/main/plugins/LinuxDO%E7%99%BB%E5%BD%95%E5%8A%A9%E6%89%8B/linuxdo-auto-login.user.js)。
3. 在用户脚本管理器中确认安装。

脚本使用 `http://*/*` 和 `https://*/*`，安装时用户脚本管理器会提示它可以在所有 HTTP(S) 网站运行。这是识别第三方网站 Linux DO 登录按钮所必需的权限。

## 默认行为

- 自动登录：开启，等待 `3` 秒，对所有域名生效。
- 自动授权：开启，等待 `3` 秒，对所有域名生效；实际授权目标仍严格限制为 `connect.linux.do/oauth2/`。
- 点击页面边缘的 Linux DO 图标可以修改开关、等待时间和域名规则。

自动授权会代表当前登录账号点击 OAuth 的“允许”按钮。若希望逐个确认授权，请关闭自动授权，或将其域名范围改为“仅白名单”。

## 许可证

MIT，版权和作者信息以用户脚本头部声明为准。

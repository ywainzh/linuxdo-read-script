# 网站 Cookie 获取器

Chrome 132+ 扩展，用于导出当前活动页面可匹配的 Cookie，并在 Cookie 发生变化时把对应域的完整快照同步到用户配置的后台。

## 功能

- 弹窗数据严格绑定当前活动标签页、URL 和 Cookie Store，不使用跨标签页的全局缓存。
- 同时读取普通 Cookie 和当前顶层框架 Partition Key 下的分区 Cookie。
- 支持普通和隐身 Cookie Store；隐身模式需要用户在扩展管理页中授权。
- 后台通过 `chrome.cookies.onChanged` 监听所有获准域名，不依赖标签页是否活动或网络请求事件。
- 支持按域名、Cookie 键过滤，500ms 防抖，重复快照抑制和最后一个 Cookie 删除后的空快照。
- 后台请求具有 10 秒超时；网络错误、超时和 5xx 会重试一次，4xx 不重试。
- Cookie 快照不会写入持久化存储；后台配置保存在 `storage.local`，临时状态和快照哈希保存在 `storage.session`。

## 安装

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择本目录。
4. 如需隐身 Cookie，在扩展详情中开启“在无痕模式下启用”。

扩展要求 Chrome 132 或更高版本，以使用 `chrome.cookies.getPartitionKey()`。

## Cookie 导出

弹窗只接受 HTTP(S) 页面，并使用完整活动页 URL 查询 Cookie，因此 Domain、Path 和 Secure 条件与当前 URL 相符。普通和分区 Cookie 统一按名称升序展示，以便与 DevTools 默认顺序对照；Partition Key 仍会显示在详情中，同名 Cookie 不会合并。

复制格式固定为 Cookie Header 字符串：

```text
name=value; name2=value2
```

单个 Cookie 的复制格式为 `name=value`。该格式适合交给 `curl` 或 `curl_cffi` 访问当前 URL，但并不保证等同于 Chrome 在所有重定向、iframe 或跨站请求中的实际 Cookie 请求头。

## 后台同步

每次相关 Cookie 变化后，扩展按 `storeId + partitionKey + domain` 等待 500ms，再读取该域的最新完整快照。父域查询额外返回的子域 Cookie 会被排除；Cookie 键过滤同时作用于触发事件和最终快照。

新安装及主动重置的默认数据模板为：

```json
{"domain":"{domain}","storeId":"{storeId}","partitionKey":{partitionKey},"event":{event},"cookies":{cookies}}
```

默认渲染后的数据结构如下：

```json
{
  "domain": "example.com",
  "storeId": "0",
  "partitionKey": null,
  "event": {
    "removed": false,
    "cause": "explicit",
    "cookie": {
      "name": "sessionid",
      "value": "example",
      "domain": ".example.com",
      "path": "/",
      "storeId": "0"
    }
  },
  "cookies": []
}
```

支持的占位符：

- `{domain}`：规范化后的 Cookie 域名。
- `{storeId}`：产生变化的 Cookie Store。
- `{partitionKey}`：分区键对象；普通 Cookie 为 `null`。
- `{event}`：500ms 窗口内最后一次相关的完整变更事件。
- `{cookies}`：过滤后的最新完整快照，允许为空数组。

旧的 `{domain}`、`{cookies}` 模板保持兼容，已保存配置不会自动改写。模板保存前会用示例数据渲染并验证为合法 JSON。

## 安全限制和状态

- 后台接口只允许 HTTPS。
- 本地开发允许 `http://localhost` 和 `http://127.0.0.1`，可使用任意端口。
- 已保存的不安全地址不会被自动修改，但会被禁止发送并显示错误。
- 弹窗和配置页都会显示最近一次连接测试或自动同步的成功/失败状态。
- Cookie、过滤器和后台响应都以文本节点显示，避免 HTML 注入。

Cookie 是敏感登录凭据。扩展只向用户配置的地址发送数据，但接收服务的安全性、访问控制和保存策略由用户负责。扩展无法访问其他 Chrome 用户配置文件；隐身数据仅在用户显式授权后可访问。

## 测试

本目录不需要安装第三方依赖。运行：

```powershell
npm test
```

测试使用 Node 内置的 `node:test`，覆盖 Cookie 身份和顺序、同名 Cookie、过滤器、模板、空快照以及请求超时与重试策略。

## 许可证

MIT

作者：吾爱破解 18382747915

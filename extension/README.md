# 求职投递台 Chromium 扩展

## 构建与加载

在项目根目录运行：

```powershell
npm run build:extension
```

然后在 Chrome/Edge 扩展管理页启用开发者模式，加载 `extension/dist/`。每次修改扩展源码后，都需要重新构建并在扩展管理页点击“重新加载”。

主应用需要运行在 `http://localhost:3000/` 或 `http://127.0.0.1:3000/`。

## AI 填写与添加到投递台

1. 在招聘岗位页打开扩展右侧抽屉。
2. 点击“设置”，填写 DeepSeek API Key 和模型，默认模型为 `deepseek-chat`。
3. 点击“AI 一键填写”。任务会在扩展后台继续运行；切换页面或关闭抽屉后，回到同一招聘 URL 会恢复处理状态、AI 结果和手工修改的表单。
4. 核对并可修改所有字段。可选择“企业+岗位”或“仅添加企业”；AI 只回填表单，不会提交。
5. 用户点击“添加到投递台”后才发送到主应用。成功时显示“已提交”弹窗；失败时保存在“发送失败的草稿”中，可重试或删除。

API Key 只保存在扩展的 `chrome.storage.local`，不得提交到源码或截图中。插件会把裁剪后的当前页面内容发送给 DeepSeek，请勿在包含无关敏感信息的页面使用。

## 岗位匹配

使用前先启动本地 prompt 服务：

```powershell
npm run job-fit-server
```

然后打开招聘岗位页，点击扩展里的“岗位匹配”。流程如下：

1. 扩展采集当前页面 URL、标题、可见正文 `text` 和裁剪后的 HTML 摘要。
2. 扩展把页面上下文和表单中的公司、岗位、地点、批次、状态等信息发送到 `http://127.0.0.1:8765/job-fit`。
3. 本地服务根据岗位标题、页面标题和 JD 正文判断岗位类型：研发 / 产品 / 测试。
4. 本地服务读取写死的本地简历路由并构造 prompt，返回 `kind/resumePath/jdChars/prompt`。
5. 扩展在浏览器侧使用已配置的 DeepSeek API Key 发起流式请求，收到 token 立刻渲染，并持续写入页面缓存。

当前写死路由：

- 产品：`C:\Users\37116\Documents\Codex\2026-08-27\zhe-g\outputs\resume_chen_ru.html`
- 研发：`C:\Users\37116\Documents\Codex\2026-08-27\zhe-g\outputs\agent开发简历.html`
- 测试：`C:\Users\37116\Documents\Codex\2026-08-27\zhe-g\outputs\agent测开简历.html`

如果结果里 `JD 字符数` 为 0，说明当前页面正文没有被普通 DOM 方式读到，常见原因是 JD 在 iframe、Shadow DOM、未登录区域或异步懒加载区域。

如果出现 `[岗位匹配失败] fetch failed`：

- 确认已运行 `npm run job-fit-server`；
- 确认没有旧进程占用 `127.0.0.1:8765`；
- 修改扩展后已重新执行 `npm run build:extension` 并重新加载 `extension/dist/`。

## 维护与填充简历

在已登录的简历编辑页面打开扩展，点击“维护简历信息”。插件会提取当前页面表单字段并合并到右侧抽屉，可手工新增、修改、删除并保存。

点击“一键填充简历”后才会写入当前网页；插件不会上传附件、处理验证码或点击提交。

扩展还会加载仓库中的 `resume-data/resume-profile.json`。如果把 value 写入该 JSON 并提交到 Git，就会永久明文进入仓库和历史；抽屉里的“保存”只写浏览器本地副本，不会回写仓库文件。

## 测试

```powershell
npm run build:extension
node --test extension/tests/*.test.mjs
npm run lint
```

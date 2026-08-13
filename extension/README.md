# 求职投递台 Chromium 扩展

## 构建与加载

运行 `npm run build:extension`，然后在 Chrome/Edge 扩展管理页启用开发者模式并加载 `extension/dist/`。每次更新后都要点击扩展的“重新加载”。主应用需运行在 `http://localhost:3000/`。

## AI 填写与添加到投递台

1. 在招聘岗位页打开插件，点击“设置”。
2. 填写 DeepSeek API Key 和模型，默认模型为 `deepseek-chat`。
3. 点击“AI 一键填写”。任务会在扩展后台继续运行；切换页面或关闭弹窗后，回到同一招聘 URL 会恢复处理状态、AI 结果及手工修改的表单。
4. 核对并可修改所有字段。AI 只回填表单，不会提交。
5. 用户点击“添加到投递台”后才发送。成功时显示“已提交”弹窗并写入管理页 IndexedDB；失败时保存在“发送失败的草稿”中，可重新发送或删除。

API Key 只保存在扩展的 `chrome.storage.local`，不得提交到源码或截图中。插件会把裁剪后的当前页面 HTML 发送给 DeepSeek，请勿在包含无关敏感信息的页面使用。

## 测试

运行 `node --test extension/tests/*.test.mjs` 执行插件测试。完整仓库验证使用 `npm run lint`、`npm test` 和 `npm run build`。

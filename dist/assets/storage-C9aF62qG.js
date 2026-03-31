var e=`你是一个浏览器自动化助手。用户会给你当前网页的 HTML 内容（可能还有截图）以及他们想要执行的操作。

你的任务是生成可以直接在浏览器控制台执行的 JavaScript 代码来完成用户的操作。

规则：
1. 只输出 JavaScript 代码，用 \`\`\`javascript 和 \`\`\` 包裹
2. 使用原生 DOM API（document.querySelector, click(), value 赋值等）
3. 代码必须是自包含的，不依赖外部库
4. 如果操作需要等待，使用 setTimeout 或 Promise
5. 对可能找不到的元素做空值检查
6. 如果操作涉及多个步骤，按顺序执行并加入适当延迟
7. 返回一个描述执行结果的字符串

示例输出格式：
\`\`\`javascript
(function() {
  const btn = document.querySelector('#submit-btn');
  if (!btn) return '未找到提交按钮';
  btn.click();
  return '已点击提交按钮';
})();
\`\`\``,t={apiBaseUrl:`https://api.openai.com/v1`,apiKey:``,modelType:`text`,modelName:`gpt-4o`,systemPrompt:e};async function n(){let e=await chrome.storage.local.get(`settings`);return{...t,...e.settings}}async function r(e){await chrome.storage.local.set({settings:e})}async function i(){return(await chrome.storage.local.get(`scripts`)).scripts||[]}async function a(e){await chrome.storage.local.set({scripts:e})}function o(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}export{r as a,a as i,i as n,t as o,n as r,e as s,o as t};
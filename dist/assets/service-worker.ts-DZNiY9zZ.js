import{r as getSettings}from"./storage-Dc_xVt7z.js";async function callAI(e,t){let n=`${e.apiBaseUrl.replace(/\/+$/,``)}/chat/completions`,r={model:e.modelName,messages:t,stream:!1},i=await fetch(n,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e.apiKey}`},body:JSON.stringify(r)});if(!i.ok){let e=await i.text();throw Error(`AI API error (${i.status}): ${e}`)}return(await i.json()).choices?.[0]?.message?.content??``}async function callAIStream(e,t,n,r,i){let a=`${e.apiBaseUrl.replace(/\/+$/,``)}/chat/completions`,o={model:e.modelName,messages:t,stream:!0},s;try{s=await fetch(a,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e.apiKey}`},body:JSON.stringify(o)})}catch(e){i(e.message||`Network error`);return}if(!s.ok){let e=await s.text();i(`AI API error (${s.status}): ${e}`);return}let c=s.body?.getReader();if(!c){i(`No response body`);return}let l=new TextDecoder,u=``;for(;;){let{done:e,value:t}=await c.read();if(e)break;u+=l.decode(t,{stream:!0});let i=u.split(`
`);u=i.pop()||``;for(let e of i){let t=e.trim();if(!t||!t.startsWith(`data: `))continue;let i=t.slice(6);if(i===`[DONE]`){r();return}try{let e=JSON.parse(i).choices?.[0]?.delta?.content;e&&n(e)}catch{}}}r()}var SYSTEM_PROMPT=`你是一个浏览器自动化助手。用户会给你当前网页的 HTML 内容（可能还有截图）以及他们想要执行的操作。

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
\`\`\``;function buildMessages(e,t,n,r){let i=[{role:`system`,content:SYSTEM_PROMPT}];return e.modelType===`vision`&&r?i.push({role:`user`,content:[{type:`text`,text:`当前网页 HTML（已精简）:\n\n${n}\n\n用户操作需求: ${t}`},{type:`image_url`,image_url:{url:r.startsWith(`data:`)?r:`data:image/png;base64,${r}`}}]}):i.push({role:`user`,content:`当前网页 HTML（已精简）:\n\n${n}\n\n用户操作需求: ${t}`}),i}chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:!0}).catch(console.error),chrome.runtime.onMessage.addListener((e,t,n)=>{let r=messageHandlers[e.type];return r?(r(e,t,n),!0):!1});var messageHandlers={CAPTURE_SCREENSHOT:async(e,t,n)=>{try{let[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!e?.id){n({success:!1,error:`No active tab`});return}n({success:!0,data:await chrome.tabs.captureVisibleTab(e.windowId,{format:`png`})})}catch(e){n({success:!1,error:e.message})}},GET_HTML:async(e,t,n)=>{try{let[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!e?.id){n({success:!1,error:`No active tab`});return}n(await chrome.tabs.sendMessage(e.id,{type:`GET_HTML`}))}catch(e){n({success:!1,error:e.message})}},EXECUTE_CODE:async(msg,_sender,sendResponse)=>{try{const[tab]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!tab?.id){sendResponse({success:!1,error:`No active tab`});return}sendResponse((await chrome.scripting.executeScript({target:{tabId:tab.id},func:code=>{try{const result=eval(code);return{success:!0,result:String(result??`done`)}}catch(e){return{success:!1,error:e.message}}},args:[msg.data.code],world:`MAIN`}))[0]?.result??{success:!1,error:`No result`})}catch(e){sendResponse({success:!1,error:e.message})}},AI_CHAT:async(e,t,n)=>{try{let t=await getSettings();if(!t.apiKey){n({success:!1,error:`请先配置 API Key`});return}let{userMessage:r,html:i,screenshot:a}=e.data;n({success:!0,data:await callAI(t,buildMessages(t,r,i,a))})}catch(e){n({success:!1,error:e.message})}},AI_CHAT_STREAM:async(e,t,n)=>{try{let t=await getSettings();if(!t.apiKey){chrome.runtime.sendMessage({type:`AI_CHAT_STREAM_ERROR`,data:`请先配置 API Key`});return}let{userMessage:n,html:r,screenshot:i}=e.data;await callAIStream(t,buildMessages(t,n,r,i),e=>{chrome.runtime.sendMessage({type:`AI_CHAT_STREAM_CHUNK`,data:e})},()=>{chrome.runtime.sendMessage({type:`AI_CHAT_STREAM_DONE`})},e=>{chrome.runtime.sendMessage({type:`AI_CHAT_STREAM_ERROR`,data:e})})}catch(e){chrome.runtime.sendMessage({type:`AI_CHAT_STREAM_ERROR`,data:e.message})}}};
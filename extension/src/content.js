/* global chrome */
const MAX_HTML_LENGTH=120000;
function readableHtml(){const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('script,style,noscript,svg,iframe').forEach(node=>node.remove());return clone.outerHTML.replace(/\s+/g,' ').slice(0,MAX_HTML_LENGTH);}
async function resumeModule(){return import(chrome.runtime.getURL('src/resume-fields.js'));}
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type==='CAPTURE_PAGE_CONTEXT'){sendResponse({title:document.title||'',url:location.href,html:readableHtml()});return false;}
  if(message?.type==='EXTRACT_RESUME_FIELDS'){resumeModule().then(({extractResumeFields})=>sendResponse({fields:extractResumeFields(document).map(({descriptor})=>descriptor)})).catch(error=>sendResponse({error:error.message}));return true;}
  if(message?.type==='FILL_RESUME_FIELDS'){resumeModule().then(({buildResumeFillPlan,extractResumeFields,fillResumeFields})=>{const fields=extractResumeFields(document).map(({descriptor})=>descriptor),profile=Object.fromEntries((message.profile||[]).map(item=>[item.key,item.value])),plan=buildResumeFillPlan(fields,profile,message.aiMapping||{});sendResponse(fillResumeFields({documentLike:document,plan,userInitiated:true}));}).catch(error=>sendResponse({error:error.message}));return true;}
  if(message?.type==='IMPORT_APPLICATION_DRAFT'){const requestId=crypto.randomUUID(),timer=setTimeout(()=>finish({delivered:false,message:'投递台接收超时。'}),5000);function finish(result){clearTimeout(timer);window.removeEventListener('message',receive);sendResponse(result);}function receive(event){if(event.source===window&&event.data?.source==='goodjob-app'&&event.data?.type==='IMPORT_APPLICATION_RESULT'&&event.data?.requestId===requestId)finish(event.data.result);}window.addEventListener('message',receive);window.postMessage({source:'goodjob-extension',type:'IMPORT_APPLICATION_DRAFT',requestId,draft:message.draft},location.origin);return true;}
  return false;
});

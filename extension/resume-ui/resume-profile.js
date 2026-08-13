const STORAGE_KEY = 'resumeProfileFields';

export function normalizeResumeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field) => ({
      id: String(field?.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
      key: String(field?.key || '').trim(),
      value: String(field?.value || ''),
    }))
    .filter((field) => field.key || field.value);
}

export function createChromeResumeStore(storageArea = globalThis.chrome?.storage?.local) {
  if (!storageArea) throw new Error('浏览器本地存储不可用。');
  return {
    async load() {
      const result = await storageArea.get(STORAGE_KEY);
      return normalizeResumeFields(result[STORAGE_KEY]);
    },
    async save(fields) {
      const normalized = normalizeResumeFields(fields);
      await storageArea.set({ [STORAGE_KEY]: normalized });
      return normalized;
    },
  };
}

const styles = `
  .resume-maintain-root{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#17233d}
  .resume-maintain-root[data-open="true"]{pointer-events:auto}
  .resume-maintain-mask{position:absolute;inset:0;background:rgba(15,23,42,.28);opacity:0;transition:opacity .2s}
  .resume-maintain-root[data-open="true"] .resume-maintain-mask{opacity:1}
  .resume-maintain-drawer{position:absolute;right:0;top:0;width:min(520px,100vw);height:100%;box-sizing:border-box;background:#f7f9fd;box-shadow:-10px 0 32px rgba(15,23,42,.18);transform:translateX(105%);transition:transform .25s;display:flex;flex-direction:column}
  .resume-maintain-root[data-open="true"] .resume-maintain-drawer{transform:none}
  .resume-maintain-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #dce3f1;background:#fff}
  .resume-maintain-title{font-size:20px;font-weight:700;margin:0}.resume-maintain-close{border:0;background:transparent;font-size:28px;cursor:pointer;color:#56627a}
  .resume-maintain-body{padding:18px 22px;overflow:auto;flex:1}.resume-maintain-note{font-size:13px;color:#65718a;margin:0 0 14px}
  .resume-maintain-row{display:grid;grid-template-columns:minmax(110px,1fr) minmax(150px,1.5fr) 36px;gap:8px;margin-bottom:10px}
  .resume-maintain-row input{width:100%;box-sizing:border-box;border:1px solid #bdc9df;border-radius:8px;padding:10px 11px;font:inherit;background:#fff}
  .resume-maintain-delete{border:1px solid #e2a8aa;border-radius:8px;color:#b4232a;background:#fff;cursor:pointer;font-size:18px}.resume-maintain-add{border:1px dashed #8099ce;background:#fff;color:#275ac7;border-radius:8px;padding:10px 14px;cursor:pointer;width:100%}
  .resume-maintain-foot{padding:16px 22px 20px;border-top:1px solid #dce3f1;background:#fff}.resume-maintain-status{min-height:20px;font-size:13px;margin-bottom:9px;color:#53617a}.resume-maintain-status[data-kind="error"]{color:#b4232a}.resume-maintain-status[data-kind="success"]{color:#18794e}
  .resume-maintain-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.resume-maintain-actions button{border:0;border-radius:9px;padding:12px;font-weight:700;cursor:pointer}.resume-maintain-save{background:#e8eefb;color:#275ac7}.resume-maintain-fill{background:#2f5dca;color:#fff}.resume-maintain-actions button:disabled{opacity:.55;cursor:wait}
`;

function rowTemplate(field) {
  const row = document.createElement('div');
  row.className = 'resume-maintain-row';
  row.dataset.id = field.id;
  const key = document.createElement('input');
  key.name = 'resume-key'; key.placeholder = '字段名，例如：姓名'; key.value = field.key;
  const value = document.createElement('input');
  value.name = 'resume-value'; value.placeholder = '字段内容'; value.value = field.value;
  const remove = document.createElement('button');
  remove.type = 'button'; remove.className = 'resume-maintain-delete'; remove.textContent = '×'; remove.title = '删除字段';
  row.append(key, value, remove);
  return row;
}

export function mountResumeDrawer({ store = createChromeResumeStore(), onFill = async () => {} } = {}) {
  if (document.querySelector('.resume-maintain-root')) throw new Error('简历维护抽屉已经挂载。');
  const style = document.createElement('style'); style.textContent = styles;
  const root = document.createElement('div'); root.className = 'resume-maintain-root'; root.dataset.open = 'false';
  root.innerHTML = `<div class="resume-maintain-mask"></div><aside class="resume-maintain-drawer" role="dialog" aria-modal="true" aria-label="维护简历信息"><header class="resume-maintain-head"><h2 class="resume-maintain-title">维护简历信息</h2><button class="resume-maintain-close" type="button" aria-label="关闭">×</button></header><main class="resume-maintain-body"><p class="resume-maintain-note">字段仅保存在浏览器本地。请审核后再一键填充当前网页。</p><div class="resume-maintain-fields"></div><button class="resume-maintain-add" type="button">＋ 新增字段</button></main><footer class="resume-maintain-foot"><div class="resume-maintain-status" aria-live="polite"></div><div class="resume-maintain-actions"><button class="resume-maintain-save" type="button">保存</button><button class="resume-maintain-fill" type="button">一键填充简历</button></div></footer></aside>`;
  document.head.append(style); document.body.append(root);
  const fields = root.querySelector('.resume-maintain-fields');
  const status = root.querySelector('.resume-maintain-status');
  const setStatus = (message = '', kind = 'info') => { status.textContent = message; status.dataset.kind = kind; };
  const values = () => normalizeResumeFields([...fields.children].map((row) => ({ id: row.dataset.id, key: row.querySelector('[name="resume-key"]').value, value: row.querySelector('[name="resume-value"]').value })));
  const add = (field = {}) => fields.append(rowTemplate({ id: field.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, key: field.key || '', value: field.value || '' }));
  root.addEventListener('click', async (event) => {
    if (event.target.matches('.resume-maintain-mask,.resume-maintain-close')) root.dataset.open = 'false';
    if (event.target.matches('.resume-maintain-add')) add();
    if (event.target.matches('.resume-maintain-delete')) event.target.closest('.resume-maintain-row').remove();
    if (event.target.matches('.resume-maintain-save')) { try { await store.save(values()); setStatus('已保存，下次打开仍会保留。', 'success'); } catch (error) { setStatus(error.message || '保存失败。', 'error'); } }
    if (event.target.matches('.resume-maintain-fill')) { const button = event.target; button.disabled = true; try { const saved = await store.save(values()); await onFill(saved); setStatus('已提交填充，请检查网页内容。', 'success'); } catch (error) { setStatus(error.message || '填充失败。', 'error'); } finally { button.disabled = false; } }
  });
  return {
    async open() { fields.replaceChildren(); const saved = await store.load(); (saved.length ? saved : [{}]).forEach(add); setStatus(); root.dataset.open = 'true'; },
    close() { root.dataset.open = 'false'; },
    destroy() { root.remove(); style.remove(); },
    getFields: values,
  };
}


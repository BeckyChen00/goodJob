"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Company, Job, deleteCompany, deleteJob, exportData, importData, listCompanies, listJobs, saveCompany, saveJob } from "./storage";

const industries = ["全部", "能源电力", "通信", "金融", "建筑基建", "军工/航天/核工业", "综合产业", "北京市属重点国企", "基建/重工", "互联网民营企业"];
const ownerships = ["央企", "北京市属国企", "其他国企", "互联网民营企业", "其他民营企业"];
const statuses = ["待投递", "已投递", "测评", "笔试", "一面", "二面", "HR面", "Offer", "拒绝", "放弃"];
const emptyCompany: Omit<Company, "id" | "createdAt" | "updatedAt"> = { name: "", shortName: "", ownership: "央企", industry: "能源电力", website: "", recruitmentUrl: "", description: "", applicationLimit: null, deadline: "", notes: "" };
const emptyJob: Omit<Job, "id" | "companyId" | "createdAt" | "updatedAt"> = { title: "", batch: "", location: "", category: "", url: "", jd: "", status: "待投递", appliedAt: "", deadline: "", progress: "", resumeName: "", notes: "" };

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [ownership, setOwnership] = useState("全部");
  const [industry, setIndustry] = useState("全部");
  const [openOwnerships, setOpenOwnerships] = useState<string[]>(["央企"]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [companyModal, setCompanyModal] = useState<Company | null | "new">(null);
  const [jobModal, setJobModal] = useState<{ companyId: string; job?: Job } | null>(null);
  const [toast, setToast] = useState("");

  async function refresh() { setCompanies(await listCompanies()); setJobs(await listJobs()); }
  useEffect(() => { refresh(); }, []);
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }

  const shown = useMemo(() => companies.filter(c => (ownership === "全部" || c.ownership === ownership) && (industry === "全部" || c.industry === industry) && `${c.name}${c.shortName}${c.description}`.toLowerCase().includes(query.toLowerCase())), [companies, ownership, industry, query]);
  const activeJobs = jobs.filter(j => !["待投递", "放弃", "拒绝"].includes(j.status)).length;

  async function removeCompany(company: Company) {
    const count = jobs.filter(j => j.companyId === company.id).length;
    if (confirm(`删除“${company.name}”及其 ${count} 个岗位？此操作不可撤销。`)) { await deleteCompany(company.id); await refresh(); notify("企业已删除"); }
  }
  async function backup() {
    const payload = await exportData();
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.download = `投递记录-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); notify("备份已导出");
  }
  async function restore(file: File) {
    try { await importData(JSON.parse(await file.text())); await refresh(); notify("数据已导入"); } catch { alert("导入失败：请选择由本系统导出的 JSON 文件。"); }
  }

  return <main>
    <header className="topbar"><div className="brand"><span className="mark">投</span><div><strong>求职投递台</strong><small>本地数据 · 仅存于此浏览器</small></div></div><div className="header-actions"><button className="secondary" onClick={backup}>导出备份</button><label className="secondary file">导入 JSON<input type="file" accept="application/json" onChange={e => e.target.files?.[0] && restore(e.target.files[0])}/></label><button className="primary" onClick={() => setCompanyModal("new")}>＋ 新增企业</button></div></header>
    <section className="hero"><div><p className="eyebrow">2027 届求职管理</p><h1>把每一次投递，<br/><em>稳稳地推进。</em></h1><p>统一管理企业、志愿限制、岗位 JD 与面试进度。无需登录，数据自动保存在本机。</p></div><div className="stats"><div><b>{companies.length}</b><span>目标企业</span></div><div><b>{jobs.length}</b><span>岗位记录</span></div><div><b>{activeJobs}</b><span>投递进行中</span></div></div></section>
    <section className="workspace">
      <aside><h3>企业分类</h3><button className={`all-companies ${ownership === "全部" && industry === "全部" ? "active" : ""}`} onClick={() => { setOwnership("全部"); setIndustry("全部"); }}><span>全部企业</span><i>{companies.length}</i></button><div className="nav-divider"/>{ownerships.map(owner => { const ownerCompanies = companies.filter(c => c.ownership === owner); const ownerIndustries = Array.from(new Set(ownerCompanies.map(c => c.industry))).sort((a,b) => a.localeCompare(b,"zh-CN")); const isOpen = openOwnerships.includes(owner); return <div className="nav-group" key={owner}><button className={`nav-parent ${ownership === owner && industry === "全部" ? "active" : ""}`} onClick={() => { setOwnership(owner); setIndustry("全部"); setOpenOwnerships(isOpen ? openOwnerships.filter(x => x !== owner) : [...openOwnerships, owner]); }}><span><b className="nav-arrow">{isOpen ? "⌄" : "›"}</b>{owner}</span><i>{ownerCompanies.length}</i></button>{isOpen && <div className="nav-children">{ownerIndustries.map(item => <button key={item} className={ownership === owner && industry === item ? "active" : ""} onClick={() => { setOwnership(owner); setIndustry(item); }}><span>{item}</span><i>{ownerCompanies.filter(c => c.industry === item).length}</i></button>)}{ownerIndustries.length === 0 && <small>暂无企业</small>}</div>}</div>})}</aside>
      <div className="content"><div className="toolbar"><div className="search">⌕<input aria-label="搜索企业" placeholder="搜索企业、简称或描述…" value={query} onChange={e => setQuery(e.target.value)}/></div><span>共 {shown.length} 家企业</span></div>
        <div className="company-list">{shown.map(company => { const ownJobs = jobs.filter(j => j.companyId === company.id); const used = ownJobs.filter(j => !["待投递", "放弃", "拒绝"].includes(j.status)).length; const isOpen = expanded.includes(company.id); return <article key={company.id} className="company-card">
          <div className="company-row" onClick={() => setExpanded(isOpen ? expanded.filter(x => x !== company.id) : [...expanded, company.id])}><button className="chevron" aria-label="展开岗位">{isOpen ? "⌄" : "›"}</button><div className="avatar">{company.shortName?.slice(0, 2) || company.name.slice(0, 2)}</div><div className="company-main"><div><h2>{company.name}</h2><span className={`badge ${company.ownership.includes("民营") ? "private" : "state"}`}>{company.ownership}</span></div><p>{company.description || "暂无企业描述"}</p></div><div className="meta"><span>{company.industry}</span><b>{company.applicationLimit == null ? "志愿不限/未知" : `已投 ${used} / ${company.applicationLimit}`}</b></div><div className="row-actions" onClick={e => e.stopPropagation()}><a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank">官网 ↗</a><button onClick={() => setCompanyModal(company)}>编辑</button><button className="danger" onClick={() => removeCompany(company)}>删除</button></div></div>
          {isOpen && <div className="jobs"><div className="jobs-head"><div><b>投递岗位</b><span>{ownJobs.length} 条记录</span></div><button onClick={() => setJobModal({ companyId: company.id })}>＋ 新增岗位</button></div>{ownJobs.length === 0 ? <div className="empty">还没有岗位记录，点击右上角新增第一条。</div> : <div className="job-table"><div className="job-tr job-th"><span>岗位 / 批次</span><span>地点</span><span>状态</span><span>截止日期</span><span>简历</span><span>操作</span></div>{ownJobs.map(job => <div className="job-tr" key={job.id}><span><b>{job.title}</b><small>{job.batch || "未填写批次"}</small></span><span>{job.location || "—"}</span><span><i className={`status s-${statuses.indexOf(job.status)}`}>{job.status}</i></span><span>{job.deadline || "—"}</span><span>{job.resumeName || "—"}</span><span className="job-actions">{job.url && <a target="_blank" href={job.url}>JD ↗</a>}<button onClick={() => setJobModal({ companyId: company.id, job })}>编辑</button><button onClick={async () => { if (confirm("删除该岗位记录？")) { await deleteJob(job.id); refresh(); } }}>删除</button></span></div>)}</div>}</div>}
        </article>})}{shown.length === 0 && <div className="no-result">没有找到匹配的企业。</div>}</div>
      </div>
    </section>
    {companyModal && <CompanyDialog value={companyModal === "new" ? undefined : companyModal} onClose={() => setCompanyModal(null)} onSave={async value => { await saveCompany(value); setCompanyModal(null); await refresh(); notify("企业已保存"); }}/>} 
    {jobModal && <JobDialog value={jobModal.job} companyId={jobModal.companyId} onClose={() => setJobModal(null)} onSave={async value => { await saveJob(value); setJobModal(null); await refresh(); notify("岗位已保存"); }}/>} 
    {toast && <div className="toast">✓ {toast}</div>}
  </main>;
}

function CompanyDialog({ value, onClose, onSave }: { value?: Company; onClose: () => void; onSave: (v: Company) => void }) {
  const [form, setForm] = useState<any>(value || emptyCompany); const update = (k: string, v: any) => setForm({ ...form, [k]: v });
  function submit(e: FormEvent) { e.preventDefault(); onSave({ ...form, applicationLimit: form.applicationLimit === "" ? null : Number(form.applicationLimit) }); }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">企业父条目</p><h2>{value ? "编辑企业" : "新增企业"}</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><Field label="企业全称 *"><input required value={form.name} onChange={e => update("name", e.target.value)}/></Field><Field label="企业简称"><input value={form.shortName} onChange={e => update("shortName", e.target.value)}/></Field><Field label="企业性质"><select value={form.ownership} onChange={e => update("ownership", e.target.value)}><option>央企</option><option>北京市属国企</option><option>其他国企</option><option>互联网民营企业</option><option>其他民营企业</option></select></Field><Field label="行业分类"><select value={form.industry} onChange={e => update("industry", e.target.value)}>{industries.slice(1).map(x => <option key={x}>{x}</option>)}</select></Field><Field label="集团官网 *"><input required placeholder="https://" value={form.website} onChange={e => update("website", e.target.value)}/></Field><Field label="招聘官网"><input placeholder="https://" value={form.recruitmentUrl} onChange={e => update("recruitmentUrl", e.target.value)}/></Field><Field label="志愿投递限制"><input type="number" min="0" placeholder="未知时留空" value={form.applicationLimit ?? ""} onChange={e => update("applicationLimit", e.target.value)}/></Field><Field label="整体截止日期"><input type="date" value={form.deadline} onChange={e => update("deadline", e.target.value)}/></Field><Field label="企业描述" wide><textarea rows={3} value={form.description} onChange={e => update("description", e.target.value)}/></Field><Field label="其他备注" wide><textarea rows={2} value={form.notes} onChange={e => update("notes", e.target.value)}/></Field></div><div className="modal-foot"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary">保存企业</button></div></form></div>;
}

function JobDialog({ value, companyId, onClose, onSave }: { value?: Job; companyId: string; onClose: () => void; onSave: (v: Job) => void }) {
  const [form, setForm] = useState<any>(value || emptyJob); const update = (k: string, v: any) => setForm({ ...form, [k]: v });
  function submit(e: FormEvent) { e.preventDefault(); onSave({ ...form, companyId }); }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="modal wide-modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">岗位子条目</p><h2>{value ? "编辑投递岗位" : "新增投递岗位"}</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><Field label="岗位名称 *"><input required value={form.title} onChange={e => update("title", e.target.value)}/></Field><Field label="招聘批次"><input placeholder="例如：2027 届秋招" value={form.batch} onChange={e => update("batch", e.target.value)}/></Field><Field label="工作地点"><input value={form.location} onChange={e => update("location", e.target.value)}/></Field><Field label="岗位类别"><input placeholder="研发 / 测试 / 产品" value={form.category} onChange={e => update("category", e.target.value)}/></Field><Field label="投递状态"><select value={form.status} onChange={e => update("status", e.target.value)}>{statuses.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="投递日期"><input type="date" value={form.appliedAt} onChange={e => update("appliedAt", e.target.value)}/></Field><Field label="岗位截止日期"><input type="date" value={form.deadline} onChange={e => update("deadline", e.target.value)}/></Field><Field label="简历附件/版本"><input placeholder="例如：后端开发-v3.pdf" value={form.resumeName} onChange={e => update("resumeName", e.target.value)}/></Field><Field label="岗位官网链接" wide><input type="url" placeholder="https://" value={form.url} onChange={e => update("url", e.target.value)}/></Field><Field label="当前面试进度" wide><input placeholder="例如：8 月 20 日完成一面，等待结果" value={form.progress} onChange={e => update("progress", e.target.value)}/></Field><Field label="JD" wide><textarea rows={7} value={form.jd} onChange={e => update("jd", e.target.value)}/></Field><Field label="其他备注" wide><textarea rows={3} value={form.notes} onChange={e => update("notes", e.target.value)}/></Field></div><div className="modal-foot"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary">保存岗位</button></div></form></div>;
}
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "wide" : ""}><span>{label}</span>{children}</label>; }

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast, rupiah, fmtDate, fmtDateTime, Sheet, Menu, FileDrop, CountUp, Select } from '../../components/ui';
import AppTable from '../../components/AppTable';
import ApplicationView from '../../components/ApplicationView';

const BIDANG = { SP: 'Sertifikasi Produk', LAB: 'Lab Pengujian', KAL: 'Lab Kalibrasi' };
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Jenis tindakan PSU untuk satu pengajuan di dashboard: [label, warna pill, tombol]. */
function needOf(a) {
  if (a.ext_requests > 0) return ['Perpanjangan temuan', 'pill-progress', 'Tinjau'];
  if (a.findings_review > 0) return ['Bukti perbaikan', 'pill-progress', 'Tinjau'];
  if (a.payment_status === 'menunggu') return ['Bukti bayar masuk', 'pill-action', 'Verifikasi'];
  if (a.payment_status === 'belum' && ['ST-03', 'LAB-02', 'KAL-02'].includes(a.current_step.code)) return ['Invoice belum terbit', 'pill-action', 'Terbitkan invoice'];
  return ['Pengajuan baru', 'pill-neutral', 'Periksa'];
}

export function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [months, setMonths] = useState(6);
  useEffect(() => { api.get(`/admin/dashboard?months=${months}`).then((r) => setD(r.data)); }, [months]);
  if (!d) return <Loading />;
  const s = d.stats;
  const maxSvc = Math.max(1, ...d.per_service.map((x) => +x.total));
  const keys = [];
  for (let i = d.months - 1; i >= 0; i--) { const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth() - i, 1); keys.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`); }
  const vals = keys.map((m) => +(d.per_month.find((x) => x.ym === m)?.total || 0));
  const maxM = Math.max(1, ...vals);
  const groups = Object.entries(s.per_group).map(([k, v]) => `${k} ${v}`).join(' · ');
  const kpis = [
    ['Pengajuan berjalan', <CountUp value={s.running} />, groups || 'belum ada', 'var(--navy)'],
    ['Perlu tindakan PSU', <CountUp value={d.need_action.length} />, 'invoice, verifikasi, pengajuan baru', 'var(--warn)'],
    ['Temuan terbuka', <CountUp value={s.findings_open} />, s.findings_nearest ? `tenggat terdekat ${fmtDate(s.findings_nearest)}` : 'tidak ada tenggat aktif', 'var(--navy)'],
    ['Kepuasan pelanggan', s.survey_avg === null ? '—' : <>{String(s.survey_avg).replace('.', ',')}<small className="kpi-of"> / 5</small></>, s.survey_n ? `dari ${s.survey_n} responden` : 'belum ada responden', 'var(--navy)'],
  ];
  return (
    <>
      <PageHead eyebrow={user.role === 'superadmin' ? 'Semua bidang' : BIDANG[user.bidang]} title="Ringkasan layanan">
        <label className="d-flex align-items-center gap-2 small text-muted2 mb-0" htmlFor="per">Periode
          <Select id="per" className="form-select" style={{ width: 'auto' }} value={months} onChange={(e) => setMonths(+e.target.value)}><option value={6}>6 bulan terakhir</option><option value={12}>12 bulan terakhir</option></Select>
        </label>
      </PageHead>
      <div className="row g-3 mb-4">
        {kpis.map(([k, v, sub, c]) => (
          <div className="col-6 col-lg-3" key={k}><div className="stat"><div className="k">{k}</div><div className="v num" style={{ color: c }}>{v}</div><div className="s">{sub}</div></div></div>
        ))}
      </div>
      <section className="panel mb-4">
        <div className="panel-h"><h2 className="mb-0">Perlu tindakan sekarang</h2><Link to="/admin/antrean" className="small fw-semibold">Buka antrean</Link></div>
        <div className="todo-list">
          {d.need_action.length ? d.need_action.map((a) => {
            const [t, cls, btn] = needOf(a);
            return (
              <Link key={a.id} to={`/admin/pengajuan/${a.id}`} className="todo-item need-row">
                <span className={`pill ${cls} need-pill`}>{t}</span>
                <span className="tx"><b>{a.company_name} <span className="fw-normal">· {a.product_label.split(' · ')[0]}</span></b><span><span className="mono">{a.application_no}</span> · {a.current_step.code}</span></span>
                <span className="btn btn-outline-secondary btn-sm hide-sm">{btn}</span>
              </Link>
            );
          }) : <p className="text-muted2 text-center py-4 mb-0">Tidak ada yang perlu ditindaklanjuti.</p>}
        </div>
      </section>
      <div className="row g-3">
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Pengajuan per layanan</h2></div>
            <div className="panel-b hbar">
              {d.per_service.map((x) => (<Fragment key={x.code}><span>{x.name.replace('Laboratorium', 'Lab')}</span><span className="track"><i style={{ width: `${(x.total / maxSvc) * 100}%` }} /></span><b className="text-end num">{x.total}</b></Fragment>))}
            </div>
          </section>
        </div>
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Pengajuan masuk per bulan</h2><span className="small text-muted2">{MONTH[+keys[0].slice(5) - 1]} – {MONTH[+keys[keys.length - 1].slice(5) - 1]} {keys[keys.length - 1].slice(0, 4)}</span></div>
            <div className="panel-b">
              <div className="d-grid align-items-end gap-3 border-bottom pb-1" style={{ gridTemplateColumns: `repeat(${keys.length},minmax(0,1fr))`, height: 150, gap: keys.length > 6 ? 8 : 16 }}>
                {vals.map((v, i) => <div key={keys[i]} className="vbar" title={`${v} pengajuan`} style={{ animationDelay: `${i * 0.05}s`,  height: `${Math.max(3, (v / maxM) * 100)}%`, background: i === vals.length - 1 ? 'var(--navy)' : '#CBD5E3', borderRadius: '4px 4px 0 0' }} />)}
              </div>
              <div className="d-grid small text-muted2 text-center mt-1" style={{ gridTemplateColumns: `repeat(${keys.length},minmax(0,1fr))`, gap: keys.length > 6 ? 8 : 16 }}>
                {keys.map((m, i) => <span key={m} className={i === keys.length - 1 ? 'fw-bold text-body' : ''}>{MONTH[+m.slice(5) - 1]} · {vals[i]}</span>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export function Antrean() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => api.get('/admin/applications', { params: { status: status || undefined, q: q || undefined } }).then((r) => setRows(r.data)), 250);
    return () => clearTimeout(t);
  }, [status, q]);
  return (
    <>
      <PageHead eyebrow={`Antrean · ${user.role === 'superadmin' ? 'semua bidang' : BIDANG[user.bidang]}`} title={user.role === 'superadmin' ? 'Semua pengajuan masuk' : 'Pengajuan di bidang Anda'}
        sub={user.role === 'superadmin' ? 'Super Admin melihat semua bidang.' : 'Admin hanya melihat pengajuan sesuai bidangnya.'} />
      <section className="panel">
        <div className="panel-h">
          <input className="form-control search-input" placeholder="Cari no. pengajuan / perusahaan / produk" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="form-select" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter kondisi">
            <option value="">Semua kondisi</option><option value="aktif">On Progress</option><option value="aksi">Action Required</option><option value="ditolak">Closed</option><option value="selesai">Selesai</option>
          </Select>
        </div>
        {rows ? <AppTable rows={rows} base="/admin/pengajuan" showCompany /> : <Loading />}
      </section>
    </>
  );
}

/* ===================== Detail pengajuan (Admin) ===================== */

/** Form invoice: SP & Kalibrasi nominal kesepakatan; Lab dihitung dari daftar harga. */
function InvoiceForm({ app, onSaved }) {
  const toast = useToast();
  const isLab = !['SP', 'KAL'].includes(app.service_code);
  const prev = app.payment?.status === 'invoice' ? app.payment : null;
  const [f, setF] = useState({ amount: prev && !isLab ? String(prev.amount) : '', due_date: prev?.due_date || '', note: prev?.note || '' });
  const custom = app.parameters.filter((p) => p.is_custom);
  const [cp, setCp] = useState(Object.fromEntries(custom.map((p) => [p.id, p.price ?? ''])));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const qty = app.samples.reduce((t, s) => t + (+s.quantity || 0), 0) || 1;
  const listed = app.parameters.filter((p) => !p.is_custom);
  const preview = isLab ? (app.full_sni ? null : listed.reduce((t, p) => t + (+p.price || 0), 0) * qty) + custom.reduce((t, p) => t + (+cp[p.id] || 0), 0) * qty + (+f.amount || 0) : +f.amount || 0;
  const save = async () => {
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    fd.append('custom_prices', JSON.stringify(cp));
    if (file) fd.append('invoice_file', file);
    setBusy(true);
    try { onSaved((await api.post(`/admin/applications/${app.id}/invoice`, fd)).data); toast(prev ? 'Invoice diperbarui.' : 'Invoice terbit dan dikirim ke pelanggan.'); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <div className="d-flex flex-column gap-2">
      <span className="small text-muted2">Harga sudah termasuk PPN 11%.</span>
      {isLab ? (
        <>
          <div className="small">{app.full_sni ? 'Paket parameter lengkap sesuai SNI (harga paket dari daftar harga)' : `${listed.length} parameter dari daftar harga`} × {qty} sampel{!app.full_sni && <> = <b className="num">{rupiah(listed.reduce((t, p) => t + (+p.price || 0), 0) * qty)}</b></>}</div>
          {custom.map((p) => (
            <div key={p.id} className="input-group input-group-sm">
              <span className="input-group-text text-truncate" style={{ maxWidth: '60%' }} title={p.name}>Lainnya: {p.name}</span>
              <input type="number" min={0} className="form-control" aria-label={`Harga ${p.name}`} placeholder="Harga per sampel" value={cp[p.id]} onChange={(e) => setCp({ ...cp, [p.id]: e.target.value })} />
            </div>
          ))}
          <label className="form-label mb-0 small" htmlFor="ia">Biaya tambahan (opsional)</label>
        </>
      ) : <label className="form-label mb-0 small" htmlFor="ia">Nominal invoice (hasil kesepakatan, termasuk PPN)</label>}
      <input id="ia" type="number" min={0} className="form-control form-control-sm" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      {!(isLab && app.full_sni) && <div className="small">Total: <b className="num">{rupiah(preview)}</b></div>}
      <div className="row g-2">
        <div className="col-6"><label className="form-label mb-0 small" htmlFor="idd">Batas bayar</label><input id="idd" type="date" className="form-control form-control-sm" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
        <div className="col-6"><label className="form-label mb-0 small" htmlFor="iff">File invoice (PDF)</label><input id="iff" type="file" accept=".pdf" className="form-control form-control-sm" onChange={(e) => setFile(e.target.files[0])} /></div>
      </div>
      <input className="form-control form-control-sm" placeholder="Catatan (mis. nomor rekening, termin)" aria-label="Catatan invoice" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className="btn btn-primary mt-1" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : prev ? 'Simpan perubahan invoice' : 'Terbitkan & kirim ke pelanggan'}</button>
    </div>
  );
}

/** Input laporan audit + temuan (SP, ST-05 s.d. ST-07) — dibuka sebagai pop-up. */
function FindingsAdd({ app, onSaved }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(app.audit_report_date || new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([{ category: 'minor', description: '', due_date: '' }]);
  const [busy, setBusy] = useState(false);
  const add = (m) => { const d = new Date(`${date}T00:00:00`); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
  const auto = (c) => (c === 'mayor' ? add(1) : c === 'minor' ? add(2) : '');
  const set = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    if (items.some((x) => !x.description.trim())) return toast('Isi uraian setiap temuan.', 'danger');
    setBusy(true);
    try {
      const r = await api.post(`/admin/applications/${app.id}/findings`, { report_date: date, items: items.map((x) => ({ ...x, due_date: x.due_date || undefined })) });
      onSaved(r.data); setOpen(false); setItems([{ category: 'minor', description: '', due_date: '' }]); toast('Temuan dicatat dan dikirim ke pelanggan.');
    } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn btn-outline-secondary btn-sm" onClick={() => setOpen(true)}><i className="bi bi-plus-lg" />Input temuan audit</button>
      <Sheet open={open} onClose={() => setOpen(false)} wide icon="clipboard-plus" title="Input temuan audit" sub="Tenggat otomatis: mayor 1 bulan, minor 2 bulan sejak tanggal laporan. Bisa diubah."
        footer={<><button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan & kirim ke pelanggan'}</button></>}>
        <div className="d-flex flex-column gap-3">
          <div><label className="form-label" htmlFor="ard">Tanggal laporan audit</label><input id="ard" type="date" className="form-control" style={{ maxWidth: 200 }} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {items.map((it, i) => (
            <div key={i} className="f-row">
              <div className="d-flex gap-2 flex-wrap">
                <Select className="form-select" style={{ maxWidth: 150 }} aria-label="Kategori" value={it.category} onChange={(e) => set(i, 'category', e.target.value)}><option value="mayor">Mayor</option><option value="minor">Minor</option><option value="observasi">Observasi</option></Select>
                {it.category !== 'observasi'
                  ? <input type="date" className="form-control" style={{ maxWidth: 180 }} aria-label="Tenggat" title="Tenggat (otomatis, bisa diubah)" value={it.due_date || auto(it.category)} onChange={(e) => set(i, 'due_date', e.target.value)} />
                  : <span className="small text-muted2 align-self-center">tanpa tenggat</span>}
                {items.length > 1 && <button type="button" className="btn btn-link text-danger ms-auto" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Hapus baris"><i className="bi bi-trash" /></button>}
              </div>
              <textarea rows={2} className="form-control mt-2" placeholder="Uraian temuan" aria-label="Uraian temuan" value={it.description} onChange={(e) => set(i, 'description', e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn btn-outline-secondary btn-sm align-self-start" onClick={() => setItems([...items, { category: 'minor', description: '', due_date: '' }])}><i className="bi bi-plus-lg" />Tambah baris</button>
        </div>
      </Sheet>
    </>
  );
}

/** Tinjau satu temuan: tutup, minta ulang, ubah tenggat, keputusan perpanjangan. */
function FindingReview({ f, app, onChange, onClose, onDownloadDoc }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [due, setDue] = useState(f?.due_date || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(''); setDue(f?.due_date || ''); }, [f]);
  const run = async (op, extra = {}) => {
    if (op === 'ulang' && !note.trim()) return toast('Tulis perbaikan apa yang masih diperlukan.', 'danger');
    setBusy(true);
    try { onChange((await api.patch(`/admin/applications/${app.id}/findings/${f.id}`, { op, note, ...extra })).data); onClose(); toast('Temuan diperbarui.'); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!f} onClose={onClose} icon="search" title={f ? `Tinjau temuan ${f.category} #${f.id}` : ''}
      footer={f && <>
        {f.status === 'dikirim' && <button className="btn btn-outline-warning" disabled={busy} onClick={() => run('ulang')}>Minta perbaikan ulang</button>}
        <button className="btn btn-primary" disabled={busy} onClick={() => run('tutup')}><i className="bi bi-check2" />Tutup temuan</button>
      </>}>
      {f && (
        <div className="d-flex flex-column gap-3">
          <div className="f-quote">{f.description}</div>
          {(f.customer_note || f.files?.length > 0) && (
            <div><div className="eyebrow mb-1">Tanggapan pelanggan</div>
              {f.customer_note && <div className="small">{f.customer_note}</div>}
              {f.files?.map((d) => <button key={d.id} type="button" className="file-chip" onClick={() => onDownloadDoc(d)}><i className="bi bi-paperclip" />{d.original_name}</button>)}
            </div>
          )}
          {f.status === 'terbuka' && !f.customer_note && <div className="small text-muted2">Pelanggan belum mengirim bukti perbaikan.</div>}
          {f.extension_status === 'diajukan' && (
            <div className="decision-item">
              <div className="small"><b>Perpanjangan 1 bulan diajukan.</b>{f.extension_reason && <> Alasan: "{f.extension_reason}"</>}</div>
              <div className="d-flex gap-2 mt-2"><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run('perpanjang_setuju')}>Setujui perpanjangan</button><button className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => run('perpanjang_tolak')}>Tolak</button></div>
            </div>
          )}
          {f.category !== 'observasi' && (
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div><label className="form-label" htmlFor={`due${f.id}`}>Tenggat</label><input id={`due${f.id}`} type="date" className="form-control" value={due} onChange={(e) => setDue(e.target.value)} /></div>
              <button className="btn btn-outline-secondary" disabled={busy || due === f.due_date} onClick={() => run('ubah', { due_date: due })}>Simpan tenggat</button>
            </div>
          )}
          <div><label className="form-label" htmlFor="fr-note">Catatan untuk pelanggan <span className="fw-normal text-muted2">(wajib untuk minta perbaikan ulang)</span></label><textarea id="fr-note" className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
      )}
    </Sheet>
  );
}

/** Info pengujian lab untuk Sertifikasi Produk (ST-06): panel di kolom utama. */
function LabInfoForm({ app, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ lab_name: app.lab_info?.name || 'Laboratorium Pengujian PSU', lab_estimate: app.lab_info?.estimate || '', lab_link: app.lab_info?.link || '' });
  const [files, setFiles] = useState([]);
  const [k, setK] = useState(0);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const fd = new FormData(); Object.entries(f).forEach(([key, v]) => fd.append(key, v)); [...files].forEach((x) => fd.append('lhu', x));
    setBusy(true);
    try { onSaved((await api.post(`/admin/applications/${app.id}/lab-info`, fd)).data); setFiles([]); setK(k + 1); toast('Info pengujian lab diperbarui dan tampil ke pelanggan.'); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  const lhu = app.documents.filter((d) => d.doc_type === 'Laporan Hasil Uji (LHU)');
  return (
    <section className="panel">
      <div className="panel-h"><h2 className="mb-0">Info pengujian laboratorium</h2><span className="small text-muted2">tampil ke pelanggan</span></div>
      <div className="panel-b d-flex flex-column gap-3">
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label" htmlFor="li-n">Laboratorium</label><input id="li-n" className="form-control" value={f.lab_name} onChange={(e) => setF({ ...f, lab_name: e.target.value })} placeholder="PSU / lab lain" /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="li-e">Estimasi selesai</label><input id="li-e" className="form-control" value={f.lab_estimate} onChange={(e) => setF({ ...f, lab_estimate: e.target.value })} placeholder="mis. 10 hari kerja" /></div>
          <div className="col-12"><label className="form-label" htmlFor="li-l">Tautan LHU <span className="fw-normal text-muted2">(opsional)</span></label><input id="li-l" className="form-control" value={f.lab_link} onChange={(e) => setF({ ...f, lab_link: e.target.value })} placeholder="https://…" /></div>
        </div>
        <FileDrop key={k} id="lhu" multiple files={files} onChange={setFiles} label="Unggah LHU" hint="atau tempel tautan hasil lab di atas · PDF, maks. 10 MB" />
        {lhu.length > 0 && <div>{lhu.map((d) => <span key={d.id} className="file-chip"><i className="bi bi-paperclip" />{d.original_name}</span>)}</div>}
        <button className="btn btn-outline-primary align-self-start" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan info lab'}</button>
      </div>
    </section>
  );
}

const ACT = {
  setujui: { icon: 'check2-circle', ok: 'Ya, setujui' },
  minta_tindakan: { icon: 'arrow-return-left', title: 'Minta tindakan pelanggan', ok: 'Kirim permintaan' },
  abaikan: { icon: 'chat-left-text', title: 'Kirim catatan / lampiran', ok: 'Kirim' },
  tolak: { icon: 'x-octagon', title: 'Tolak & tutup pengajuan', ok: 'Ya, tutup pengajuan', danger: true },
};

export function AdminDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState(null);
  const [f, setF] = useState({ note: '', internal: false, certificate_no: '', doc_name: '' });
  const [certFile, setCertFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [payNote, setPayNote] = useState('');
  const [review, setReview] = useState(null);
  const [invOpen, setInvOpen] = useState(false);
  const [tab, setTab] = useState('ringkasan');
  const load = useCallback(() => api.get(`/admin/applications/${id}`).then((r) => setApp(r.data)).catch((e) => setErr(errMsg(e))), [id]);
  useEffect(() => { load(); }, [load]);
  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!app) return <Loading />;

  const st = app.current_step;
  const open = ['aktif', 'aksi'].includes(app.status);
  const isSA = user.role === 'superadmin';
  const payBlocked = st.is_payment_step && app.payment_status !== 'terverifikasi' && app.payment_status !== 'menunggu';
  const paramsOpen = app.parameters.some((p) => p.status !== 'selesai') && st.code === 'LAB-05';
  const findingsOpen = st.code === 'ST-07' && app.open_findings > 0;
  const blocked = payBlocked || paramsOpen || findingsOpen;
  const blockReason = payBlocked ? 'Terbitkan invoice dan tunggu bukti bayar pelanggan.' : paramsOpen ? 'Masih ada parameter yang belum selesai.' : findingsOpen ? `Masih ada ${app.open_findings} temuan mayor/minor terbuka.` : '';
  const findingStage = app.service_code === 'SP' && ['ST-05', 'ST-06', 'ST-07'].includes(st.code) && open;
  const docWord = ['SP', 'KAL'].includes(app.service_code) ? 'sertifikat' : 'LHU';
  const curIdx = app.steps.findIndex((s) => ['current', 'action'].includes(s.state));
  // tahap berikutnya setelah Setujui (ST-07 dilewati jika tanpa temuan terbuka, KAL-09 jika on-site)
  const skip = (x) => x.optional && ((app.service_code === 'SP' && !app.open_findings) || (app.service_code === 'KAL' && app.location === 'onsite'));
  const next = app.steps.slice(curIdx + 1).find((x) => x.state === 'todo' && !skip(x));
  const hasFiles = app.documents.length + (app.payment?.has_proof ? 1 : 0) > 0;

  const reset = () => { setF({ note: '', internal: false, certificate_no: '', doc_name: '' }); setCertFile(null); setFiles([]); };
  const act = async () => {
    const action = mode;
    if ((action === 'minta_tindakan' || action === 'tolak') && !f.note.trim()) return toast(action === 'tolak' ? 'Isi alasan penolakan dulu.' : 'Isi tindakan yang diminta dulu.', 'danger');
    if (action === 'abaikan' && !f.note.trim() && !files.length) return toast('Isi catatan atau pilih lampiran.', 'danger');
    const fd = new FormData();
    fd.append('action', action); fd.append('note', f.note); fd.append('internal', f.internal ? '1' : '0'); fd.append('doc_name', f.doc_name);
    if (f.certificate_no) fd.append('certificate_no', f.certificate_no);
    if (certFile) fd.append('certificate', certFile);
    [...files].forEach((x) => fd.append('attachments', x));
    setBusy(true);
    try {
      const r = await api.post(`/admin/applications/${id}/action`, fd);
      setApp(r.data); setMode(null); reset();
      toast({ setujui: 'Tahap disetujui.', minta_tindakan: 'Status menjadi Action Required. Email dikirim ke pelanggan.', abaikan: 'Catatan/lampiran terkirim, status tidak berubah.', tolak: 'Pengajuan ditutup.' }[action]);
    } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  const onParam = async (pid, status) => {
    try { setApp((await api.patch(`/admin/applications/${id}/parameters/${pid}`, { status })).data); } catch (e) { toast(errMsg(e), 'danger'); }
  };
  const verify = async (valid) => {
    if (!valid && !payNote.trim()) return toast('Isi alasan bukti bayar ditolak.', 'danger');
    try { setApp((await api.post(`/admin/applications/${id}/payment/verify`, { valid, note: payNote })).data); setPayNote(''); toast(valid ? 'Pembayaran terverifikasi.' : 'Pelanggan diminta mengunggah ulang bukti bayar.'); } catch (e) { toast(errMsg(e), 'danger'); }
  };
  const zip = async () => {
    try { await download(`/admin/applications/${id}/documents-zip`, `berkas-${app.application_no}.zip`); await load(); toast('Semua berkas diunduh.'); } catch (e) { toast(errMsg(e), 'danger'); }
  };
  const extFindings = app.findings.filter((x) => x.extension_status === 'diajukan' && x.status !== 'ditutup');
  const sentFindings = app.findings.filter((x) => x.status === 'dikirim');
  const setFinding = async (fd, op) => {
    try { setApp((await api.patch(`/admin/applications/${id}/findings/${fd.id}`, { op })).data); toast('Temuan diperbarui.'); } catch (e) { toast(errMsg(e), 'danger'); }
  };

  /* --- tombol aksi di kepala halaman --- */
  const more = (
    <Menu items={[
      { label: 'Kirim catatan / lampiran', icon: 'chat-left-text', onClick: () => setMode('abaikan'), hidden: !open },
      { label: 'Unduh semua berkas (ZIP)', icon: 'file-zip', onClick: zip, hidden: !isSA || !hasFiles },
      { label: `Unduh ${docWord}`, icon: 'download', onClick: () => download(`/admin/applications/${id}/certificate`, `${app.certificate.certificate_no}.pdf`), hidden: !app.certificate?.has_file },
      { label: 'Tolak & tutup pengajuan', icon: 'x-octagon', onClick: () => setMode('tolak'), danger: true, hidden: !open },
    ]} />
  );
  const headerActions = open ? (
    <>
      {more}
      <button className="btn btn-outline-secondary" disabled={busy} onClick={() => setMode('minta_tindakan')}>Minta tindakan</button>
      <span title={blocked ? blockReason : undefined}><button className="btn btn-primary" disabled={busy || blocked} onClick={() => setMode('setujui')}>{st.is_certificate_step ? `Setujui & terbitkan` : `Setujui ${st.code}`}</button></span>
    </>
  ) : more;

  /* --- kartu "Perlu keputusan Anda" --- */
  const items = [];
  if (app.status === 'aksi') items.push(<div key="aksi" className="decision-item info"><b>Menunggu pelanggan.</b> {app.action_note}</div>);
  extFindings.forEach((x) => items.push(
    <div key={`ext${x.id}`} className="decision-item">
      <div>Perpanjangan temuan {x.category} #{x.id} diajukan pelanggan.{x.extension_reason && <> "{x.extension_reason}"</>} Tenggat baru jika disetujui: <b>{fmtDate((() => { const d = new Date(`${x.due_date}T00:00:00`); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })())}</b>.</div>
      <div className="d-flex gap-2 mt-2"><button className="btn btn-sm btn-primary" onClick={() => setFinding(x, 'perpanjang_setuju')}>Setujui</button><button className="btn btn-sm btn-outline-secondary" onClick={() => setReview(x)}>Tolak…</button></div>
    </div>,
  ));
  sentFindings.forEach((x) => items.push(
    <div key={`sent${x.id}`} className="decision-item">
      <div>Bukti perbaikan temuan {x.category} #{x.id} sudah dikirim pelanggan.</div>
      <button className="btn btn-sm btn-primary mt-2" onClick={() => setReview(x)}>Tinjau bukti</button>
    </div>,
  ));
  if (open && st.is_payment_step && ['belum', 'invoice'].includes(app.payment_status)) items.push(
    <div key="inv" className="decision-item">
      <div>{app.payment_status === 'belum' ? 'Invoice belum diterbitkan.' : `Invoice terbit, menunggu pelanggan membayar${app.payment?.due_date ? ` (jatuh tempo ${fmtDate(app.payment.due_date)})` : ''}.`}</div>
      <button className={`btn btn-sm mt-2 ${app.payment_status === 'belum' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setInvOpen(true)}>{app.payment_status === 'belum' ? 'Terbitkan invoice' : 'Perbarui invoice'}</button>
    </div>,
  );
  if (open && app.payment_status === 'menunggu') items.push(
    <div key="pay" className="decision-item">
      <div>Pelanggan mengunggah bukti bayar.</div>
      <button className="btn btn-link btn-sm p-0 mt-1" style={{ minHeight: 0 }} onClick={() => download(`/admin/applications/${id}/payment-proof`, `bukti-bayar-${app.application_no}`)}><i className="bi bi-eye me-1" />Lihat bukti bayar</button>
      <input className="form-control form-control-sm mt-2" placeholder="Alasan jika ditolak" aria-label="Catatan verifikasi" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
      <div className="d-flex gap-2 mt-2"><button className="btn btn-sm btn-primary" onClick={() => verify(true)}>Verifikasi</button><button className="btn btn-sm btn-outline-secondary" onClick={() => verify(false)}>Tolak bukti</button></div>
    </div>,
  );
  if (open && app.service_code === 'SP' && st.code === 'ST-03') items.push(
    <div key="st03" className="decision-item info">
      ST-03 selesai otomatis jika pembayaran terverifikasi <b>dan</b> semua berkas sudah diunduh Super Admin ({app.all_docs_downloaded ? `sudah diunduh ${fmtDateTime(app.docs_downloaded_at)}` : app.docs_downloaded_at ? 'ada berkas baru sejak unduhan terakhir' : 'belum diunduh'}).
      {isSA && hasFiles && <button className="btn btn-sm btn-outline-secondary mt-2 d-flex" onClick={zip}><i className="bi bi-file-zip" />Unduh semua berkas (ZIP)</button>}
    </div>,
  );
  if (app.is_package && open && ['ST-01', 'ST-02'].includes(st.code)) items.push(<div key="pkg" className="decision-item info">Paket LSPro + Lab: unggah <b>surat permohonan</b> lewat "Lainnya → Kirim catatan / lampiran" dengan nama dokumen "Surat permohonan".</div>);
  if (open && blocked && !items.length) items.push(<div key="blk" className="decision-item info">{blockReason}</div>);
  if (!open && app.status === 'selesai') items.push(<div key="done" className="decision-item info">Pengajuan selesai. Survei kepuasan: <b>{app.survey_done ? 'sudah diisi' : 'belum diisi pelanggan'}</b>.</div>);
  const decision = items.length ? {
    title: open ? 'Perlu keputusan Anda' : 'Status',
    body: <div className="d-flex flex-column gap-2">{items}<div className="small text-muted2 mt-1">PIC tercatat: <b>{isSA ? 'Super Admin PSU' : `${user.name} · ${user.jabatan}`}</b></div></div>,
  } : open ? { title: 'Perlu keputusan Anda', quiet: true, body: <div className="small text-muted2">Tidak ada keputusan tertunda. Periksa tahap <b>{st.code} · {st.name}</b>, lalu klik <b>Setujui</b> atau <b>Minta tindakan</b>.</div> } : null;

  const A = mode ? ACT[mode] : null;
  return (
    <>
      <ApplicationView app={app} admin backTo="/admin/antrean" tab={tab} onTab={setTab}
        headerActions={headerActions}
        decision={decision}
        main={app.service_code === 'SP' && st.code === 'ST-06' && open ? <LabInfoForm app={app} onSaved={setApp} /> : null}
        onParam={open && st.code === 'LAB-05' ? onParam : undefined}
        onDownloadDoc={(d) => download(`/admin/applications/${id}/documents/${d.id}`, d.original_name)}
        onDownloadInvoice={() => download(`/admin/applications/${id}/invoice`, `${app.payment.invoice_no.replace(/\//g, '-')}.pdf`)}
        findingActions={open ? (fd) => (fd.status === 'ditutup' ? null : fd.category === 'observasi'
          ? <button className="btn btn-sm btn-outline-secondary" onClick={() => setFinding(fd, 'tutup')}>Tutup</button>
          : <button className="btn btn-sm btn-outline-secondary" onClick={() => setReview(fd)}>Tinjau</button>) : undefined}
        findingsExtra={findingStage ? <FindingsAdd app={app} onSaved={setApp} /> : null}>
        {app.service_code === 'SP' && !(st.code === 'ST-06' && open) && app.lab_info && (
          <section className="panel panel-b small"><h2 className="mb-1">Pengujian laboratorium</h2>{app.lab_info.name}{app.lab_info.estimate && <> · estimasi {app.lab_info.estimate}</>}{app.lab_info.link && <> · <a href={app.lab_info.link} target="_blank" rel="noreferrer">tautan LHU</a></>}</section>
        )}
        {app.survey && (
          <section className="panel">
            <div className="panel-h"><h2 className="mb-0">Hasil survei pelanggan</h2><span className="small text-muted2">{fmtDate(app.survey.created_at)} · rata-rata {(app.survey.answers.reduce((t, a) => t + a.score, 0) / app.survey.answers.length).toFixed(2)}</span></div>
            <div className="panel-b small">
              <table className="table table-sm mb-2"><tbody>{app.survey.answers.map((a) => <tr key={a.question}><td>{a.question}</td><td className="text-end num">{a.score}/5</td></tr>)}</tbody></table>
              {app.survey.suggestion && <div><b>Saran:</b> {app.survey.suggestion}</div>}
            </div>
          </section>
        )}
      </ApplicationView>

      <Sheet open={!!mode} onClose={() => !busy && setMode(null)} icon={A?.icon} danger={A?.danger} wide={mode === 'setujui' && st.is_certificate_step}
        title={mode === 'setujui' ? (st.is_certificate_step ? 'Setujui & terbitkan dokumen?' : `Setujui ${st.code} · ${st.name}?`) : A?.title}
        sub={mode === 'setujui' ? <>Pengajuan lanjut ke {next ? <b>{next.code} · {next.name}</b> : 'tahap berikutnya'} dan pelanggan menerima email.</> : mode === 'minta_tindakan' ? 'Status menjadi Action Required. Pelanggan menerima email berisi catatan ini.' : mode === 'tolak' ? 'Pengajuan ditutup (Closed) dan tidak dapat dilanjutkan.' : 'Status tidak berubah.'}
        footer={<><button className="btn btn-outline-secondary" disabled={busy} onClick={() => setMode(null)}>Batal</button><button className={`btn ${A?.danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={act}>{busy ? 'Memproses…' : A?.ok}</button></>}>
        <div className="d-flex flex-column gap-3">
          {mode === 'setujui' && st.is_certificate_step && (
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label" htmlFor="cn">Nomor {docWord}</label><input id="cn" className="form-control" value={f.certificate_no} onChange={(e) => setF({ ...f, certificate_no: e.target.value })} placeholder={app.service_code === 'SP' ? 'PSU-SPPT-2026-00125' : app.service_code === 'KAL' ? 'KAL/PSU/2026/00125' : 'LHU/PSU/2026/00125'} /></div>
              <div className="col-md-6"><label className="form-label" htmlFor="cf">File {docWord} resmi (PDF)</label><FileDrop id="cf" accept=".pdf" files={certFile ? [certFile] : []} onChange={(l) => setCertFile(l[0])} label={`Pilih file ${docWord}`} hint="PDF · maks. 10 MB" /></div>
              <div className="col-12 small text-muted2">Pelanggan wajib mengisi survei kepuasan sebelum dapat mengunduh {docWord}.</div>
            </div>
          )}
          {mode === 'minta_tindakan' && st.code === 'ST-06' && <div className="small text-muted2">Hasil uji tidak sesuai? Minta tindakan akan memindahkan pengajuan ke ST-07.</div>}
          <div>
            <label className="form-label" htmlFor="an">{mode === 'tolak' ? 'Alasan penolakan' : mode === 'minta_tindakan' ? 'Tindakan yang diminta dari pelanggan' : 'Catatan'} {['setujui', 'abaikan'].includes(mode) && <span className="fw-normal text-muted2">(opsional)</span>}</label>
            <textarea id="an" className="form-control" rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={mode === 'minta_tindakan' ? 'Contoh: Lengkapi data teknis produk dan foto label.' : 'Contoh: Sampel diterima dalam kondisi baik.'} />
          </div>
          {mode !== 'tolak' && (
            <div>
              <label className="form-label" htmlFor="att">Lampiran untuk pelanggan <span className="fw-normal text-muted2">(opsional, maks. 5 file)</span></label>
              <FileDrop id="att" multiple files={files} onChange={setFiles} label="Lampirkan file" />
              {files.length > 0 && <input className="form-control mt-2" placeholder="Nama dokumen, mis. Jadwal audit / Surat permohonan" aria-label="Nama dokumen" value={f.doc_name} onChange={(e) => setF({ ...f, doc_name: e.target.value })} />}
            </div>
          )}
          {['setujui', 'abaikan'].includes(mode) && <div className="form-check"><input id="ai" type="checkbox" className="form-check-input" checked={f.internal} onChange={(e) => setF({ ...f, internal: e.target.checked })} /><label htmlFor="ai" className="form-check-label small">Internal: catatan & lampiran tidak tampil ke pelanggan</label></div>}
        </div>
      </Sheet>

      <Sheet open={invOpen} onClose={() => setInvOpen(false)} icon="receipt" title={app.payment_status === 'belum' ? 'Terbitkan invoice' : 'Perbarui invoice'} sub={`${app.application_no} · ${app.company_name}`}>
        <InvoiceForm key={app.payment?.created_at || 'new'} app={app} onSaved={(d) => { setApp(d); setInvOpen(false); }} />
      </Sheet>
      <FindingReview f={review} app={app} onChange={setApp} onClose={() => setReview(null)} onDownloadDoc={(d) => download(`/admin/applications/${id}/documents/${d.id}`, d.original_name)} />
    </>
  );
}

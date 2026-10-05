import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast } from '../../components/ui';
import AppTable from '../../components/AppTable';
import ApplicationView from '../../components/ApplicationView';

const BIDANG = { SP: 'Sertifikasi Produk', LAB: 'Lab Pengujian', KAL: 'Lab Kalibrasi' };
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function BarChart({ data }) {
  const W = 420, H = 200, pl = 28, pb = 26, pt = 14;
  const max = Math.max(4, Math.ceil(Math.max(...data.map((d) => d.total)) / 4) * 4);
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const bw = (W - pl - 10) / data.length;
  const top = Math.max(...data.map((d) => d.total));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart w-100" role="img" aria-label="Pengajuan per layanan">
      {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1={pl} x2={W - 6} y1={y((max / 4) * i)} y2={y((max / 4) * i)} stroke="#DCE3EC" /><text x={pl - 6} y={y((max / 4) * i) + 4} textAnchor="end">{(max / 4) * i}</text></g>)}
      {data.map((d, i) => {
        const x = pl + i * bw + bw * 0.22, w = bw * 0.56;
        return (<g key={d.code}><rect x={x} y={y(d.total)} width={w} height={y(0) - y(d.total)} fill={d.total === top && top > 0 ? '#C59B27' : '#2C4875'}><title>{d.name}: {d.total}</title></rect>
          <text x={x + w / 2} y={y(d.total) - 5} textAnchor="middle" style={{ fill: '#1E293B', fontWeight: 600 }}>{d.total}</text><text x={x + w / 2} y={H - 8} textAnchor="middle">{d.code}</text></g>);
      })}
    </svg>
  );
}

function LineChart({ data }) {
  const W = 420, H = 200, pl = 28, pb = 26, pt = 16, pr = 16;
  const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const vals = months.map((m) => +(data.find((d) => d.ym === m)?.total || 0));
  const max = Math.max(4, Math.ceil(Math.max(...vals) / 4) * 4);
  const x = (i) => pl + ((W - pl - pr) * i) / 5, y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart w-100" role="img" aria-label="Tren pengajuan per bulan">
      {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1={pl} x2={W - pr} y1={y((max / 4) * i)} y2={y((max / 4) * i)} stroke="#DCE3EC" /><text x={pl - 6} y={y((max / 4) * i) + 4} textAnchor="end">{(max / 4) * i}</text></g>)}
      <polygon points={`${x(0)},${y(0)} ${pts} ${x(5)},${y(0)}`} fill="#2C4875" opacity=".12" />
      <polyline points={pts} fill="none" stroke="#2C4875" strokeWidth="2.5" />
      {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === 5 ? 5 : 3} fill={i === 5 ? '#C59B27' : '#2C4875'}><title>{v}</title></circle>)}
      {months.map((m, i) => <text key={m} x={x(i)} y={H - 8} textAnchor="middle">{MONTH[+m.slice(5) - 1]}</text>)}
    </svg>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/admin/dashboard').then((r) => setD(r.data)); }, []);
  if (!d) return <Loading />;
  const s = d.stats;
  return (
    <>
      <PageHead eyebrow={`Dashboard · ${user.role === 'superadmin' ? 'semua bidang' : BIDANG[user.bidang]}`} title="Ringkasan layanan" />
      <div className="row g-3 mb-3">
        {[['On Progress', s.aktif, 'var(--psu-steel)'], ['Action Required', s.aksi, 'var(--warn)'], ['Waiting for Payment', s.payment, 'var(--warn)'], ['Selesai', s.selesai, 'var(--ok)']].map(([k, v, c]) => (
          <div className="col-6 col-md-3" key={k}><div className="stat" style={{ '--k': c }}><div className="v num">{v}</div><div className="k">{k}</div></div></div>
        ))}
      </div>
      <div className="row g-3 mb-3">
        <div className="col-lg-6"><section className="panel h-100"><div className="panel-h"><h2 className="mb-0">Pengajuan per layanan</h2></div><div className="panel-b"><BarChart data={d.per_service} /></div></section></div>
        <div className="col-lg-6"><section className="panel h-100"><div className="panel-h"><h2 className="mb-0">Tren pengajuan 6 bulan</h2></div><div className="panel-b"><LineChart data={d.per_month} /></div></section></div>
      </div>
      <section className="panel"><div className="panel-h"><h2 className="mb-0">Perlu tindakan sekarang</h2><span className="small text-muted2">pengajuan baru & bukti bayar menunggu verifikasi</span></div><AppTable rows={d.need_action} base="/admin/pengajuan" showCompany /></section>
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
          <input className="form-control" style={{ maxWidth: 280 }} placeholder="Cari no. pengajuan / perusahaan / produk" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="form-select" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter kondisi">
            <option value="">Semua kondisi</option><option value="aktif">On Progress</option><option value="aksi">Action Required</option><option value="ditolak">Closed</option><option value="selesai">Selesai</option>
          </select>
        </div>
        {rows ? <AppTable rows={rows} base="/admin/pengajuan" showCompany /> : <Loading />}
      </section>
    </>
  );
}

export function AdminDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ note: '', internal: false, certificate_no: '' });
  const [certFile, setCertFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get(`/admin/applications/${id}`).then((r) => setApp(r.data)).catch((e) => setErr(errMsg(e))), [id]);
  useEffect(() => { load(); }, [load]);
  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!app) return <Loading />;

  const act = async (action) => {
    if ((action === 'minta_tindakan' || action === 'tolak') && !f.note.trim()) return toast(action === 'tolak' ? 'Isi alasan penolakan dulu.' : 'Isi catatan tindakan yang diminta dulu.', 'danger');
    const fd = new FormData();
    fd.append('action', action); fd.append('note', f.note); fd.append('internal', f.internal ? '1' : '0');
    if (f.certificate_no) fd.append('certificate_no', f.certificate_no);
    if (certFile) fd.append('certificate', certFile);
    setBusy(true);
    try {
      const r = await api.post(`/admin/applications/${id}/action`, fd);
      setApp(r.data); setF({ note: '', internal: false, certificate_no: '' }); setCertFile(null);
      toast({ setujui: 'Tahap disetujui.', minta_tindakan: 'Status menjadi Action Required. Email dikirim ke pelanggan.', abaikan: 'Catatan ditambahkan, status tidak berubah.', tolak: 'Pengajuan ditutup.' }[action]);
    } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  const onParam = async (pid, status) => {
    try { setApp((await api.patch(`/admin/applications/${id}/parameters/${pid}`, { status })).data); } catch (e) { toast(errMsg(e), 'danger'); }
  };

  const open = ['aktif', 'aksi'].includes(app.status);
  const st = app.current_step;
  const payBlocked = st.is_payment_step && app.payment_status === 'belum';
  const paramsOpen = app.parameters.some((p) => p.status !== 'selesai') && st.code === 'LAB-05';
  const actions = !open ? <p className="mb-0 text-muted2">Pengajuan sudah {app.status === 'selesai' ? 'selesai' : 'ditutup'}.</p> : (
    <div className="d-flex flex-column gap-2">
      <label className="form-label mb-0" htmlFor="an">Catatan <span className="fw-normal text-muted2">(wajib untuk Minta tindakan & Tolak)</span></label>
      <textarea id="an" className="form-control" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Contoh: Sampel diterima dalam kondisi baik." />
      <div className="form-check"><input id="ai" type="checkbox" className="form-check-input" checked={f.internal} onChange={(e) => setF({ ...f, internal: e.target.checked })} /><label htmlFor="ai" className="form-check-label small">Catatan internal (tidak tampil ke pelanggan)</label></div>
      {st.is_payment_step && (
        <div className={`alert ${app.payment_status === 'menunggu' ? 'alert-warning' : 'alert-light border'} small py-2 mb-0`}>
          Pembayaran: <b>{app.payment_status === 'menunggu' ? 'bukti bayar sudah diunggah' : app.payment_status === 'belum' ? 'menunggu pelanggan membayar invoice' : 'terverifikasi'}</b>.
          {app.payment_status === 'menunggu' && <button className="btn btn-link btn-sm p-0 ms-1" onClick={() => download(`/admin/applications/${id}/payment-proof`, `bukti-bayar-${app.application_no}`)}>Lihat bukti</button>}
          {' '}Setujui tahap ini berarti pembayaran valid.
        </div>
      )}
      {st.is_certificate_step && (
        <div className="row g-2">
          <div className="col-12"><label className="form-label mb-0" htmlFor="cn">Nomor sertifikat / LHU</label><input id="cn" className="form-control" value={f.certificate_no} onChange={(e) => setF({ ...f, certificate_no: e.target.value })} placeholder={app.service_code === 'SP' ? 'PSU-SNI-2026-00125' : app.service_code === 'KAL' ? 'KAL/PSU/2026/00125' : 'LHU/PSU/2026/00125'} /></div>
          <div className="col-12"><label className="form-label mb-0" htmlFor="cf">File sertifikat resmi (PDF)</label><input id="cf" type="file" accept=".pdf" className="form-control form-control-sm" onChange={(e) => setCertFile(e.target.files[0])} /></div>
        </div>
      )}
      <div className="d-flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy || payBlocked || paramsOpen} onClick={() => act('setujui')}>{st.is_certificate_step ? 'Setujui & terbitkan' : 'Setujui'}</button>
        <button className="btn btn-outline-warning" disabled={busy} onClick={() => act('minta_tindakan')}>Minta tindakan</button>
        <button className="btn btn-outline-secondary" disabled={busy} onClick={() => act('abaikan')}>Abaikan</button>
        <button className="btn btn-outline-danger" disabled={busy} onClick={() => act('tolak')}>Tolak</button>
      </div>
      {payBlocked && <span className="small text-muted2">Tahap pembayaran baru bisa disetujui setelah pelanggan mengunggah bukti bayar.</span>}
      {paramsOpen && <span className="small text-muted2">LAB-05 belum bisa lanjut ke review: masih ada parameter yang belum selesai.</span>}
      {st.code === 'ST-06' && <span className="small text-muted2">Ada ketidaksesuaian? Pilih <b>Minta tindakan</b>: pengajuan masuk ST-07. Tidak ada? <b>Setujui</b> langsung ke ST-08.</span>}
      <span className="small text-muted2">Tercatat sebagai PIC: <b>{user.role === 'superadmin' ? 'Super Admin PSU' : `${user.name} · ${user.jabatan}`}</b></span>
    </div>
  );

  return <ApplicationView app={app} admin backTo="/admin/antrean" actions={actions}
    onParam={open && st.code === 'LAB-05' ? onParam : undefined}
    onDownloadDoc={(d) => download(`/admin/applications/${id}/documents/${d.id}`, d.original_name)} />;
}

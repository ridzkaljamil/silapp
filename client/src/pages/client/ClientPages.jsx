import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast } from '../../components/ui';
import AppTable from '../../components/AppTable';
import ApplicationView from '../../components/ApplicationView';

export function Beranda() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/applications').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  const c = (k) => rows.filter((a) => a.status === k).length;
  const act = rows.filter((a) => a.status === 'aksi' || a.condition === 'Waiting for Payment');
  return (
    <>
      <PageHead eyebrow="Beranda" title={`Selamat datang, ${user.name.split(' ')[0]}`} sub={user.company_name}>
        <Link to="/klien/ajukan" className="btn btn-gold"><i className="bi bi-plus-lg me-1" />Ajukan layanan</Link>
      </PageHead>
      <div className="row g-3 mb-3">
        {[['Total pengajuan', rows.length, 'var(--psu-navy)'], ['On Progress', c('aktif'), 'var(--psu-steel)'], ['Action Required', c('aksi'), 'var(--warn)'], ['Selesai', c('selesai'), 'var(--ok)']].map(([k, v, col]) => (
          <div className="col-6 col-md-3" key={k}><div className="stat" style={{ '--k': col }}><div className="v num">{v}</div><div className="k">{k}</div></div></div>
        ))}
      </div>
      {act.map((a) => (
        <div key={a.id} className="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span><b>{a.application_no}</b> · {a.condition === 'Waiting for Payment' ? 'Invoice menunggu pembayaran.' : 'Tindakan Anda diperlukan.'}</span>
          <Link className="btn btn-sm btn-outline-dark" to={`/klien/pengajuan/${a.id}`}>Tindak lanjuti</Link>
        </div>
      ))}
      <section className="panel"><div className="panel-h"><h2 className="mb-0">Pengajuan saya</h2></div><AppTable rows={rows} base="/klien/pengajuan" /></section>
    </>
  );
}

export function PengajuanList() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/applications').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (
    <>
      <PageHead eyebrow="Pengajuan saya" title="Riwayat pengajuan" />
      <section className="panel"><AppTable rows={rows} base="/klien/pengajuan" /></section>
    </>
  );
}

export function PengajuanDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get(`/applications/${id}`).then((r) => setApp(r.data)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!app) return <Loading />;

  const run = async (fn, ok) => {
    setBusy(true);
    try { setApp((await fn()).data); setFiles([]); setNote(''); toast(ok); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  const reply = () => {
    const fd = new FormData(); fd.append('note', note); [...files].forEach((f) => fd.append('documents', f));
    run(() => api.post(`/applications/${id}/reply`, fd), 'Tanggapan terkirim. Admin akan memeriksa ulang.');
  };
  const pay = () => {
    if (!files.length) return toast('Pilih file bukti bayar dulu.', 'danger');
    const fd = new FormData(); fd.append('proof', files[0]);
    run(() => api.post(`/applications/${id}/payment`, fd), 'Bukti bayar terkirim untuk diverifikasi.');
  };

  let actions = <p className="text-muted2 mb-0">Tidak ada tindakan yang diperlukan saat ini.</p>;
  const fileInput = (multi) => <input type="file" className="form-control form-control-sm" multiple={multi} accept=".pdf,.zip,.jpg,.jpeg,.png" onChange={(e) => setFiles(e.target.files)} />;
  if (app.status === 'aksi') {
    actions = (
      <div className="d-flex flex-column gap-2">
        <label className="form-label mb-0" htmlFor="rn">Tanggapan / keterangan</label>
        <textarea id="rn" className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="form-label mb-0">{app.current_step.code === 'ST-07' ? 'Unggah tindakan perbaikan' : 'Unggah dokumen / data yang diminta'} <span className="fw-normal text-muted2">(PDF/ZIP/JPG, maks. 10 MB)</span></label>
        {fileInput(true)}
        <button className="btn btn-warning" disabled={busy} onClick={reply}>Kirim tanggapan</button>
      </div>
    );
  } else if (app.status === 'aktif' && app.current_step.is_payment_step && app.payment_status === 'belum') {
    actions = (
      <div className="d-flex flex-column gap-2">
        <p className="mb-0 small">Setujui penawaran dari Admin, lakukan transfer, lalu unggah bukti pembayaran.</p>
        {fileInput(false)}
        <button className="btn btn-gold" disabled={busy} onClick={pay}>Unggah bukti bayar</button>
      </div>
    );
  } else if (app.payment_status === 'menunggu' && app.status === 'aktif') {
    actions = <p className="mb-0">Bukti bayar sedang diverifikasi Admin.</p>;
  } else if (app.condition === 'Ready for Collection') {
    actions = <p className="mb-0">Kalibrasi selesai. Alat siap diambil atau dikirim kembali; hubungi contact person Laboratorium Kalibrasi untuk mengatur pengambilan.</p>;
  }
  if (app.certificate?.has_file && app.status === 'selesai') {
    actions = <button className="btn btn-gold" onClick={() => download(`/applications/${id}/certificate`, `${app.certificate.certificate_no}.pdf`).catch((e) => toast(errMsg(e), 'danger'))}><i className="bi bi-download me-1" />Unduh sertifikat / LHU</button>;
  }

  return <ApplicationView app={app} backTo="/klien/pengajuan" actions={actions}
    onDownloadDoc={(d) => download(`/applications/${id}/documents/${d.id}`, d.original_name)} />;
}

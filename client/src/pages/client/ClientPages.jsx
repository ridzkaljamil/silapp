import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast, Sheet, FileDrop, rupiah, fmtDate } from '../../components/ui';
import AppTable from '../../components/AppTable';
import ApplicationView from '../../components/ApplicationView';

const dayDiff = (d) => (d ? Math.round((new Date(`${d}T00:00:00`) - new Date(new Date().toDateString())) / 86400000) : null);

export function Beranda() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('jalan');
  useEffect(() => { api.get('/applications').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  const todo = rows.flatMap((a) => {
    const name = a.product_label.split(' · ')[0];
    const meta = `${name} · ${a.application_no}`;
    if (a.status === 'aksi') return [{ a, ic: 'exclamation-lg', cls: 'ic-warn', pill: ['pill-action', 'Permintaan PSU'], t: 'Tanggapi permintaan PSU', s: meta }];
    if (a.open_findings > 0 && a.finding_due) {
      const n = dayDiff(a.finding_due);
      const left = n < 0 ? `terlambat ${-n} hari` : `sisa ${n} hari`;
      return [{ a, ic: 'clock-history', cls: 'ic-warn', pill: ['pill-action', `Temuan audit · ${left}`], t: 'Kirim bukti perbaikan temuan', s: meta, m: <>{name} · tenggat {fmtDate(a.finding_due)} · <b className="text-warn">{left}</b></> }];
    }
    if (a.condition === 'Waiting for Payment' && a.payment_status === 'invoice') return [{ a, ic: 'credit-card', cls: 'ic-info', pill: ['pill-progress', `Invoice · ${rupiah(a.pay_amount)}`], t: 'Bayar dan unggah bukti transfer', s: meta, m: `${name} · ${rupiah(a.pay_amount)}` }];
    if (a.status === 'selesai' && !a.survey_done) return [{ a, ic: 'download', cls: 'ic-ok', pill: ['pill-done', `${a.service_code === 'SP' || a.service_code === 'KAL' ? 'Sertifikat' : 'LHU'} terbit`], t: 'Isi survei & unduh dokumen', s: meta, m: `${name} · dokumen telah terbit` }];
    return [];
  });
  const jalan = rows.filter((a) => !['selesai', 'ditolak'].includes(a.status));
  const selesai = rows.filter((a) => ['selesai', 'ditolak'].includes(a.status));
  const hari = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <div className="page-head home-head">
        <div><div className="small text-muted2">{hari}</div><h1>Selamat datang, {user.name.split(' ')[0]}</h1></div>
        <Link to="/klien/ajukan" className="btn btn-primary home-cta"><i className="bi bi-plus-lg" />Ajukan layanan</Link>
      </div>
      {todo.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2">Perlu tindakan Anda <span className="text-muted2 fw-normal">· {todo.length}</span></h2>
          <div className="todo-cards">
            {todo.map((x) => (
              <Link key={x.a.id} to={`/klien/pengajuan/${x.a.id}`} className="todo-card">
                <span className={`pill ${x.pill[0]}`}>{x.pill[1]}</span>
                <b>{x.t}</b>
                <span className="small text-muted2">{x.s}</span>
              </Link>
            ))}
          </div>
          <div className="panel todo-list todo-list-m">
            {todo.map((x) => (
              <Link key={x.a.id} to={`/klien/pengajuan/${x.a.id}`} className="todo-item">
                <span className={`ic ${x.cls}`}><i className={`bi bi-${x.ic}`} /></span>
                <span className="tx"><b>{x.t}</b><span>{x.m || x.s}</span></span>
                <i className="bi bi-chevron-right text-muted2" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="panel mb-4">
        <div className="panel-h">
          <h2 className="mb-0">Pengajuan saya</h2>
          <div className="segmented" role="group" aria-label="Filter">
            <button aria-pressed={tab === 'jalan'} onClick={() => setTab('jalan')}>Berjalan · {jalan.length}</button>
            <button aria-pressed={tab === 'selesai'} onClick={() => setTab('selesai')}>Selesai · {selesai.length}</button>
          </div>
        </div>
        <AppTable rows={tab === 'jalan' ? jalan : selesai} base="/klien/pengajuan" empty={tab === 'jalan' ? 'Belum ada pengajuan berjalan.' : 'Belum ada pengajuan selesai.'} />
      </section>
      <div className="help-cards">
        <Link to="/klien/lacak" className="help-card"><span className="ic"><i className="bi bi-search" /></span><span><b>Lacak dengan kode</b><span>Bagikan kode lacak ke tim Anda, bisa dibuka tanpa login</span></span></Link>
        <Link to="/layanan" className="help-card"><span className="ic"><i className="bi bi-telephone" /></span><span><b>Butuh bantuan?</b><span>Hubungi contact person layanan PSU</span></span></Link>
      </div>
    </>
  );
}

export function PengajuanList() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/applications').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (
    <>
      <PageHead eyebrow="Pengajuan saya" title="Riwayat pengajuan" sub="Semua pengajuan layanan perusahaan Anda.">
        <Link to="/klien/ajukan" className="btn btn-primary"><i className="bi bi-plus-lg" />Ajukan layanan</Link>
      </PageHead>
      <section className="panel"><AppTable rows={rows} base="/klien/pengajuan" /></section>
    </>
  );
}

/** Aksi pelanggan per temuan: kirim bukti perbaikan, ajukan perpanjangan 1 bulan (sekali). */
/** Survei kepuasan pelanggan: wajib sebelum unduh sertifikat/LHU. */
function Survey({ app, onDone }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/applications/${app.id}/survey`).then((r) => setData(r.data)); }, [app.id]);
  if (!data) return <Loading />;
  const submit = async () => {
    if (data.questions.some((q) => !scores[q.id])) return toast('Mohon beri nilai untuk semua pertanyaan.', 'danger');
    setBusy(true);
    try { const r = await api.post(`/applications/${app.id}/survey`, { scores, suggestion }); onDone(r.data); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <section className="panel" aria-labelledby="sv-title">
      <div className="panel-h"><h2 className="mb-0" id="sv-title">Survei Kepuasan Pelanggan</h2><span className="small text-muted2">wajib diisi untuk setiap penerbitan dokumen</span></div>
      <div className="panel-b d-flex flex-column gap-3">
        <p className="mb-0 small">Sebelum mengunduh {app.service_code === 'SP' || app.service_code === 'KAL' ? 'sertifikat' : 'LHU'}, mohon beri penilaian atas layanan kami. Skala 1 = sangat tidak puas, 5 = sangat puas.</p>
        {data.questions.map((q, i) => (
          <fieldset key={q.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2">
            <legend className="fs-6 mb-0 flex-grow-1" style={{ float: 'none', width: 'auto', maxWidth: 520 }}>{i + 1}. {q.question}</legend>
            <div className="score">
              {[1, 2, 3, 4, 5].map((v) => (
                <span key={v}><input type="radio" id={`q${q.id}-${v}`} name={`q${q.id}`} checked={scores[q.id] === v} onChange={() => setScores({ ...scores, [q.id]: v })} /><label htmlFor={`q${q.id}-${v}`}>{v}</label></span>
              ))}
            </div>
          </fieldset>
        ))}
        <div><label className="form-label" htmlFor="sg">Kritik dan saran (opsional)</label><textarea id="sg" className="form-control" rows={3} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} /></div>
        <div><button className="btn btn-gold" disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim survei'}</button></div>
      </div>
    </section>
  );
}

export function PengajuanDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState('');
  const [sheet, setSheet] = useState(null); // { kind: 'reply' | 'pay' | 'bukti' | 'ext', f? }
  const [tab, setTab] = useState('ringkasan');
  const load = useCallback(() => api.get(`/applications/${id}`).then((r) => setApp(r.data)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!app) return <Loading />;

  const openSheet = (kind, f) => { setNote(''); setFiles([]); setSheet({ kind, f }); };
  const run = async (fn, ok) => {
    setBusy(true);
    try { setApp((await fn()).data); setSheet(null); setFiles([]); setNote(''); toast(ok); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  const submit = () => {
    const k = sheet.kind;
    if (k === 'reply') {
      if (!note.trim() && !files.length) return toast('Isi tanggapan atau unggah dokumen.', 'danger');
      const fd = new FormData(); fd.append('note', note); [...files].forEach((f) => fd.append('documents', f));
      return run(() => api.post(`/applications/${id}/reply`, fd), 'Tanggapan terkirim. Admin akan memeriksa ulang.');
    }
    if (k === 'pay') {
      if (!files.length) return toast('Pilih file bukti bayar dulu.', 'danger');
      const fd = new FormData(); fd.append('proof', files[0]);
      return run(() => api.post(`/applications/${id}/payment`, fd), 'Bukti bayar terkirim untuk diverifikasi.');
    }
    if (k === 'bukti') {
      if (!files.length && !note.trim()) return toast('Unggah bukti perbaikan atau isi keterangan.', 'danger');
      const fd = new FormData(); fd.append('note', note); [...files].forEach((x) => fd.append('documents', x));
      return run(() => api.post(`/applications/${id}/findings/${sheet.f.id}/reply`, fd), 'Bukti perbaikan terkirim. PSU akan meninjau.');
    }
    if (!note.trim()) return toast('Isi alasan perpanjangan.', 'danger');
    return run(() => api.post(`/applications/${id}/findings/${sheet.f.id}/extension`, { reason: note }), 'Pengajuan perpanjangan terkirim.');
  };

  const docWord = app.service_code === 'SP' || app.service_code === 'KAL' ? 'sertifikat' : 'LHU';
  const dlCert = () => download(`/applications/${id}/certificate`, `${app.certificate.certificate_no}.pdf`).catch((e) => toast(errMsg(e), 'danger'));
  const active = app.status === 'aktif' || app.status === 'aksi';
  const openF = app.findings.filter((f) => f.status !== 'ditutup' && f.category !== 'observasi');
  const todoF = openF.filter((f) => f.status === 'terbuka').sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999));
  const nearest = todoF[0];
  const st = app.current_step;

  /* tugas utama pelanggan: satu tombol di kepala halaman & bar bawah HP */
  let task = null;
  if (app.status === 'aksi') {
    task = { title: st.code === 'ST-07' ? 'Kirim tindakan perbaikan' : 'Lengkapi permintaan PSU', text: app.action_note, cta: 'Kirim tanggapan', onClick: () => openSheet('reply') };
  } else if (app.status === 'aktif' && st.is_payment_step && app.payment_status === 'invoice') {
    task = { title: 'Lakukan pembayaran', text: <>Invoice <b>{rupiah(app.payment.amount)}</b>{app.payment.due_date && <> · jatuh tempo {fmtDate(app.payment.due_date)}</>}. Transfer lalu unggah bukti bayar.</>, cta: 'Unggah bukti bayar', onClick: () => openSheet('pay'), extra: <button className="btn btn-link btn-sm p-0" style={{ minHeight: 0 }} onClick={() => setTab('invoice')}>Lihat rincian invoice</button> };
  } else if (active && nearest) {
    task = {
      title: `Kirim bukti perbaikan ${todoF.length > 1 ? `${todoF.length} temuan` : `temuan ${nearest.category}`}`,
      text: nearest.due_date ? <>Paling lambat {fmtDate(nearest.due_date)} · {nearest.days_left < 0 ? `terlambat ${-nearest.days_left} hari` : `sisa ${nearest.days_left} hari`}</> : null,
      cta: 'Kirim bukti perbaikan', onClick: () => openSheet('bukti', nearest),
    };
  } else if (app.status === 'selesai' && app.certificate && !app.survey_done) {
    task = { title: 'Isi survei kepuasan', text: `Survei wajib diisi sebelum mengunduh ${docWord}.`, cta: 'Isi survei', onClick: () => document.getElementById('sv-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) };
  } else if (app.status === 'selesai' && app.certificate && app.survey_done) {
    task = { title: `${docWord[0].toUpperCase()}${docWord.slice(1)} siap diunduh`, text: thanks || `Nomor ${app.certificate.certificate_no}.`, cta: `Unduh ${docWord}`, icon: 'download', onClick: dlCert, done: true };
  }
  let info = null;
  if (!task && app.status === 'aktif') {
    if (st.is_payment_step && app.payment_status === 'belum') info = 'PSU sedang menyiapkan invoice. Anda akan menerima email ketika invoice terbit.';
    else if (app.payment_status === 'menunggu') info = 'Bukti bayar sedang diverifikasi Admin.';
    else if (openF.length) info = 'Bukti perbaikan sudah dikirim dan sedang ditinjau PSU.';
    else if (app.condition === 'Ready for Collection') info = 'Kalibrasi selesai. Alat siap diambil atau dikirim kembali; hubungi contact person Laboratorium Kalibrasi.';
  }

  const ctaBtn = task && <button className={`btn ${task.done ? 'btn-gold' : 'btn-primary'}`} onClick={task.onClick}>{task.icon && <i className={`bi bi-${task.icon}`} />}{task.cta}</button>;
  const decision = task ? {
    title: task.done ? 'Dokumen' : 'Perlu tindakan Anda',
    body: (
      <div className={`task-box ${task.done ? 'ok' : ''}`}>
        <span className="ic"><i className={`bi bi-${task.done ? 'patch-check' : 'clock-history'}`} /></span>
        <div className="min-w-0 d-flex flex-column gap-1">
          <div className="eyebrow">{task.done ? 'Selesai' : 'Perlu tindakan Anda'}</div>
          <b>{task.title}</b>
          {task.text && <span className="small">{task.text}</span>}
          {task.extra}
        </div>
      </div>
    ),
  } : info ? { title: 'Status', body: <div className="task-box info"><span className="ic"><i className="bi bi-hourglass-split" /></span><span className="small">{info}</span></div> } : null;

  const survey = app.status === 'selesai' && app.certificate && !app.survey_done
    ? <Survey app={app} onDone={(d) => { setApp(d.app); setThanks(d.thank_you_text); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /> : null;

  const findingActions = active ? (f) => {
    if (f.status === 'ditutup' || f.category === 'observasi') return null;
    return (
      <span className="d-inline-flex gap-2 flex-wrap">
        <button className={`btn btn-sm ${f.status === 'dikirim' ? 'btn-outline-secondary' : 'btn-primary'}`} onClick={() => openSheet('bukti', f)}>{f.status === 'dikirim' ? 'Kirim bukti tambahan' : 'Kirim bukti'}</button>
        {f.extension_status === 'tidak' && <button className="btn btn-sm btn-outline-secondary" onClick={() => openSheet('ext', f)}>Perpanjang</button>}
      </span>
    );
  } : undefined;

  const K = sheet?.kind;
  const sheetTitle = { reply: 'Kirim tanggapan', pay: 'Unggah bukti bayar', bukti: 'Kirim bukti perbaikan', ext: 'Ajukan perpanjangan 1 bulan' }[K];
  return (
    <>
      <ApplicationView app={app} backTo="/klien/pengajuan" tab={tab} onTab={setTab}
        headerActions={ctaBtn} decision={decision}
        onDownloadDoc={(d) => download(`/applications/${id}/documents/${d.id}`, d.original_name).catch((e) => toast(errMsg(e), 'danger'))}
        onDownloadInvoice={() => download(`/applications/${id}/invoice`, `${app.payment.invoice_no.replace(/\//g, '-')}.pdf`)}
        findingActions={findingActions}>
        {survey}
      </ApplicationView>
      <Sheet open={!!sheet} onClose={() => !busy && setSheet(null)} title={sheetTitle}
        icon={{ reply: 'reply', pay: 'receipt', bukti: 'upload', ext: 'calendar-plus' }[K]}
        sub={K === 'reply' ? app.action_note : K === 'pay' ? `Total ${rupiah(app.payment?.amount)} · ${app.payment?.invoice_no || ''}` : sheet?.f ? `Temuan ${sheet.f.category} #${sheet.f.id}: ${sheet.f.description}` : ''}
        footer={<><button className="btn btn-outline-secondary" disabled={busy} onClick={() => setSheet(null)}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim'}</button></>}>
        <div className="d-flex flex-column gap-3">
          {K !== 'pay' && (
            <div>
              <label className="form-label" htmlFor="cs-note">{K === 'ext' ? 'Alasan perpanjangan' : K === 'bukti' ? 'Keterangan perbaikan' : 'Tanggapan / keterangan'}</label>
              <textarea id="cs-note" className="form-control" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              {K === 'ext' && <div className="form-text">Perpanjangan hanya dapat diajukan satu kali dan perlu disetujui PSU.</div>}
            </div>
          )}
          {K !== 'ext' && (
            <div>
              <label className="form-label" htmlFor="cs-file">{K === 'pay' ? 'File bukti transfer' : K === 'bukti' ? 'Bukti perbaikan' : st.code === 'ST-07' ? 'Unggah tindakan perbaikan' : 'Dokumen / data yang diminta'}</label>
              <FileDrop id="cs-file" multiple={K !== 'pay'} files={files} onChange={setFiles} />
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}

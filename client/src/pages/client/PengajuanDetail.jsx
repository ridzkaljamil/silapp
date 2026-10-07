/** Detail pengajuan sisi pelanggan: tugas, pop-up kirim tanggapan/bukti/bayar. */
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { Loading, useToast, Sheet, FileDrop, rupiah, fmtDate } from '../../components/ui';
import ApplicationView from '../../components/ApplicationView';
import { docWord } from '../../lib/constants';
import Survey from './Survey';

export default function PengajuanDetail() {
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

  const dw = docWord(app.service_code);
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
    task = { title: 'Isi survei kepuasan', text: `Survei wajib diisi sebelum mengunduh ${dw}.`, cta: 'Isi survei', onClick: () => document.getElementById('sv-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) };
  } else if (app.status === 'selesai' && app.certificate && app.survey_done) {
    task = { title: `${dw[0].toUpperCase()}${dw.slice(1)} siap diunduh`, text: thanks || `Nomor ${app.certificate.certificate_no}.`, cta: `Unduh ${dw}`, icon: 'download', onClick: dlCert, done: true };
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

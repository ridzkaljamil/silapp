/** Detail pengajuan sisi pelanggan: tugas, pop-up kirim tanggapan/bukti/bayar. */
import { useEffect, useState, useCallback } from 'react';
import { peekLocalDraft, dropLocalDraft } from '../../hooks/useLocalDraft';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { Loading, useToast, Sheet, FileDrop, Menu, rupiah, fmtDate } from '../../components/ui';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
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
  // perbarui otomatis saat ada notifikasi untuk pengajuan ini / tab kembali dibuka
  useLiveRefresh(load, `/klien/pengajuan/${id}`, !sheet);
  if (!app) return <Loading />;

  // catatan tanggapan tersimpan otomatis di browser per pengajuan & jenis tanggapan
  const noteKey = (kind, f) => `silapp_catatan_${id}_${kind}${f?.id ? `_${f.id}` : ''}`;
  const openSheet = (kind, f) => { setNote(peekLocalDraft(noteKey(kind, f), '')); setFiles([]); setSheet({ kind, f }); };
  const changeNote = (v) => { setNote(v); try { localStorage.setItem(noteKey(sheet.kind, sheet.f), JSON.stringify(v)); } catch { /* abaikan */ } };
  const run = async (fn, ok) => {
    setBusy(true);
    try { setApp((await fn()).data); if (sheet) dropLocalDraft(noteKey(sheet.kind, sheet.f)); setSheet(null); setFiles([]); setNote(''); toast(ok); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
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
    if (k === 'batal') {
      if (!note.trim()) return toast('Tuliskan alasan pembatalan.', 'danger');
      return run(() => api.post(`/applications/${id}/cancel`, { reason: note }), 'Pengajuan dibatalkan. Anda bisa mengajukan ulang dengan data yang diperbaiki.');
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
    task = { title: st.code === 'ST-07' ? 'Kirim Tindakan Perbaikan' : 'Lengkapi Permintaan PSU', text: app.action_note, cta: 'Kirim Tanggapan', onClick: () => openSheet('reply') };
  } else if (app.status === 'aktif' && st.is_payment_step && app.payment_status === 'invoice') {
    task = { title: 'Lakukan Pembayaran', text: <>Invoice <b>{rupiah(app.payment.amount)}</b>{app.payment.due_date && <> · jatuh tempo {fmtDate(app.payment.due_date)}</>}. Transfer lalu unggah bukti bayar.</>, cta: 'Unggah Bukti Bayar', onClick: () => openSheet('pay'), extra: <button className="btn btn-link btn-sm p-0" style={{ minHeight: 0 }} onClick={() => setTab('invoice')}>Lihat Rincian Invoice</button> };
  } else if (active && nearest) {
    task = {
      title: `Kirim Bukti Perbaikan ${todoF.length > 1 ? `${todoF.length} Temuan` : `Temuan ${nearest.category[0].toUpperCase()}${nearest.category.slice(1)}`}`,
      text: nearest.due_date ? <>Paling lambat {fmtDate(nearest.due_date)} · {nearest.days_left < 0 ? `terlambat ${-nearest.days_left} hari` : `sisa ${nearest.days_left} hari`}</> : null,
      cta: 'Kirim Bukti Perbaikan', onClick: () => openSheet('bukti', nearest),
    };
  } else if (app.status === 'selesai' && app.certificate && !app.survey_done) {
    task = { title: 'Isi Survei Kepuasan', text: `Survei wajib diisi sebelum mengunduh ${dw}.`, cta: 'Isi Survei', onClick: () => document.getElementById('sv-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) };
  } else if (app.status === 'selesai' && app.certificate && app.survey_done) {
    task = { title: `${dw[0].toUpperCase()}${dw.slice(1)} Siap Diunduh`, text: thanks || `Nomor ${app.certificate.certificate_no}.`, cta: `Unduh ${dw[0].toUpperCase()}${dw.slice(1)}`, icon: 'download', onClick: dlCert, done: true };
  }
  let info = null;
  if (!task && app.status === 'aktif') {
    if (st.is_payment_step && app.payment_status === 'belum') info = 'PSU sedang menyiapkan invoice. Anda akan menerima email ketika invoice terbit.';
    else if (app.payment_status === 'menunggu') info = 'Bukti bayar sedang diverifikasi Admin.';
    else if (openF.length) info = 'Bukti perbaikan sudah dikirim dan sedang ditinjau PSU.';
    else if (app.condition === 'Ready for Collection') info = 'Kalibrasi selesai. Alat siap diambil atau dikirim kembali; hubungi contact person Laboratorium Kalibrasi.';
  }

  const mainBtn = task && <button className={`btn ${task.done ? 'btn-gold' : 'btn-primary'}`} onClick={task.onClick}>{task.icon && <i className={`bi bi-${task.icon}`} />}{task.cta}</button>;
  // batal hanya selama PSU belum memproses; pengajuan batal bisa diajukan ulang dengan data lama
  const more = app.can_cancel && <Menu items={[{ label: 'Batalkan Pengajuan', icon: 'x-circle', danger: true, onClick: () => openSheet('batal') }]} />;
  const ctaBtn = (mainBtn || more || app.status === 'batal') ? <>{more}{mainBtn}{app.status === 'batal' && <Link to={`/klien/ajukan?dari=${id}`} className="btn btn-primary"><i className="bi bi-arrow-repeat" />Ajukan Ulang</Link>}</> : null;
  const decision = task ? {
    title: task.done ? 'Dokumen' : 'Perlu Tindakan Anda',
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
        <button className={`btn btn-sm ${f.status === 'dikirim' ? 'btn-outline-secondary' : 'btn-primary'}`} onClick={() => openSheet('bukti', f)}>{f.status === 'dikirim' ? 'Kirim Bukti Tambahan' : 'Kirim Bukti'}</button>
        {f.extension_status === 'tidak' && <button className="btn btn-sm btn-outline-secondary" onClick={() => openSheet('ext', f)}>Perpanjang</button>}
      </span>
    );
  } : undefined;

  const K = sheet?.kind;
  const sheetTitle = { reply: 'Kirim Tanggapan', pay: 'Unggah Bukti Bayar', bukti: 'Kirim Bukti Perbaikan', ext: 'Ajukan Perpanjangan 1 Bulan', batal: 'Batalkan Pengajuan?' }[K];
  return (
    <>
      <ApplicationView app={app} backTo="/klien/pengajuan" tab={tab} onTab={setTab}
        headerActions={ctaBtn} decision={decision}
        onDownloadDoc={(d) => download(`/applications/${id}/documents/${d.id}`, d.original_name).catch((e) => toast(errMsg(e), 'danger'))}
        onDownloadInvoice={() => download(`/applications/${id}/invoice`, `Invoice-${app.payment.invoice_no.replace(/\//g, '-')}.pdf`).catch((e) => toast(errMsg(e), 'danger'))}
        onDownloadProof={() => download(`/applications/${id}/payment-proof`, `bukti-bayar-${app.application_no}`).catch((e) => toast(errMsg(e), 'danger'))}
        findingActions={findingActions}>
        {survey}
      </ApplicationView>
      <Sheet open={!!sheet} onClose={() => !busy && setSheet(null)} title={sheetTitle}
        icon={{ reply: 'reply', pay: 'receipt', bukti: 'upload', ext: 'calendar-plus', batal: 'x-circle' }[K]} danger={K === 'batal'}
        sub={K === 'batal' ? 'Pengajuan berhenti dan tidak diproses PSU. Setelah dibatalkan, Anda bisa mengajukan ulang dengan data yang sudah diperbaiki.' : K === 'reply' ? app.action_note : K === 'pay' ? `Total ${rupiah(app.payment?.amount)} · ${app.payment?.invoice_no || ''}` : sheet?.f ? `Temuan ${sheet.f.category} #${sheet.f.id}: ${sheet.f.description}` : ''}
        footer={<><button className="btn btn-outline-secondary" disabled={busy} onClick={() => setSheet(null)}>Batal</button><button className={`btn ${K === 'batal' ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : K === 'batal' ? 'Ya, Batalkan' : 'Kirim'}</button></>}>
        <div className="d-flex flex-column gap-3">
          {K !== 'pay' && (
            <div>
              <label className="form-label" htmlFor="cs-note">{K === 'batal' ? 'Alasan Pembatalan' : K === 'ext' ? 'Alasan Perpanjangan' : K === 'bukti' ? 'Keterangan Perbaikan' : 'Tanggapan / Keterangan'}</label>
              <textarea id="cs-note" className="form-control" rows={3} value={note} onChange={(e) => changeNote(e.target.value)} />
              {K === 'ext' && <div className="form-text">Perpanjangan hanya dapat diajukan satu kali dan perlu disetujui PSU.</div>}
            </div>
          )}
          {K !== 'ext' && K !== 'batal' && (
            <div>
              <label className="form-label" htmlFor="cs-file">{K === 'pay' ? 'File Bukti Transfer' : K === 'bukti' ? 'Bukti Perbaikan' : st.code === 'ST-07' ? 'Unggah Tindakan Perbaikan' : 'Dokumen / Data yang Diminta'}</label>
              <FileDrop id="cs-file" multiple={K !== 'pay'} files={files} onChange={setFiles} />
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}

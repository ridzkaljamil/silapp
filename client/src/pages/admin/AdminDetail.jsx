/** Detail pengajuan sisi Admin: tombol aksi, keputusan, pop-up form. */
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { useAuth } from '../../AuthContext';
import { Loading, useToast, fmtDate, fmtDateTime, Sheet, Menu, FileDrop } from '../../components/ui';
import ApplicationView from '../../components/ApplicationView';
import { docWord } from '../../lib/constants';
import InvoiceForm from './detail/InvoiceForm';
import FindingsAdd from './detail/FindingsAdd';
import FindingReview from './detail/FindingReview';
import LabInfoForm from './detail/LabInfoForm';

const ACT = {
  setujui: { icon: 'check2-circle', ok: 'Ya, setujui' },
  minta_tindakan: { icon: 'arrow-return-left', title: 'Minta tindakan pelanggan', ok: 'Kirim permintaan' },
  abaikan: { icon: 'chat-left-text', title: 'Kirim catatan / lampiran', ok: 'Kirim' },
  tolak: { icon: 'x-octagon', title: 'Tolak & tutup pengajuan', ok: 'Ya, tutup pengajuan', danger: true },
};

export default function AdminDetail() {
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
  const dw = docWord(app.service_code);
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
      { label: `Unduh ${dw}`, icon: 'download', onClick: () => download(`/admin/applications/${id}/certificate`, `${app.certificate.certificate_no}.pdf`), hidden: !app.certificate?.has_file },
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
              <div className="col-md-6"><label className="form-label" htmlFor="cn">Nomor {dw}</label><input id="cn" className="form-control" value={f.certificate_no} onChange={(e) => setF({ ...f, certificate_no: e.target.value })} placeholder={app.service_code === 'SP' ? 'PSU-SPPT-2026-00125' : app.service_code === 'KAL' ? 'KAL/PSU/2026/00125' : 'LHU/PSU/2026/00125'} /></div>
              <div className="col-md-6"><label className="form-label" htmlFor="cf">File {dw} resmi (PDF)</label><FileDrop id="cf" accept=".pdf" files={certFile ? [certFile] : []} onChange={(l) => setCertFile(l[0])} label={`Pilih file ${dw}`} hint="PDF · maks. 10 MB" /></div>
              <div className="col-12 small text-muted2">Pelanggan wajib mengisi survei kepuasan sebelum dapat mengunduh {dw}.</div>
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

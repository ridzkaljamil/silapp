import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { StatusPill, SegProgress, StepsList, PageHead, fmtDate } from '../../components/ui';

/** Lacak dengan kode. inApp: tampil di dalam area login (sidebar tetap ada). */
export default function Lacak({ inApp = false }) {
  const [code, setCode] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setRes(null); setBusy(true); setAll(false);
    try { setRes((await api.get(`/public/track/${code.trim().toUpperCase()}`)).data); }
    catch (ex) { setErr(errMsg(ex)); }
    finally { setBusy(false); }
  };
  const cur = res?.steps.findIndex((s) => ['current', 'action', 'closed'].includes(s.state));
  const next = res && cur >= 0 ? res.steps.slice(cur + 1).find((s) => s.state === 'todo') : null;

  return (
    <div className="d-flex flex-column gap-4" style={inApp ? { maxWidth: 820 } : { maxWidth: 780, margin: '0 auto' }}>
      {inApp ? (
        <PageHead eyebrow="Pelacakan" title="Lacak kode" sub="Masukkan kode lacak (SLP-XXXX-XXXX) untuk melihat progres pengajuan, termasuk kode yang dibagikan rekan Anda." />
      ) : (
        <div className="hero">
          <span className="eyebrow" style={{ color: '#8A6410' }}>Tanpa login</span>
          <h1>Lacak status pengajuan Anda</h1>
          <p>Masukkan kode lacak yang dikirim ke email setelah pengajuan dibuat. Anda akan melihat tahap dan progres terkini.</p>
        </div>
      )}
      <form className="track-form" onSubmit={submit}>
        <label htmlFor="kode" className="visually-hidden">Kode lacak</label>
        <input id="kode" placeholder="SLP-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" />
        <button className="btn btn-primary" disabled={busy}><i className="bi bi-search" />{busy ? 'Mencari…' : 'Lacak'}</button>
      </form>

      {err && <div className="alert alert-danger mb-0"><b>Kode tidak ditemukan.</b> Periksa kembali kode lacak di email konfirmasi (format SLP-XXXX-XXXX).</div>}

      {res && (
        <section className="panel reveal">
          <div className="panel-h">
            <div><div className="small text-muted2">{res.service_name} · <span className="mono">{res.application_no}</span></div><h2 className="mb-0" style={{ fontSize: '1.2rem' }}>{res.status === 'selesai' ? 'Seluruh tahap selesai' : res.current_step.name}</h2></div>
            <StatusPill value={res.condition} />
          </div>
          <div className="panel-b d-flex flex-column gap-3">
            <div className="d-flex justify-content-between small"><b>{res.status === 'selesai' ? 'Selesai' : `Tahap ${cur + 1} dari ${res.steps.length}`}</b><span className="text-muted2">{res.progress}%</span></div>
            <SegProgress steps={res.steps} />
            <dl className="row g-3 mb-0 small">
              <div className="col-sm-4"><dt className="text-muted2 fw-normal">Pembaruan terakhir</dt><dd className="mb-0 fw-semibold">{fmtDate(res.last_update)}</dd></div>
              <div className="col-sm-4"><dt className="text-muted2 fw-normal">Tahap berikutnya</dt><dd className="mb-0 fw-semibold">{next ? next.name : '—'}</dd></div>
              <div className="col-sm-4"><dt className="text-muted2 fw-normal">{res.service_est ? 'Estimasi layanan' : 'Diajukan'}</dt><dd className="mb-0 fw-semibold">{res.service_est || fmtDate(res.created_at)}</dd></div>
            </dl>
            <button type="button" className="btn btn-link p-0 align-self-start fw-semibold" onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Sembunyikan tahap' : 'Lihat semua tahap'}</button>
            {all && <div className="reveal"><StepsList steps={res.steps} /></div>}
            {inApp ? (
              res.customer_action_needed && <div className="alert alert-warning small mb-0"><b>Ada tindakan yang perlu dilakukan pemohon.</b> Buka pengajuan ini dari menu <Link to="/klien/pengajuan" className="fw-bold">Pengajuan saya</Link>.</div>
            ) : (
              <div className={`alert ${res.customer_action_needed ? 'alert-warning' : 'alert-light border'} small mb-0`}>
                {res.customer_action_needed ? <><b>Ada tindakan yang perlu dilakukan pemohon.</b> </> : null}
                Untuk melihat detail, mengunggah dokumen, atau menanggapi permintaan PSU, silakan <Link to="/masuk" className="fw-bold">masuk ke akun Anda</Link>.
              </div>
            )}
          </div>
        </section>
      )}
      {!inApp && <p className="text-center small text-muted2 mb-0">Belum punya akun? Akun dibuat oleh PSU setelah kesepakatan layanan. <Link to="/layanan">Lihat layanan &amp; kontak</Link></p>}
    </div>
  );
}

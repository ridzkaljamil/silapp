import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { StatusPill, Progress, Stepper, fmtDate } from '../../components/ui';

export default function Lacak() {
  const [code, setCode] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setRes(null); setBusy(true);
    try { setRes((await api.get(`/public/track/${code.trim().toUpperCase()}`)).data); }
    catch (ex) { setErr(errMsg(ex)); }
    finally { setBusy(false); }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <section className="track-hero">
        <div className="eyebrow" style={{ color: 'var(--psu-gold)' }}>Lacak tanpa login</div>
        <h1 className="mt-1">Cek progres pengajuan Anda</h1>
        <p style={{ maxWidth: '60ch' }}>Masukkan kode lacak yang dikirim ke email setelah pengajuan dibuat. Anda akan melihat status dan persentase progres yang sedang berjalan.</p>
        <form className="d-flex flex-wrap gap-2 position-relative" style={{ zIndex: 1 }} onSubmit={submit}>
          <input className="form-control" placeholder="SLP-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Kode lacak" required />
          <button className="btn btn-gold" disabled={busy}><i className="bi bi-search me-1" />Lacak</button>
        </form>
      </section>

      {err && <div className="alert alert-danger mb-0"><b>Kode tidak ditemukan.</b> Periksa kembali kode lacak di email konfirmasi (format SLP-XXXX-XXXX).</div>}

      {res && (
        <section className="panel">
          <div className="panel-h">
            <div><div className="eyebrow">Hasil pelacakan · <span className="mono">{res.tracking_code}</span></div><h2 className="mb-0">{res.service_name}</h2></div>
            <StatusPill value={res.condition} />
          </div>
          <div className="panel-b d-flex flex-column gap-3">
            <Progress value={res.progress} big />
            <dl className="row mb-0 small">
              <dt className="col-sm-3 text-muted2 fw-normal">Status saat ini</dt><dd className="col-sm-9">{res.status === 'selesai' ? 'Seluruh tahap selesai' : `${res.current_step.code} · ${res.current_step.name}`}</dd>
              <dt className="col-sm-3 text-muted2 fw-normal">Diajukan</dt><dd className="col-sm-9">{fmtDate(res.created_at)}</dd>
              <dt className="col-sm-3 text-muted2 fw-normal">Update terakhir</dt><dd className="col-sm-9">{fmtDate(res.last_update)}</dd>
              <dt className="col-sm-3 text-muted2 fw-normal">Tindakan pelanggan</dt>
              <dd className="col-sm-9">{res.customer_action_needed ? <span className="text-warning-emphasis">Ada tindakan yang perlu dilakukan. Silakan masuk.</span> : 'Tidak ada tindakan yang diperlukan'}</dd>
            </dl>
            <Stepper steps={res.steps} />
            <div className="alert alert-light border mb-0 small">
              Lacak tanpa login hanya menampilkan progres. Untuk melihat detail, mengunggah dokumen, atau mengubah data, silakan <Link to="/masuk">masuk</Link>.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

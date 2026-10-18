import { Link } from 'react-router-dom';
import { fmtSaved } from './shared';

/** Kartu "Lanjutkan Draft" (juga dipakai di Beranda). */
export default function DraftCard({ d, onResume, onDiscard, to }) {
  const body = (
    <>
      <span className="ic"><i className="bi bi-pencil-square" /></span>
      <span className="tx"><b>Lanjutkan Draft Pengajuan</b><span>{d.service_name || d.service_code} · Langkah {d.stage} dari 4 · disimpan {fmtSaved(d.updated_at)}</span></span>
    </>
  );
  return (
    <div className="draft-card">
      {body}
      <span className="acts">
        {onDiscard && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDiscard}>Hapus Draft</button>}
        {to ? <Link to={to} className="btn btn-gold btn-sm">Lanjutkan</Link> : <button type="button" className="btn btn-gold btn-sm" onClick={onResume}>Lanjutkan</button>}
      </span>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { StatusPill, Progress, fmtDate } from './ui';

/** Tabel daftar pengajuan. base: '/klien/pengajuan' atau '/admin/pengajuan' */
export default function AppTable({ rows, base, showCompany }) {
  const nav = useNavigate();
  return (
    <div className="table-responsive">
      <table className="table table-hover mb-0 align-middle">
        <thead><tr><th>No. pengajuan</th>{showCompany && <th>Perusahaan</th>}<th>Layanan</th><th>Status saat ini</th><th>Progres</th><th>Kondisi</th><th>Diajukan</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((a) => (
            <tr key={a.id} className="clickable" onClick={() => nav(`${base}/${a.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`${base}/${a.id}`)}>
              <td><span className="mono">{a.application_no}</span><div className="small text-muted2">{a.product_label}</div></td>
              {showCompany && <td>{a.company_name}</td>}
              <td>{a.service_name}</td>
              <td className="small">{a.status === 'selesai' ? 'Selesai' : `${a.current_step.code} · ${a.current_step.name}`}</td>
              <td className="text-nowrap"><Progress value={a.progress} /></td>
              <td><StatusPill value={a.condition} /></td>
              <td className="num small">{fmtDate(a.created_at)}</td>
            </tr>
          )) : <tr><td colSpan={7} className="text-center text-muted2 py-4">Tidak ada pengajuan.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

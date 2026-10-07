import { Link, useNavigate } from 'react-router-dom';
import { StatusPill, Progress, fmtDate } from './ui';

/**
 * Daftar pengajuan: tabel di desktop, kartu di HP.
 * base: '/klien/pengajuan' atau '/admin/pengajuan'
 */
export default function AppTable({ rows, base, showCompany, empty = 'Tidak ada pengajuan.' }) {
  const nav = useNavigate();
  if (!rows.length) return <p className="text-center text-muted2 py-4 mb-0">{empty}</p>;
  const stepText = (a) => (a.status === 'selesai' ? 'Selesai' : a.current_step.name);
  return (
    <>
      <div className="app-table table-responsive">
        <table className="table table-hover align-middle">
          <thead><tr><th>Pengajuan</th>{showCompany && <th>Perusahaan</th>}<th>Tahap saat ini</th><th style={{ width: 170 }}>Progres</th><th>Status</th><th>Diajukan</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="clickable" onClick={() => nav(`${base}/${a.id}`)}>
                <td><Link to={`${base}/${a.id}`} className="fw-bold text-decoration-none text-body" onClick={(e) => e.stopPropagation()}>{a.product_label.split(' · ')[0]}</Link><span className="text-muted2"> · {a.service_name}</span><div className="mono small text-muted2">{a.application_no}</div></td>
                {showCompany && <td>{a.company_name}</td>}
                <td className="small"><span className="text-muted2">{a.status === 'selesai' ? '' : `${a.current_step.code} · `}</span>{stepText(a)}</td>
                <td><Progress value={a.progress} /></td>
                <td><StatusPill value={a.condition} /></td>
                <td className="small text-nowrap">{fmtDate(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="app-cards">
        {rows.map((a) => (
          <Link key={a.id} to={`${base}/${a.id}`} className="app-card">
            <div className="d-flex justify-content-between gap-2 align-items-start">
              <div style={{ minWidth: 0 }}><b>{a.product_label.split(' · ')[0]}</b><div className="small text-muted2">{a.service_name} · <span className="mono">{a.application_no}</span></div>{showCompany && <div className="small">{a.company_name}</div>}</div>
              <StatusPill value={a.condition} />
            </div>
            <div className="d-flex align-items-center gap-2 small"><span className="pbar flex-grow-1"><i style={{ width: `${a.progress}%` }} /></span>{a.progress}%</div>
            <div className="small text-muted2">{a.status === 'selesai' ? 'Selesai' : <>Tahap {a.current_step.index}/{a.current_step.total} · {a.current_step.name}</>}</div>
          </Link>
        ))}
      </div>
    </>
  );
}

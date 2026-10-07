import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { Loading, PageHead, fmtDate, CountUp } from '../../components/ui';

const Status = ({ v }) => <span className={`pill ${v === 'aktif' ? 'pill-done' : 'pill-closed'}`}>{v === 'aktif' ? 'Aktif' : 'Tidak aktif'}</span>;

/** Directory publik: perusahaan bersertifikat Sertifikasi Produk (SILAPP + proyek sebelum SILAPP). */
export default function Directory({ inApp = false, manageTo }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  useEffect(() => { api.get('/public/directory').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  const f = rows.filter((r) => (!st || r.status === st) && `${r.certificate_no} ${r.factory_name} ${r.product} ${r.sni_no} ${r.factory_address}`.toLowerCase().includes(q.toLowerCase()));
  const stats = (<>
    <div><div className="big-amount"><CountUp value={rows.filter((r) => r.status === 'aktif').length} /></div><div className="small text-muted2">aktif</div></div>
    <div><div className="big-amount"><CountUp value={rows.length} /></div><div className="small text-muted2">total data</div></div>
  </>);
  return (
    <div className="d-flex flex-column gap-4">
      {inApp ? (
        <PageHead eyebrow="Publik" title="Directory sertifikat" sub="Data ini juga tampil di halaman Directory publik (tanpa login).">
          <div className="d-flex gap-4 me-2">{stats}</div>
          {manageTo && <Link to={manageTo} className="btn btn-outline-secondary"><i className="bi bi-pencil-square" />Kelola data</Link>}
        </PageHead>
      ) : (
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-3">
          <div style={{ maxWidth: 640 }}>
            <h1 className="mb-2" style={{ fontSize: 'clamp(1.7rem,4vw,2.1rem)', letterSpacing: '-.03em' }}>Directory perusahaan bersertifikat</h1>
            <p className="text-muted2 mb-0">Sertifikat Produk Penggunaan Tanda SNI (SPPT SNI) yang diterbitkan LSPro PT Penilai Standar Uji.</p>
          </div>
          <div className="d-flex gap-4">{stats}</div>
        </div>
      )}

      <div className="d-flex gap-2 flex-wrap">
        <label className="d-flex align-items-center gap-2 bg-white border rounded-3 px-3 flex-grow-1" style={{ minHeight: 46, flexBasis: 320 }}>
          <i className="bi bi-search text-muted2" aria-hidden="true" />
          <input className="border-0 flex-grow-1 bg-transparent" style={{ outline: 0, minHeight: 44 }} placeholder="Cari nama pabrik, produk, nomor SNI atau sertifikat" aria-label="Cari" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Filter status">
          {[['', 'Semua'], ['aktif', 'Aktif'], ['tidak_aktif', 'Tidak aktif']].map(([v, l]) => <button key={v} aria-pressed={st === v} onClick={() => setSt(v)}>{l}</button>)}
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="app-table table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Nama pabrik</th><th>Produk</th><th>Nomor SNI</th><th>Nomor sertifikat</th><th>Terbit</th><th>Status</th></tr></thead>
            <tbody>
              {f.map((r) => (
                <tr key={r.certificate_no}><td><b>{r.factory_name}</b><div className="small text-muted2">{r.factory_address}</div></td><td>{r.product}</td><td className="mono">{r.sni_no}</td><td className="mono">{r.certificate_no}</td><td className="text-nowrap">{fmtDate(r.issued_at)}</td><td><Status v={r.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="app-cards">
          {f.map((r) => (
            <div key={r.certificate_no} className="app-card">
              <div className="d-flex justify-content-between gap-2"><b>{r.factory_name}</b><Status v={r.status} /></div>
              <div className="small text-muted2">{r.factory_address}</div>
              <div className="small">{r.product} · <span className="mono">{r.sni_no}</span></div>
              <div className="small text-muted2"><span className="mono">{r.certificate_no}</span> · terbit {fmtDate(r.issued_at)}</div>
            </div>
          ))}
        </div>
        {!f.length && <p className="text-center text-muted2 py-4 mb-0">Tidak ada data yang cocok.</p>}
      </section>
    </div>
  );
}

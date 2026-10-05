import { useEffect, useState } from 'react';
import api from '../../api';
import { PageHead, Loading, fmtDate } from '../../components/ui';

export default function Directory() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/public/directory').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  const f = rows.filter((r) => `${r.certificate_no} ${r.company_name} ${r.product_label}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead eyebrow="Directory publik" title="Sertifikat dan LHU yang telah terbit" sub="Hanya pengajuan yang sudah selesai, dengan data terbatas.">
        <input className="form-control" style={{ maxWidth: 260 }} placeholder="Cari perusahaan / nomor" value={q} onChange={(e) => setQ(e.target.value)} />
      </PageHead>
      <div className="panel table-responsive">
        <table className="table mb-0 align-middle">
          <thead><tr><th>No. sertifikat</th><th>Perusahaan</th><th>Layanan</th><th>Produk / lingkup</th><th>Terbit</th><th>Status</th></tr></thead>
          <tbody>
            {f.length ? f.map((r) => (
              <tr key={r.certificate_no}><td className="mono">{r.certificate_no}</td><td>{r.company_name}</td><td>{r.service_name}</td><td>{r.product_label}</td><td className="num">{fmtDate(r.issued_at)}</td>
                <td><span className={`pill ${r.status === 'active' ? 'pill-done' : 'pill-closed'}`}>{r.status === 'active' ? 'Active' : r.status}</span></td></tr>
            )) : <tr><td colSpan={6} className="text-center text-muted2 py-4">Belum ada data.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

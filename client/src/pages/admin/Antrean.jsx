/** Antrean pengajuan sesuai bidang Admin. */
import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, Select } from '../../components/ui';
import AppTable from '../../components/AppTable';
import { BIDANG } from '../../lib/constants';

export default function Antrean() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => api.get('/admin/applications', { params: { status: status || undefined, q: q || undefined } }).then((r) => setRows(r.data)), 250);
    return () => clearTimeout(t);
  }, [status, q]);
  return (
    <>
      <PageHead eyebrow={`Antrean · ${user.role === 'superadmin' ? 'semua bidang' : BIDANG[user.bidang]}`} title={user.role === 'superadmin' ? 'Semua pengajuan masuk' : 'Pengajuan di bidang Anda'}
        sub={user.role === 'superadmin' ? 'Super Admin melihat semua bidang.' : 'Admin hanya melihat pengajuan sesuai bidangnya.'} />
      <section className="panel">
        <div className="panel-h">
          <input className="form-control search-input" placeholder="Cari no. pengajuan / perusahaan / produk" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="form-select" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter kondisi">
            <option value="">Semua kondisi</option><option value="aktif">On Progress</option><option value="aksi">Action Required</option><option value="ditolak">Closed</option><option value="selesai">Selesai</option>
          </Select>
        </div>
        {rows ? <AppTable rows={rows} base="/admin/pengajuan" showCompany /> : <Loading />}
      </section>
    </>
  );
}

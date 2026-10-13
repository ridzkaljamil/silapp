/** Riwayat semua pengajuan pelanggan. */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { Paged, PageHead, Loading, DataToolbar, matchText } from '../../components/ui';
import AppTable from '../../components/AppTable';
import { SERVICES, CONDITIONS, matchCondition } from '../../lib/constants';

export default function PengajuanList() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ status: '', service: '' });
  const load = useCallback(() => api.get('/applications').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);
  if (!rows) return <Loading />;
  const list = rows.filter((a) => matchText(q, a.application_no, a.product_label, a.service_name, a.tracking_code)
    && matchCondition(a, flt.status) && (!flt.service || a.service_code === flt.service));
  const used = [...new Set(rows.map((a) => a.service_code))];
  const filters = [
    { key: 'status', label: 'Kondisi', options: CONDITIONS.filter(([k]) => rows.some((a) => matchCondition(a, k))) },
    { key: 'service', label: 'Layanan', options: Object.entries(SERVICES).filter(([k]) => used.includes(k)) },
  ];
  return (
    <>
      <PageHead eyebrow="Pengajuan Saya" title="Riwayat Pengajuan" sub="Semua pengajuan layanan perusahaan Anda, yang masih berjalan maupun yang sudah selesai.">
        <Link to="/klien/ajukan" className="btn btn-primary"><i className="bi bi-plus-lg" />Ajukan Layanan</Link>
      </PageHead>
      <section className="panel">
        {rows.length > 0 && <DataToolbar q={q} onQ={setQ} placeholder="Cari pengajuan" filters={filters} values={flt} onFilter={setFlt} shown={list.length} total={rows.length} unit="pengajuan" />}
        <Paged list={list} unit="pengajuan">{(page) => (<>
<AppTable rows={page} base="/klien/pengajuan" empty={rows.length ? 'Tidak ada pengajuan yang cocok dengan pencarian atau filter.' : 'Belum ada pengajuan. Ajukan layanan pertama Anda lewat tombol di atas.'} />
</>)}</Paged>
      </section>
    </>
  );
}

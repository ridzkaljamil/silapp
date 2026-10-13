/** Antrean pengajuan sesuai bidang Admin. */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAuth } from '../../AuthContext';
import { usePaged, Pager, PageHead, Loading, DataToolbar } from '../../components/ui';
import AppTable from '../../components/AppTable';
import { BIDANG, SERVICES, SERVICE_BIDANG, CONDITIONS } from '../../lib/constants';

export default function Antrean() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [params] = useSearchParams();
  // filter awal bisa datang dari tautan dashboard / cari global (?status=berjalan, ?service=KIM)
  const [flt, setFlt] = useState({ status: params.get('status') || '', service: params.get('service') || '' });
  useEffect(() => { setFlt({ status: params.get('status') || '', service: params.get('service') || '' }); }, [params]);
  const services = user.role === 'superadmin' ? Object.keys(SERVICES) : SERVICE_BIDANG[user.bidang] || [];
  const filtered = !!(q.trim() || flt.status || flt.service);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useLiveRefresh(() => setTick((x) => x + 1));
  useEffect(() => {
    // pencarian dikirim ke server sedikit tertunda agar tidak memanggil API di setiap ketikan
    const t = setTimeout(() => {
      const qp = { condition: flt.status || undefined, service: flt.service || undefined, q: q.trim() || undefined };
      api.get('/admin/applications', { params: qp }).then((r) => { setRows(r.data); if (!filtered) setTotal(r.data.length); });
      if (filtered && !loaded) { setLoaded(true); api.get('/admin/applications').then((r) => setTotal(r.data.length)); }
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, flt.status, flt.service, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const pg = usePaged(rows || []);
  const filters = [
    { key: 'status', label: 'Kondisi', options: CONDITIONS },
    { key: 'service', label: 'Layanan', options: services.map((k) => [k, SERVICES[k]]) },
  ];
  return (
    <>
      <PageHead eyebrow="Operasional" title="Antrean Pengajuan"
        sub={user.role === 'superadmin' ? 'Daftar seluruh pengajuan yang masuk dari semua bidang. Buka pengajuan untuk memeriksa berkas dan memproses tahap berikutnya.' : `Daftar pengajuan di bidang ${BIDANG[user.bidang]} yang perlu diproses. Buka pengajuan untuk memeriksa berkas dan melanjutkan ke tahap berikutnya.`} />
      <section className="panel">
        <DataToolbar q={q} onQ={setQ} placeholder="Cari pengajuan" filters={filters} values={flt} onFilter={setFlt}
          shown={rows?.length ?? 0} total={total} unit="pengajuan" />
        {rows ? <><AppTable rows={pg.items} base="/admin/pengajuan" showCompany empty={filtered ? 'Tidak ada pengajuan yang cocok dengan pencarian atau filter.' : 'Belum ada pengajuan.'} /><Pager p={pg} unit="pengajuan" /></> : <Loading />}
      </section>
    </>
  );
}

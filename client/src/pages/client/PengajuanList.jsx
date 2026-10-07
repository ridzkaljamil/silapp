/** Riwayat semua pengajuan pelanggan. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { PageHead, Loading } from '../../components/ui';
import AppTable from '../../components/AppTable';

export default function PengajuanList() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/applications').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  return (
    <>
      <PageHead eyebrow="Pengajuan saya" title="Riwayat pengajuan" sub="Semua pengajuan layanan perusahaan Anda.">
        <Link to="/klien/ajukan" className="btn btn-primary"><i className="bi bi-plus-lg" />Ajukan layanan</Link>
      </PageHead>
      <section className="panel"><AppTable rows={rows} base="/klien/pengajuan" /></section>
    </>
  );
}

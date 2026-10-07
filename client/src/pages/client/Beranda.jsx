/** Beranda pelanggan: tugas yang perlu dilakukan + daftar pengajuan. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { download } from '../../api';
import { useAuth } from '../../AuthContext';
import { Loading, rupiah, fmtDate } from '../../components/ui';
import AppTable from '../../components/AppTable';
import { docWord } from '../../lib/constants';

const dayDiff = (d) => (d ? Math.round((new Date(`${d}T00:00:00`) - new Date(new Date().toDateString())) / 86400000) : null);

export default function Beranda() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('jalan');
  useEffect(() => { api.get('/applications').then((r) => setRows(r.data)); }, []);
  if (!rows) return <Loading />;
  const todo = rows.flatMap((a) => {
    const name = a.product_label.split(' · ')[0];
    const meta = `${name} · ${a.application_no}`;
    if (a.status === 'aksi') return [{ a, ic: 'exclamation-lg', cls: 'ic-warn', pill: ['pill-action', 'Permintaan PSU'], t: 'Tanggapi permintaan PSU', s: meta }];
    if (a.open_findings > 0 && a.finding_due) {
      const n = dayDiff(a.finding_due);
      const left = n < 0 ? `terlambat ${-n} hari` : `sisa ${n} hari`;
      return [{ a, ic: 'clock-history', cls: 'ic-warn', pill: ['pill-action', `Temuan audit · ${left}`], t: 'Kirim bukti perbaikan temuan', s: meta, m: <>{name} · tenggat {fmtDate(a.finding_due)} · <b className="text-warn">{left}</b></> }];
    }
    if (a.condition === 'Waiting for Payment' && a.payment_status === 'invoice') return [{ a, ic: 'credit-card', cls: 'ic-info', pill: ['pill-progress', `Invoice · ${rupiah(a.pay_amount)}`], t: 'Bayar dan unggah bukti transfer', s: meta, m: `${name} · ${rupiah(a.pay_amount)}` }];
    if (a.status === 'selesai' && !a.survey_done) return [{ a, ic: 'download', cls: 'ic-ok', pill: ['pill-done', `${docWord(a.service_code, true)} terbit`], t: 'Isi survei & unduh dokumen', s: meta, m: `${name} · dokumen telah terbit` }];
    return [];
  });
  const jalan = rows.filter((a) => !['selesai', 'ditolak'].includes(a.status));
  const selesai = rows.filter((a) => ['selesai', 'ditolak'].includes(a.status));
  const hari = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <div className="page-head home-head">
        <div><div className="small text-muted2">{hari}</div><h1>Selamat datang, {user.name.split(' ')[0]}</h1></div>
        <Link to="/klien/ajukan" className="btn btn-primary home-cta"><i className="bi bi-plus-lg" />Ajukan layanan</Link>
      </div>
      {todo.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2">Perlu tindakan Anda <span className="text-muted2 fw-normal">· {todo.length}</span></h2>
          <div className="todo-cards">
            {todo.map((x) => (
              <Link key={x.a.id} to={`/klien/pengajuan/${x.a.id}`} className="todo-card">
                <span className={`pill ${x.pill[0]}`}>{x.pill[1]}</span>
                <b>{x.t}</b>
                <span className="small text-muted2">{x.s}</span>
              </Link>
            ))}
          </div>
          <div className="panel todo-list todo-list-m">
            {todo.map((x) => (
              <Link key={x.a.id} to={`/klien/pengajuan/${x.a.id}`} className="todo-item">
                <span className={`ic ${x.cls}`}><i className={`bi bi-${x.ic}`} /></span>
                <span className="tx"><b>{x.t}</b><span>{x.m || x.s}</span></span>
                <i className="bi bi-chevron-right text-muted2" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="panel mb-4">
        <div className="panel-h">
          <h2 className="mb-0">Pengajuan saya</h2>
          <div className="segmented" role="group" aria-label="Filter">
            <button aria-pressed={tab === 'jalan'} onClick={() => setTab('jalan')}>Berjalan · {jalan.length}</button>
            <button aria-pressed={tab === 'selesai'} onClick={() => setTab('selesai')}>Selesai · {selesai.length}</button>
          </div>
        </div>
        <AppTable rows={tab === 'jalan' ? jalan : selesai} base="/klien/pengajuan" empty={tab === 'jalan' ? 'Belum ada pengajuan berjalan.' : 'Belum ada pengajuan selesai.'} />
      </section>
      <div className="help-cards">
        <Link to="/klien/lacak" className="help-card"><span className="ic"><i className="bi bi-search" /></span><span><b>Lacak dengan kode</b><span>Bagikan kode lacak ke tim Anda, bisa dibuka tanpa login</span></span></Link>
        <Link to="/layanan" className="help-card"><span className="ic"><i className="bi bi-telephone" /></span><span><b>Butuh bantuan?</b><span>Hubungi contact person layanan PSU</span></span></Link>
      </div>
    </>
  );
}

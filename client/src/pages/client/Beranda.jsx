/** Beranda pelanggan: tugas yang perlu dilakukan + daftar pengajuan. */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAuth } from '../../AuthContext';
import { Loading, rupiah, fmtDate, useConfirm } from '../../components/ui';
import AppTable from '../../components/AppTable';
import { docWord } from '../../lib/constants';
import { useContact, waLink } from '../../lib/contact';
import DraftCard from './ajukan/DraftCard';

const dayDiff = (d) => (d ? Math.round((new Date(`${d}T00:00:00`) - new Date(new Date().toDateString())) / 86400000) : null);

export default function Beranda() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('jalan');
  const [draft, setDraft] = useState(null);
  const contact = useContact();
  const confirm = useConfirm();
  const load = useCallback(() => api.get('/applications').then((r) => setRows(r.data)), []);
  useEffect(() => {
    load();
    api.get('/drafts').then((r) => setDraft(r.data)).catch(() => {});
  }, [load]);
  useLiveRefresh(load);
  const discard = async () => {
    if (!(await confirm({ title: 'Hapus Draft?', body: 'Isian pengajuan yang tersimpan akan dihapus dan tidak dapat dikembalikan.', ok: 'Hapus Draft', danger: true, icon: 'trash' }))) return;
    api.delete('/drafts').then(() => setDraft(null)).catch(() => {});
  };
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
    if (a.condition === 'Waiting for Payment' && a.payment_status === 'invoice') return [{ a, ic: 'credit-card', cls: 'ic-info', pill: ['pill-progress', `Proforma Invoice · ${rupiah(a.pay_amount)}`], t: 'Bayar dan unggah bukti transfer', s: meta, m: `${name} · ${rupiah(a.pay_amount)}` }];
    if (a.current_step.is_billing_step && a.billing?.sent && ['belum', 'ditolak'].includes(a.billing.pay)) return [{ a, ic: 'credit-card', cls: 'ic-info', pill: ['pill-progress', 'Invoice & Faktur'], t: 'Lakukan pelunasan dan unggah bukti bayar', s: meta, m: `${name} · ${docWord(a.service_code, true)} dapat diunduh setelah lunas` }];
    if (a.current_step.is_billing_step && a.billing?.sent && ['belum', 'ditolak'].includes(a.billing.cut) && a.survey_done) return [{ a, ic: 'file-earmark-text', cls: 'ic-info', pill: ['pill-progress', 'Bukti potong PPh 23'], t: 'Unggah bukti potong PPh 23', s: meta, m: `${name} · boleh menyusul` }];
    if (a.work_done && !a.survey_done) return [{ a, survey: true, ic: 'download', cls: 'ic-ok', pill: ['pill-done', `${docWord(a.service_code, true)} terbit`], t: 'Isi survei & unduh dokumen', s: meta, m: `${name} · dokumen telah terbit` }];
    return [];
  });
  const jalan = rows.filter((a) => !['selesai', 'ditolak'].includes(a.status));
  const selesai = rows.filter((a) => ['selesai', 'ditolak'].includes(a.status));
  const hari = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <div className="page-head home-head">
        <div><div className="small text-muted2">{hari}</div><h1>Selamat Datang, {user.name.split(' ')[0]}</h1></div>
        <Link to="/klien/ajukan" className="btn btn-primary home-cta"><i className="bi bi-plus-lg" />Ajukan Layanan</Link>
      </div>
      {draft && <DraftCard d={draft} to="/klien/ajukan?draft=1" onDiscard={discard} />}
      {todo.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2">Perlu Tindakan Anda <span className="text-muted2 fw-normal">· {todo.length}</span></h2>
          <div className="todo-cards">
            {todo.map((x) => (
              <Link key={x.a.id} to={`/klien/pengajuan/${x.a.id}${x.survey ? '#survei' : ''}`} className="todo-card">
                <span className={`pill ${x.pill[0]}`}>{x.pill[1]}</span>
                <b>{x.t}</b>
                <span className="small text-muted2">{x.s}</span>
              </Link>
            ))}
          </div>
          <div className="panel todo-list todo-list-m">
            {todo.map((x) => (
              <Link key={x.a.id} to={`/klien/pengajuan/${x.a.id}${x.survey ? '#survei' : ''}`} className="todo-item">
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
          <h2 className="mb-0">Pengajuan Terbaru</h2>
          <div className="segmented" role="group" aria-label="Filter">
            <button aria-pressed={tab === 'jalan'} onClick={() => setTab('jalan')}>Berjalan · {jalan.length}</button>
            <button aria-pressed={tab === 'selesai'} onClick={() => setTab('selesai')}>Selesai · {selesai.length}</button>
          </div>
        </div>
        <AppTable rows={(tab === 'jalan' ? jalan : selesai).slice(0, 5)} base="/klien/pengajuan" empty={tab === 'jalan' ? 'Belum ada pengajuan berjalan.' : 'Belum ada pengajuan selesai.'} />
        {(tab === 'jalan' ? jalan : selesai).length > 5 && (
          <div className="panel-f justify-content-center"><Link to="/klien/pengajuan" className="btn btn-link fw-semibold">Lihat Semua Pengajuan ({rows.length})<i className="bi bi-arrow-right" /></Link></div>
        )}
      </section>
      <div className="help-cards">
        <Link to="/klien/template" className="help-card"><span className="ic"><i className="bi bi-file-earmark-word" /></span><span><b>Template Dokumen</b><span>Unduh surat permohonan dan pernyataan sebelum mengajukan</span></span></Link>
        <a href={waLink(contact.phone, 'Halo PSU, saya butuh bantuan terkait pengajuan di SILAPP.')} target="_blank" rel="noreferrer" className="help-card"><span className="ic"><i className="bi bi-whatsapp" /></span><span><b>Butuh bantuan?</b><span>Chat tim PSU lewat WhatsApp</span></span></a>
      </div>
    </>
  );
}

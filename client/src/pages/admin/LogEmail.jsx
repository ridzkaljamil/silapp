/** Log Email (Super Admin): email yang dikirim SILAPP, status pengiriman, dan kirim ulang yang gagal. */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { Paged, PageHead, Loading, useToast, useConfirm, fmtDateTime, MobileList, DataToolbar, matchText } from '../../components/ui';

const STATUS = { terkirim: ['pill-done', 'Terkirim'], gagal: ['pill-closed', 'Gagal'], antri: ['pill-progress', 'Dalam Antrean'], dilewati: ['pill-neutral', 'Tidak Dikirim (SMTP Belum Diatur)'] };
const Pill = ({ v }) => { const [c, l] = STATUS[v] || STATUS.antri; return <span className={`pill ${c}`}>{l}</span>; };

export default function LogEmail() {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState(null);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ status: '' });
  const load = useCallback(() => api.get('/superadmin/emails').then((r) => setD(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Loading />;
  const resend = async (r) => {
    if (!(await confirm({ title: 'Kirim Ulang Email?', body: <>Email <b>{r.subject}</b> dikirim ulang ke <b>{r.to_addr}</b>.</>, ok: 'Ya, Kirim Ulang', icon: 'send' }))) return;
    try { await api.post(`/superadmin/emails/${r.id}/resend`); toast('Email terkirim.'); } catch (ex) { toast(errMsg(ex), 'danger'); }
    load();
  };
  const list = d.rows.filter((r) => matchText(q, r.to_addr, r.subject) && (!flt.status || r.status === flt.status));
  const empty = d.rows.length ? 'Tidak ada email yang cocok dengan pencarian atau filter.' : 'Belum ada email yang dikirim.';
  const filters = [{ key: 'status', label: 'Status', options: Object.entries(STATUS).filter(([k]) => d.counts[k]).map(([k, [, l]]) => [k, `${l} (${d.counts[k]})`]) }];
  const why = (r) => r.last_error || (r.status === 'dilewati' ? 'SMTP belum diatur di server.' : '');
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Log Email"
        sub={`Email notifikasi yang dikirim SILAPP (90 hari terakhir). Email yang gagal dicoba ulang otomatis hingga ${d.max_attempts} kali dalam ${d.retry_days} hari; bisa juga dikirim ulang dari sini. Email berisi kata sandi tidak disimpan isinya, jadi tidak bisa dikirim ulang — ulangi reset kata sandinya.`} />
      {!d.smtp && <div className="alert alert-warning">SMTP belum diatur di server (SMTP_HOST kosong), jadi email belum benar-benar dikirim. Isi pengaturan SMTP di file .env / Environment Variables, lalu restart aplikasi.</div>}
      <section className="panel">
        <DataToolbar q={q} onQ={setQ} placeholder="Cari penerima atau subjek" filters={filters} values={flt} onFilter={setFlt} shown={list.length} total={d.rows.length} unit="email" />
        <Paged list={list} unit="email">{(page) => (<>
          <MobileList items={page} empty={empty} row={(r) => ({
            key: r.id, title: r.subject, sub: r.to_addr, pills: [STATUS[r.status] || STATUS.antri],
            detail: {
              rows: [['Penerima', r.to_addr], ['Dibuat', fmtDateTime(r.created_at)], ['Terkirim', r.sent_at && fmtDateTime(r.sent_at)], ['Percobaan', String(r.attempts)], ['Lampiran', r.has_attachment ? 'Ada' : null], ['Keterangan', why(r)]],
              actions: [{ label: 'Kirim Ulang', icon: 'send', primary: true, hidden: !r.can_resend, onClick: () => resend(r) }],
            },
          })} />
          <div className="table-responsive d-only">
            <table className="table mb-0 align-middle small">
              <thead><tr><th>Waktu</th><th>Penerima</th><th>Subjek</th><th>Status</th><th>Keterangan</th><th></th></tr></thead>
              <tbody>{page.map((r) => (
                <tr key={r.id}>
                  <td className="num text-nowrap">{fmtDateTime(r.created_at)}</td>
                  <td>{r.to_addr}</td>
                  <td>{r.subject}{r.has_attachment && <i className="bi bi-paperclip ms-1 text-muted2" title="Dengan lampiran" />}</td>
                  <td><Pill v={r.status} />{r.attempts > 1 && <div className="text-muted2">{r.attempts} percobaan</div>}</td>
                  <td className="text-muted2" style={{ maxWidth: 280 }}>{why(r) || (r.sent_at ? `Terkirim ${fmtDateTime(r.sent_at)}` : '')}</td>
                  <td className="text-end">{r.can_resend && <button className="btn btn-sm btn-outline-secondary text-nowrap" onClick={() => resend(r)}><i className="bi bi-send" />Kirim Ulang</button>}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="text-center text-muted2 py-4">{empty}</td></tr>}</tbody>
            </table>
          </div>
        </>)}</Paged>
      </section>
    </>
  );
}

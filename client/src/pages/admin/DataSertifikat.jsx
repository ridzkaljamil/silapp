/** Data sertifikat: hasil SILAPP + proyek sebelum SILAPP (tampil di Directory). */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { Paged, PageHead, Loading, useToast, useConfirm, fmtDate, fmtDateTime, todayYmd, MobileList, Select, FormSheet, DataToolbar, matchText } from '../../components/ui';
import { CERT_STATE, CERT_STATUS } from '../../lib/constants';

const LEG = { id: null, source: 'lama', factory_name: '', factory_address: '', product: '', sni_no: '', certificate_no: '', issued_at: '', expires_at: '', status: 'aktif', show_in_directory: true, reason: '', orig_status: 'aktif' };
const StatusCert = ({ v }) => { const [cls, label] = CERT_STATE[v] || CERT_STATE.aktif; return <span className={`pill ${cls}`}>{label}</span>; };
/** Isian proyek lama; sertifikat SILAPP hanya bisa mengubah tanggal & status (data lain mengikuti pengajuannya). */
const HIST = { terbit: 'Terbit / ditambahkan', status: 'Status diubah', ubah: 'Data diubah', tampil: 'Directory' };
const F = [['factory_name', 'Nama Pabrik'], ['factory_address', 'Alamat Pabrik (Kota/Provinsi)'], ['product', 'Produk'], ['sni_no', 'Nomor SNI'], ['certificate_no', 'Nomor Sertifikat']];

export default function DataSertifikat() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ state: '', source: '' });
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState(null);
  const load = useCallback(() => api.get('/certificates').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  // riwayat sertifikat yang sedang diubah
  const histKey = form?.id ? `${form.source === 'silapp' ? 'silapp' : 'legacy'}/${form.id}` : null;
  useEffect(() => {
    setHist(null);
    if (histKey) api.get(`/certificates/${histKey}/history`).then((r) => setHist(r.data)).catch(() => setHist([]));
  }, [histKey]);
  if (!rows) return <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const isNew = form && !form.id;
  const silapp = form?.source === 'silapp';
  // alasan wajib bila status diubah menjadi Ditangguhkan / Dicabut
  const needReason = !!form && form.status !== 'aktif' && form.status !== form.orig_status;
  const save = async () => {
    setBusy(true);
    try {
      if (silapp) await api.put(`/certificates/silapp/${form.id}`, form);
      else if (form.id) await api.put(`/certificates/legacy/${form.id}`, form);
      else await api.post('/certificates/legacy', form);
      toast('Data sertifikat disimpan.'); setForm(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const del = async (r) => {
    if (!(await confirm({ title: 'Hapus Data?', body: <>Hapus sertifikat <b>{r.certificate_no}</b> dari data proyek lama?</>, ok: 'Hapus', danger: true }))) return;
    await api.delete(`/certificates/legacy/${r.id}`); load();
  };
  const edit = (r) => setForm({ ...r, expires_at: r.expires_at || '', reason: '', orig_status: r.status });
  const list = rows.filter((r) => matchText(q, r.certificate_no, r.factory_name, r.factory_address, r.product, r.sni_no, r.application_no)
    && (!flt.state || r.state === flt.state) && (!flt.source || r.source === flt.source));
  const empty = rows.length ? 'Tidak ada sertifikat yang cocok dengan pencarian atau filter.' : 'Belum ada data sertifikat.';
  const filters = [
    { key: 'state', label: 'Status', options: Object.entries(CERT_STATE).map(([k, [, l]]) => [k, l]) },
    { key: 'source', label: 'Sumber', options: [['silapp', 'SILAPP'], ['lama', 'Sebelum SILAPP']] },
  ];
  const statusLabel = (v) => CERT_STATUS.find((x) => x[0] === v)?.[1];
  return (
    <>
      <PageHead eyebrow="Operasional" title="Data Sertifikat"
        sub="Daftar SPPT SNI yang sudah terbit, baik lewat SILAPP maupun dari proyek sebelum SILAPP, beserta masa berlaku dan statusnya. Sertifikat yang melewati tanggal berakhir otomatis berstatus Berakhir.">
        <Link to="/admin/directory" className="btn btn-outline-secondary"><i className="bi bi-journal-text" />Lihat Tampilan Directory</Link>
        <button className="btn btn-primary" onClick={() => setForm({ ...LEG })}><i className="bi bi-plus-lg" />Tambah Proyek Lama</button>
      </PageHead>
      <FormSheet open={!!form} onClose={() => setForm(null)} onSubmit={save} busy={busy} wide icon={isNew ? 'patch-plus' : 'pencil-square'}
        confirm={() => ({ title: 'Simpan Data Sertifikat?', body: <>Sertifikat <b>{form?.certificate_no || 'ini'}</b> {form?.show_in_directory ? 'tampil di Directory' : <>disimpan <b>tanpa tampil</b> di Directory</>} dengan status <b>{statusLabel(form?.status)}</b>, berlaku sampai <b>{fmtDate(form?.expires_at)}</b>.{silapp && form?.status !== form?.orig_status && <> Pelanggan akan diberi tahu lewat notifikasi dan email.</>}</> })}
        title={silapp ? 'Ubah Sertifikat SILAPP' : form?.id ? 'Ubah Proyek Lama' : 'Tambah Proyek Sebelum SILAPP'}
        sub={silapp ? <>{form.factory_name} · <span className="mono">{form.certificate_no}</span> ({form.application_no})</> : 'Sertifikat yang terbit sebelum SILAPP dipakai, agar tetap tampil di Directory.'}>
        {form && (
          <div className="row g-3">
            {!silapp && F.map(([k, l]) => <div className="col-md-6" key={k}><label className="form-label" htmlFor={`l-${k}`}>{l}</label><input id={`l-${k}`} className="form-control" value={form[k] || ''} onChange={set(k)} required /></div>)}
            <div className="col-md-6"><label className="form-label" htmlFor="l-is">Tanggal Terbit</label><input id="l-is" type="date" className="form-control" max={todayYmd()} value={form.issued_at || ''} onChange={set('issued_at')} required /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="l-ex">Tanggal Berakhir</label><input id="l-ex" type="date" className="form-control" min={form.issued_at || undefined} value={form.expires_at || ''} onChange={set('expires_at')} required /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="l-st">Status</label>
              <Select id="l-st" className="form-select" value={form.status} onChange={set('status')}>{CERT_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              <div className="form-text">Ditangguhkan: dibekukan sementara. Dicabut: tidak berlaku lagi karena sanksi{silapp ? ', file tidak bisa diunduh pelanggan' : ''}. Status Berakhir muncul otomatis setelah tanggal berakhir lewat.</div>
            </div>
            <div className="col-md-6 d-flex align-items-center">
              <div className="form-check"><input id="l-show" type="checkbox" className="form-check-input" checked={!!form.show_in_directory} onChange={set('show_in_directory')} /><label htmlFor="l-show" className="form-check-label">Tampilkan di Directory publik</label></div>
            </div>
            {needReason && (
              <div className="col-12"><label className="form-label" htmlFor="l-rs">Alasan {statusLabel(form.status)?.toLowerCase()}</label>
                <textarea id="l-rs" className="form-control" rows={2} minLength={5} maxLength={2000} value={form.reason} onChange={set('reason')} placeholder="mis. Hasil surveilan tidak sesuai, keputusan Komite Sertifikasi No. …" required />
                <div className="form-text">Dicatat di riwayat sertifikat{silapp ? ' dan disampaikan ke pelanggan' : ''}.</div>
              </div>
            )}
            {form.id && (
              <div className="col-12">
                <div className="form-label mb-1">Riwayat</div>
                {!hist ? <p className="text-muted2 small mb-0">Memuat riwayat…</p> : !hist.length ? <p className="text-muted2 small mb-0">Belum ada riwayat (data dibuat sebelum fitur riwayat).</p> : (
                  <ul className="log">
                    {hist.map((h) => (
                      <li key={h.id}>
                        <div style={{ minWidth: 0 }}>
                          <div><b>{HIST[h.action]}{h.action === 'status' && h.status ? `: ${statusLabel(h.status)}` : ''}</b></div>
                          {h.note && <div className="small" style={{ whiteSpace: 'pre-line' }}>{h.note}</div>}
                          <div className="meta">{fmtDateTime(h.created_at)} · {h.pic_label}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </FormSheet>
      <section className="panel">
        <DataToolbar q={q} onQ={setQ} placeholder="Cari pabrik atau nomor" filters={filters} values={flt} onFilter={setFlt} shown={list.length} total={rows.length} unit="sertifikat" />
        <Paged list={list} unit="sertifikat">{(page) => (<>
<MobileList items={page} empty={empty} row={(r) => ({
          key: `${r.source}-${r.id}`, title: r.factory_name, sub: `${r.product} · ${r.sni_no}`,
          pills: [CERT_STATE[r.state] || CERT_STATE.aktif, r.source === 'silapp' ? ['pill-progress', 'SILAPP'] : ['pill-neutral', 'Sebelum SILAPP'], ...(r.show_in_directory ? [] : [['pill-neutral', 'Tidak di Directory']])],
          detail: {
            rows: [['Alamat', r.factory_address], ['Produk', r.product], ['Nomor SNI', <span className="mono">{r.sni_no}</span>], ['No. Sertifikat', <span className="mono">{r.certificate_no}</span>],
              ['Terbit', fmtDate(r.issued_at)], ['Berlaku s.d.', fmtDate(r.expires_at)], ['Pengajuan', r.application_no && <span className="mono">{r.application_no}</span>]],
            actions: [
              { label: 'Ubah', icon: 'pencil', onClick: () => edit(r) },
              { label: 'Hapus', icon: 'trash', danger: true, hidden: r.source !== 'lama', onClick: () => del(r) },
            ],
          },
        })} />
        <div className="table-responsive d-only">
          <table className="table mb-0 align-middle small">
            <thead><tr><th>Nama Pabrik</th><th>Produk</th><th>No. SNI</th><th>No. Sertifikat</th><th>Terbit</th><th>Berlaku s.d.</th><th>Status</th><th>Sumber</th><th></th></tr></thead>
            <tbody>{page.map((r) => (
              <tr key={`${r.source}-${r.id}`}>
                <td>{r.factory_name}<div className="text-muted2">{r.factory_address}</div></td><td>{r.product}</td><td className="mono">{r.sni_no}</td><td className="mono">{r.certificate_no}</td>
                <td className="num text-nowrap">{fmtDate(r.issued_at)}</td><td className="num text-nowrap">{fmtDate(r.expires_at)}</td><td><StatusCert v={r.state} />{!r.show_in_directory && <div className="text-muted2 text-nowrap"><i className="bi bi-eye-slash me-1" />Tidak di Directory</div>}</td>
                <td>{r.source === 'silapp' ? <span className="text-nowrap">SILAPP<div className="text-muted2">{r.application_no}</div></span> : 'Sebelum SILAPP'}</td>
                <td className="text-nowrap text-end">
                  <button className="btn btn-sm btn-outline-secondary" title="Ubah" aria-label={`Ubah ${r.certificate_no}`} onClick={() => edit(r)}><i className="bi bi-pencil" /></button>
                  {r.source === 'lama' && <button className="btn btn-sm btn-outline-danger ms-1" title="Hapus" aria-label={`Hapus ${r.certificate_no}`} onClick={() => del(r)}><i className="bi bi-trash" /></button>}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9} className="text-center text-muted2 py-4">{empty}</td></tr>}</tbody>
          </table>
        </div>
</>)}</Paged>
      </section>
    </>
  );
}

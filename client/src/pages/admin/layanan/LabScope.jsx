/**
 * Ruang lingkup & harga satu laboratorium pengujian (Super Admin): produk, parameter uji, dan harganya.
 * Lab Kimia: Reguler/Ekspress · Lab Fisika: Dalam/Luar Negeri · Lab Mikrobiologi: satu harga.
 * Harga dipakai untuk perkiraan biaya saat pelanggan mengajukan dan untuk invoice (belum termasuk PPN).
 */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../../api';
import { Loading, useToast, useConfirm, rupiah, MobileList, FormSheet, DataToolbar, matchText, MoneyInput } from '../../../components/ui';
import { PRICE_OPTIONS } from '../../../lib/constants';

const money = (v) => (v === null || v === undefined || v === '' ? <span className="text-muted2">Belum Ada Harga</span> : rupiah(v));
const optsOf = (code) => PRICE_OPTIONS[code] || ['Harga', null];
const missing = (p) => p.parameters.filter((x) => x.price === null).length;
const NEWP = () => ({ key: Math.random().toString(36).slice(2), name: '', method: '', price: '', price_alt: '' });
const blank = (code) => ({ service_code: code, name: '', standard_no: '', package_price: '', package_price_alt: '', alt_available: true, note: '', custom_name: false, parameters: [NEWP()] });

/** Isi pop-up tambah/ubah produk beserta harga parameternya. */
function PriceForm({ f, setF }) {
  const [o1, o2] = optsOf(f.service_code);
  const one = !o2 ? 'single' : '';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setP = (i, k, v) => setF({ ...f, parameters: f.parameters.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const shown = f.parameters.map((p, i) => [p, i]).filter(([p]) => !p.deleted);
  const remove = (p, i) => setF({ ...f, parameters: p.id ? f.parameters.map((x, j) => (j === i ? { ...x, deleted: true } : x)) : f.parameters.filter((_, j) => j !== i) });
  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-md-8"><label className="form-label" htmlFor="hp-nm">Nama Produk</label><input id="hp-nm" className="form-control" placeholder="Contoh: Pupuk SP-36" value={f.name} onChange={set('name')} required /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="hp-sni">Nomor SNI</label><input id="hp-sni" className="form-control" placeholder="SNI 02-3769-2005" value={f.standard_no || ''} onChange={set('standard_no')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="hp-pk">Paket Lengkap · {o1}</label><MoneyInput id="hp-pk" value={f.package_price} onChange={(v) => setF({ ...f, package_price: v })} /></div>
        {o2 && <div className="col-md-4"><label className="form-label" htmlFor="hp-pk2">Paket Lengkap · {o2}</label><MoneyInput id="hp-pk2" value={f.package_price_alt} onChange={(v) => setF({ ...f, package_price_alt: v })} disabled={!f.alt_available} /></div>}
        {o2 && <div className="col-md-4 d-flex align-items-end"><div className="form-check mb-2"><input className="form-check-input" type="checkbox" id="hp-alt" checked={f.alt_available} onChange={set('alt_available')} /><label className="form-check-label" htmlFor="hp-alt">Opsi {o2} tersedia</label></div></div>}
        <div className="col-12"><label className="form-label" htmlFor="hp-nt">Keterangan <span className="fw-normal text-muted2">(opsional)</span></label><input id="hp-nt" className="form-control" value={f.note || ''} onChange={set('note')} /></div>
        <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" id="hp-cn" checked={!!f.custom_name} onChange={set('custom_name')} /><label className="form-check-label" htmlFor="hp-cn">Di luar lingkup akreditasi KAN: pelanggan menulis nama produk dan parameternya sendiri</label></div></div>
      </div>
      <div className="form-text mt-0">Semua harga belum termasuk PPN. Kosongkan harga yang belum ditetapkan (tampil "Belum Ada Harga" bagi pelanggan).{f.service_code === 'KIM' && ` Jika harga ${o2} dikosongkan, dipakai harga ${o1} dan biaya tambahannya diisi Admin di invoice.`}</div>
      <div>
        <div className="d-flex justify-content-between align-items-center mb-2"><span className="form-label mb-0">Parameter Uji · Harga per Sampel</span><span className="small text-muted2">{shown.length} parameter</span></div>
        <div className={`price-head d-none d-md-grid small text-muted2 ${one}`}><span /><span>Parameter</span><span>Metode</span><span>{o1} (Rp)</span>{o2 && <span>{o2} (Rp)</span>}<span /></div>
        <div className="d-flex flex-column gap-2">
          {shown.map(([p, i], n) => (
            <div key={p.id || p.key} className={`price-row ${one}`}>
              <span className="num text-muted2 pr-no">{n + 1}</span>
              <input className="form-control form-control-sm pr-name" placeholder="Nama parameter" aria-label={`Nama parameter ${n + 1}`} value={p.name} onChange={(e) => setP(i, 'name', e.target.value)} required />
              <input className="form-control form-control-sm pr-method" placeholder="Metode (opsional)" aria-label={`Metode parameter ${n + 1}`} value={p.method || ''} onChange={(e) => setP(i, 'method', e.target.value)} />
              <MoneyInput size="sm" prefix={false} className="pr-p1" placeholder={o1} aria-label={`Harga ${o1} parameter ${n + 1}`} value={p.price} onChange={(v) => setP(i, 'price', v)} />
              {o2 && <MoneyInput size="sm" prefix={false} className="pr-p2" placeholder={o2} aria-label={`Harga ${o2} parameter ${n + 1}`} value={p.price_alt} onChange={(v) => setP(i, 'price_alt', v)} disabled={!f.alt_available} />}
              <button type="button" className="btn btn-sm btn-outline-danger pr-del" aria-label={`Hapus parameter ${n + 1}`} onClick={() => remove(p, i)}><i className="bi bi-x-lg" /></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={() => setF({ ...f, parameters: [...f.parameters, NEWP()] })}><i className="bi bi-plus-lg" />Tambah Parameter</button>
      </div>
    </div>
  );
}

export default function LabScope({ code, name }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ price: '' });
  const load = useCallback(() => api.get('/superadmin/prices').then((r) => setRows(r.data.filter((p) => p.service_code === code))), [code]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;

  // angka dari server berbentuk "2000000.00": tampilkan sebagai bilangan bulat
  const num = (v) => (v === null || v === undefined || v === '' ? '' : Math.round(+v));
  const open = (p) => setEdit({ ...p, package_price: num(p.package_price), package_price_alt: num(p.package_price_alt), parameters: p.parameters.map((x) => ({ ...x, price: num(x.price), price_alt: num(x.price_alt) })) });
  const save = async () => {
    setBusy(true);
    try {
      if (edit.id) await api.put(`/superadmin/prices/products/${edit.id}`, edit); else await api.post('/superadmin/prices/products', edit);
      toast(edit.id ? `Harga ${edit.name} disimpan.` : `${edit.name} ditambahkan ke daftar harga.`); setEdit(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const del = async (p) => {
    if (!(await confirm({ title: 'Hapus Produk?', body: <>Hapus <b>{p.name}</b> beserta {p.parameters.length} parameternya dari daftar harga?</>, ok: 'Hapus', danger: true, icon: 'trash' }))) return;
    try { await api.delete(`/superadmin/prices/products/${p.id}`); toast('Produk dihapus dari daftar harga.'); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };

  const match = (p) => matchText(q, p.name, p.standard_no, p.note, ...p.parameters.map((x) => x.name)) && (!flt.price || missing(p) > 0);
  const shown = rows.filter(match);
  const filters = [{ key: 'price', label: 'Kelengkapan Harga', options: [['kosong', 'Ada Parameter Tanpa Harga']], single: true }];
  const list = shown;
  const none = q || flt.price ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.';
  const [o1, o2] = optsOf(code);

  return (
    <>
      <section className="panel mb-3">
        <DataToolbar q={q} onQ={setQ} placeholder="Cari produk/parameter" filters={filters} values={flt} onFilter={setFlt} shown={shown.length} total={rows.length} unit="produk" />
      </section>
      <section className="panel mb-3">
        <div className="panel-h"><h2 className="mb-0">{name}</h2><button className="btn btn-sm btn-primary" onClick={() => setEdit(blank(code))}><i className="bi bi-plus-lg" />Tambah Produk</button></div>
            <MobileList items={list} empty={none} row={(p) => {
              const miss = missing(p);
              return {
                key: p.id, title: p.name, sub: `${p.parameters.length} parameter${p.standard_no ? ` · ${p.standard_no}` : ''}`, right: money(p.package_price),
                pills: [...(o2 && !p.alt_available ? [['pill-neutral', `Tanpa ${o2}`]] : []), ...(miss ? [['pill-closed', `${miss} Belum Ada Harga`]] : [])],
                detail: {
                  rows: [[`Paket lengkap · ${o1}`, <b>{money(p.package_price)}</b>], ...(o2 ? [[`Paket lengkap · ${o2}`, p.alt_available ? money(p.package_price_alt) : 'Tidak tersedia']] : []),
                    ...(p.note ? [['Keterangan', p.note]] : []), ...p.parameters.map((x) => [x.name, money(x.price)])],
                  actions: [{ label: 'Ubah', icon: 'pencil', primary: true, onClick: () => open(p) }, { label: 'Hapus', icon: 'trash', danger: true, onClick: () => del(p) }],
                },
              };
            }} />
            <div className="table-responsive d-only">
              <table className="table mb-0 align-middle small">
                <thead><tr><th>Produk</th><th className="text-end">Paket · {o1}</th>{o2 && <th className="text-end">Paket · {o2}</th>}<th className="text-end">Parameter</th><th></th></tr></thead>
                <tbody>{list.map((p) => {
                  const miss = missing(p);
                  return (
                    <tr key={p.id}>
                      <td><span className="fw-semibold">{p.name}</span>{p.standard_no && <span className="d-block text-muted2 mono">{p.standard_no}</span>}{p.note && <span className="d-block text-muted2">{p.note}</span>}</td>
                      <td className="text-end num">{money(p.package_price)}</td>
                      {o2 && <td className="text-end num">{!p.alt_available ? <span className="text-muted2">Tidak Tersedia</span> : p.package_price_alt == null && p.package_price != null ? <span className="text-muted2">{o1} + Biaya Tambahan</span> : money(p.package_price_alt)}</td>}
                      <td className="text-end num">{p.parameters.length}{miss > 0 && <div className="text-danger">{miss} Belum Ada Harga</div>}</td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => open(p)}>Ubah</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => del(p)} aria-label={`Hapus ${p.name}`} title="Hapus"><i className="bi bi-trash" /></button>
                      </td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={o2 ? 5 : 4} className="text-center text-muted2 py-4">{none}</td></tr>}</tbody>
              </table>
            </div>
      </section>
      <FormSheet open={!!edit} onClose={() => setEdit(null)} onSubmit={save} busy={busy} wide="xl" icon={edit?.id ? 'tags' : 'plus-square'}
        confirm={() => ({ title: edit?.id ? 'Simpan Perubahan?' : 'Tambah Produk?', body: <>Data harga <b>{edit?.name || 'produk ini'}</b> akan disimpan dan langsung dipakai di form pengajuan.</> })}
        title={edit?.id ? `Ubah · ${edit.name}` : `Tambah Produk · ${name}`} submitLabel={edit?.id ? 'Simpan' : 'Tambah Produk'}
        sub={edit && (edit.id ? name : 'Produk baru langsung bisa dipilih pelanggan saat mengajukan.')}>
        {edit && <PriceForm f={edit} setF={setEdit} />}
      </FormSheet>
    </>
  );
}

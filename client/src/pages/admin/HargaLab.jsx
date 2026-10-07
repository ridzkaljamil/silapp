/** Daftar harga pengujian laboratorium (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, rupiah, MobileList } from '../../components/ui';

export default function HargaLab() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.get('/superadmin/prices').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const save = async () => {
    try { await api.put(`/superadmin/prices/products/${edit.id}`, edit); toast('Daftar harga disimpan.'); setEdit(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const groups = [...new Set(rows.map((r) => r.service_name))];
  return (
    <>
      <PageHead eyebrow="Super Admin" title="Daftar harga pengujian laboratorium" sub="Harga per parameter per sampel dan harga paket parameter lengkap sesuai SNI, sudah termasuk PPN 11%. Dipakai untuk menghitung invoice lab secara otomatis. Harga parameter 'lainnya' diisi Admin saat membuat invoice." />
      <div className="alert alert-warning small">Harga yang terisi saat ini adalah <b>data contoh</b>. Ganti dengan daftar harga resmi PSU.</div>
      {groups.map((g) => (
        <section className="panel mb-3" key={g}>
          <div className="panel-h"><h2 className="mb-0">{g}</h2></div>
          <MobileList items={rows.filter((r) => r.service_name === g)} row={(p) => {
            const pr = p.parameters.map((x) => +x.price).filter((x) => x > 0);
            const range = pr.length ? `${rupiah(Math.min(...pr))} – ${rupiah(Math.max(...pr))}` : 'belum ada harga';
            return {
              key: p.id, title: p.name, sub: `${p.parameters.length} parameter · ${range}`, right: rupiah(p.package_price),
              pills: pr.length < p.parameters.length ? [['pill-closed', `${p.parameters.length - pr.length} belum ada harga`]] : [],
              detail: {
                rows: [['Layanan', g], ['Paket lengkap SNI', <b>{rupiah(p.package_price)}</b>], ['Jumlah parameter', p.parameters.length], ['Rentang harga', range], ...p.parameters.map((x) => [x.name, x.price ? rupiah(x.price) : '—'])],
                actions: [{ label: 'Ubah harga', icon: 'pencil', primary: true, scrollTo: `harga-edit-${p.id}`, onClick: () => setEdit(JSON.parse(JSON.stringify(p))) }],
              },
            };
          }} />
          <div className="table-responsive d-only">
            <table className="table mb-0 align-middle small">
              <thead><tr><th>Produk</th><th className="text-end">Paket lengkap SNI</th><th className="text-end">Jumlah parameter</th><th className="text-end">Rentang harga parameter</th><th></th></tr></thead>
              <tbody>{rows.filter((r) => r.service_name === g).map((p) => {
                const pr = p.parameters.map((x) => +x.price).filter((x) => x > 0);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td><td className="text-end num">{rupiah(p.package_price)}</td><td className="text-end num">{p.parameters.length}</td>
                    <td className="text-end num">{pr.length ? `${rupiah(Math.min(...pr))} – ${rupiah(Math.max(...pr))}` : '—'}{pr.length < p.parameters.length && <div className="text-danger">{p.parameters.length - pr.length} belum ada harga</div>}</td>
                    <td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(JSON.parse(JSON.stringify(p)))}>Ubah harga</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {edit && rows.find((r) => r.id === edit.id)?.service_name === g && (
            <div className="panel-b border-top swap" id={`harga-edit-${edit.id}`}>
              <h3 className="h6">Ubah harga · {edit.name}</h3>
              <div className="row g-2 mb-2"><div className="col-md-4"><label className="form-label small" htmlFor="pk">Harga paket parameter lengkap SNI (Rp)</label><input id="pk" type="number" min={0} className="form-control form-control-sm" value={edit.package_price ?? ''} onChange={(e) => setEdit({ ...edit, package_price: e.target.value })} /></div></div>
              <div className="table-responsive border rounded px-md-0 px-2" style={{ maxHeight: 360 }}>
                <table className="table table-sm mb-0 small align-middle stack-table">
                  <thead><tr><th>Parameter</th><th>Metode</th><th style={{ width: 170 }}>Harga per sampel (Rp)</th></tr></thead>
                  <tbody>{edit.parameters.map((x, i) => (
                    <tr key={x.id}><td className="st-full"><b>{x.name}</b></td><td className="text-muted2 st-full">{x.method || '—'}</td>
                      <td className="st-full" data-label="Harga per sampel (Rp)"><input type="number" min={0} className="form-control form-control-sm" aria-label={`Harga ${x.name}`} value={x.price ?? ''} onChange={(e) => { const ps = [...edit.parameters]; ps[i] = { ...x, price: e.target.value }; setEdit({ ...edit, parameters: ps }); }} /></td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="d-flex gap-2 mt-2"><button className="btn btn-primary btn-sm" onClick={save}>Simpan harga</button><button className="btn btn-outline-secondary btn-sm" onClick={() => setEdit(null)}>Batal</button></div>
            </div>
          )}
        </section>
      ))}
    </>
  );
}

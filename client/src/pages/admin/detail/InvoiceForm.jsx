/**
 * Form invoice (format PSU). SP & Kalibrasi: baris pekerjaan = uraian + jumlah × harga satuan (boleh beberapa baris).
 * Paket LSPro + Lab otomatis berisi 2 pekerjaan: biaya sertifikasi dan biaya uji laboratorium.
 * Lab: harga dari daftar harga × jumlah sampel; harga parameter "lainnya" dan biaya tambahan diisi Admin.
 * Semua harga belum termasuk PPN. Pajak: DPP nilai lain = 11/12 × harga, PPN 12% × DPP nilai lain, PPh 23 = 2% × harga (opsional).
 */
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../../api';
import { useToast, rupiah, Loading } from '../../../components/ui';

const taxes = (h, pph) => {
  const price = Math.max(0, Math.round(+h || 0));
  const ppn = Math.round((price * 11) / 100);
  const pph23 = pph ? Math.round((price * 2) / 100) : 0;
  return { price, dppLain: Math.round((price * 11) / 12), ppn, total: price + ppn, pph23, grand: price + ppn - pph23 };
};

export default function InvoiceForm({ app, onSaved, onStale }) {
  const toast = useToast();
  const isLab = !['SP', 'KAL'].includes(app.service_code);
  const prev = app.payment?.status === 'invoice' ? app.payment : null;
  const [d, setD] = useState(null);
  const [items, setItems] = useState([]);
  const [cp, setCp] = useState({});
  const [f, setF] = useState({ extra: '', due_date: '', note: '', with_pph23: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/admin/applications/${app.id}/invoice-draft`).then((r) => {
      const x = r.data;
      setD(x);
      const extraPrev = prev && isLab ? prev.items.filter((i) => i.label.startsWith('Biaya tambahan')).reduce((t, i) => t + i.amount, 0) : 0;
      const asRow = (i) => ({ label: i.label, qty: String(i.qty || 1), unit: i.unit || '', price: String(i.price ?? i.amount ?? '') });
      setItems((prev && !isLab ? prev.items : x.items).map(asRow));
      setCp(Object.fromEntries(x.lab_lines.filter((l) => l.custom).map((l) => [l.key, l.price ?? ''])));
      setF({ extra: extraPrev ? String(extraPrev) : '', due_date: prev?.due_date || x.due_date, note: prev?.note || '', with_pph23: prev ? prev.pph23 > 0 : x.with_pph23 });
    }).catch((e) => toast(errMsg(e), 'danger'));
  }, [app.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Loading />;

  const labSum = d.lab_lines.reduce((t, l) => t + (l.custom ? +cp[l.key] || 0 : +l.price || 0) * l.qty, 0) + (+f.extra || 0);
  const missing = d.lab_lines.filter((l) => !l.custom && l.price == null);
  const lineAmt = (i) => Math.max(1, Math.round(+i.qty || 1)) * Math.round(+i.price || 0);
  const sum = isLab ? labSum : items.reduce((t, i) => t + lineAmt(i), 0);
  const t = taxes(sum, f.with_pph23);
  const setItem = (i, k, v) => setItems(items.map((x, n) => (n === i ? { ...x, [k]: v } : x)));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { step: app.current_step.order, with_pph23: f.with_pph23, due_date: f.due_date, note: f.note, ...(isLab ? { extra: f.extra, custom_prices: cp } : { items }) };
      onSaved((await api.post(`/admin/applications/${app.id}/invoice`, body)).data);
      toast(prev ? 'Invoice diperbarui.' : 'Invoice terbit dan dikirim ke pelanggan.');
    } catch (ex) { toast(errMsg(ex), 'danger'); if (ex?.response?.status === 409) onStale?.(); } finally { setBusy(false); }
  };

  return (
    <form className="d-flex flex-column gap-3" onSubmit={save}>
      <div className="small text-muted2">Isi harga <b>sebelum PPN</b>. PPN dan PPh 23 dihitung otomatis seperti invoice resmi PSU.</div>
      {isLab ? (
        <div className="d-flex flex-column gap-2">
          <div className="small">{d.option && <>Opsi harga <b>{d.option}</b> · </>}harga per sampel × {d.lab_lines[0]?.qty || 1} sampel</div>
          <div className="table-responsive border rounded">
            <table className="table table-sm small mb-0 align-middle">
              <tbody>
                {d.lab_lines.map((l) => (
                  <tr key={l.key}>
                    <td>{l.label}{l.custom && <span className="badge text-bg-light border ms-1 fw-normal">lainnya</span>}</td>
                    <td className="text-end" style={{ width: 170 }}>
                      {l.custom
                        ? <input type="number" min={0} className="form-control form-control-sm text-end" aria-label={`Harga ${l.label}`} placeholder="Harga/sampel" value={cp[l.key]} onChange={(e) => setCp({ ...cp, [l.key]: e.target.value })} required />
                        : l.price == null ? <span className="text-danger">Belum ada harga</span> : <span className="num">{rupiah(l.price)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing.length > 0 && <div className="alert alert-warning small mb-0">Harga {missing.map((l) => l.label).join(', ')} belum diatur. Atur dulu di Kelola Layanan &gt; Ruang Lingkup &amp; Harga.</div>}
          <label className="form-label mb-0 small" htmlFor="ix">Biaya Tambahan (Opsional){d.option === 'Ekspress' && <span className="d-block fw-normal text-muted2">Pelanggan memilih Ekspress: isi biaya tambahannya di sini bila belum ada di daftar harga.</span>}</label>
          <input id="ix" type="number" min={0} className="form-control form-control-sm" value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} />
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          <span className="form-label mb-0">Pekerjaan</span>
          {app.is_package && app.service_code === 'SP' && <div className="alert alert-info small py-2 mb-0">Paket LSPro + Lab: invoice berisi 2 pekerjaan, yaitu biaya sertifikasi dan biaya uji laboratorium. Jumlah sampel diisi dari jumlah merek, harga per sampel dari paket lengkap lab dengan SNI yang sama. Periksa dan sesuaikan bila perlu.</div>}
          {items.map((it, i) => (
            <div key={i} className="inv-row">
              <span className="pair-no">{i + 1}</span>
              <div className="d-flex flex-column gap-2" style={{ minWidth: 0 }}>
                <textarea className="form-control form-control-sm" rows={3} aria-label={`Uraian pekerjaan ${i + 1}`} placeholder="Uraian pekerjaan" value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)} required />
                <div className="inv-calc">
                  <input type="number" min={1} max={999} className="form-control form-control-sm text-end inv-qty" aria-label={`Jumlah pekerjaan ${i + 1}`} value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} required />
                  <input className="form-control form-control-sm inv-unit" aria-label={`Satuan pekerjaan ${i + 1}`} placeholder="Satuan" maxLength={20} value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} />
                  <span className="text-muted2">×</span>
                  <div className="input-group input-group-sm inv-amt"><span className="input-group-text">Rp</span><input type="number" min={1} className="form-control text-end" aria-label={`Harga satuan pekerjaan ${i + 1}`} placeholder="Harga satuan" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} required /></div>
                  <span className="num fw-semibold ms-auto">= {rupiah(lineAmt(it))}</span>
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Hapus baris ${i + 1}`} disabled={items.length === 1} onClick={() => setItems(items.filter((_, n) => n !== i))}><i className="bi bi-trash" /></button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline-secondary align-self-start" onClick={() => setItems([...items, { label: '', qty: '1', unit: '', price: '' }])}><i className="bi bi-plus-lg" />Tambah Pekerjaan</button>
        </div>
      )}

      <div className="form-check"><input id="ipph" type="checkbox" className="form-check-input" checked={f.with_pph23} onChange={(e) => setF({ ...f, with_pph23: e.target.checked })} /><label htmlFor="ipph" className="form-check-label small">Potong PPh 23 (2% × harga) — untuk pelanggan badan usaha yang memotong PPh 23</label></div>

      <table className="table table-sm small inv mb-0">
        <tbody>
          <tr><td className="text-muted2">Harga Pekerjaan</td><td className="text-end num">{rupiah(t.price)}</td></tr>
          <tr><td className="text-muted2">DPP Nilai Lain (11/12 × harga)</td><td className="text-end num">{rupiah(t.dppLain)}</td></tr>
          <tr><td className="text-muted2">PPN 12%</td><td className="text-end num">{rupiah(t.ppn)}</td></tr>
          <tr><td className="text-muted2">Total</td><td className="text-end num">{rupiah(t.total)}</td></tr>
          {f.with_pph23 && <tr><td className="text-muted2">PPh 23 (dipotong)</td><td className="text-end num">−{rupiah(t.pph23)}</td></tr>}
          <tr><th>Grand Total (Dibayar Pelanggan)</th><th className="text-end num">{rupiah(t.grand)}</th></tr>
        </tbody>
      </table>

      <div className="row g-2">
        <div className="col-sm-6"><label className="form-label mb-0 small" htmlFor="idd">Jatuh Tempo</label><input id="idd" type="date" className="form-control form-control-sm" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} required /></div>
        <div className="col-sm-6"><label className="form-label mb-0 small" htmlFor="ino">Catatan (Opsional)</label><input id="ino" className="form-control form-control-sm" placeholder="Mis. termin pembayaran" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} /></div>
      </div>
      <button className="btn btn-primary" disabled={busy || sum <= 0 || missing.length > 0}>{busy ? 'Menyimpan…' : prev ? 'Simpan Perubahan Invoice' : 'Terbitkan & Kirim ke Pelanggan'}</button>
      <span className="small text-muted2 text-center">Nomor invoice, kop, rekening, dan tanda tangan diambil dari Kelola Layanan &gt; Pengaturan Umum.</span>
    </form>
  );
}

/**
 * Form invoice (format PSU). SP & Kalibrasi: baris pekerjaan = uraian + jumlah × harga satuan (boleh beberapa baris).
 * Paket LSPro + Lab otomatis berisi 2 pekerjaan: biaya sertifikasi dan biaya uji laboratorium.
 * Lab: harga dari daftar harga × jumlah sampel; harga parameter "lainnya" diisi Admin, ditambah baris
 * pekerjaan / biaya tambahan (uraian, metode, jumlah × harga) bila perlu. Brand / spesifikasi produk diisi
 * pelanggan saat pengajuan dan hanya ditampilkan di sini.
 * Semua harga belum termasuk PPN. Pajak: DPP nilai lain = 11/12 × harga, PPN 12% × DPP nilai lain, PPh 23 = 2% × harga (opsional).
 */
import { useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../../../api';
import { useToast, useConfirm, rupiah, Loading, MoneyInput, taxes, moneyIn, onlyDigits } from '../../../components/ui';
import { peekLocalDraft, dropLocalDraft } from '../../../hooks/useLocalDraft';
import { schemeLabel } from '../../../components/PaymentPanels';

/** Dibayar di tahap Penawaran & Kontrak (sama dengan perhitungan server). */
const dueNow = (scheme, grand) => (scheme === 'akhir' ? 0 : scheme === '5050' ? Math.round(grand / 2) : grand);

const EMPTY_ROW = { label: '', method: '', qty: '1', unit: '', price: '' };

export default function InvoiceForm({ app, onSaved, onStale }) {
  const toast = useToast();
  const confirm = useConfirm();
  const isLab = !['SP', 'KAL'].includes(app.service_code);
  const prev = app.payment?.status === 'invoice' ? app.payment : null;
  const [d, setD] = useState(null);
  const [items, setItems] = useState([]);
  const [cp, setCp] = useState({});
  const [f, setF] = useState({ due_date: '', note: '', with_pph23: true });
  const [busy, setBusy] = useState(false);
  // isian yang belum dikirim tersimpan otomatis di browser (per pengajuan & per proforma)
  const draftKey = `silapp_proforma_${app.id}`;
  const base = prev?.created_at || 'baru';
  const initial = useRef({ ready: false, snap: null });

  useEffect(() => {
    api.get(`/admin/applications/${app.id}/invoice-draft`).then((r) => {
      const x = r.data;
      setD(x);
      const asRow = (i) => ({ label: i.label, method: i.method && i.method !== '-' ? i.method : '', qty: String(i.qty || 1), unit: i.unit || '', price: moneyIn(i.price ?? i.amount) });
      // lab: baris tambahan Admin pada invoice sebelumnya (invoice lama menulisnya sebagai "Biaya tambahan")
      const prevExtra = prev && isLab ? prev.items.filter((i) => i.extra || /^Biaya tambahan/.test(i.label)) : [];
      setItems(isLab ? prevExtra.map(asRow) : (prev ? prev.items : x.items).map(asRow));
      setCp(Object.fromEntries(x.lab_lines.filter((l) => l.custom).map((l) => [l.key, moneyIn(l.price)])));
      setF({ due_date: prev?.due_date || x.due_date, note: prev?.note || '', with_pph23: prev ? prev.pph23 > 0 : x.with_pph23 });
      const saved = peekLocalDraft(draftKey, null);
      if (saved && saved.base === base) {
        setItems(saved.items); setCp(saved.cp); setF(saved.f);
        toast('Isian proforma yang belum dikirim dipulihkan.');
      }
      initial.current.ready = true;
    }).catch((e) => toast(errMsg(e), 'danger'));
  }, [app.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ini = initial.current;
    if (!d || !ini.ready) return undefined;
    // nilai awal (dari server / draft yang dipulihkan) tidak perlu disimpan; simpan setelah ada perubahan
    const now = JSON.stringify({ items, cp, f });
    if (ini.snap === null) { ini.snap = now; return undefined; }
    if (now === ini.snap) return undefined;
    const tm = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify({ base, items, cp, f })); } catch { /* abaikan */ } }, 400);
    return () => clearTimeout(tm);
  }, [d, items, cp, f]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Loading />;

  const lineAmt = (i) => Math.max(1, Math.round(+i.qty || 1)) * Math.round(+i.price || 0);
  const rowsSum = items.reduce((t, i) => t + lineAmt(i), 0);
  const labSum = d.lab_lines.reduce((t, l) => t + (l.custom ? +cp[l.key] || 0 : +l.price || 0) * l.qty, 0) + rowsSum;
  const missing = d.lab_lines.filter((l) => !l.custom && l.price == null);
  const sum = isLab ? labSum : rowsSum;
  const t = taxes(sum, f.with_pph23);
  const setItem = (i, k, v) => setItems(items.map((x, n) => (n === i ? { ...x, [k]: v } : x)));

  const save = async (e) => {
    e.preventDefault();
    const ok = await confirm({ title: prev ? 'Simpan Perubahan Proforma Invoice?' : 'Terbitkan Proforma Invoice?', icon: 'receipt', ok: prev ? 'Ya, Simpan' : 'Ya, Terbitkan',
      body: <>Grand total <b>{rupiah(t.grand)}</b>{app.payment_scheme && <>, skema <b>{schemeLabel(app.payment_scheme)}</b>: dibayar sekarang <b>{rupiah(dueNow(app.payment_scheme, t.grand))}</b></>}. Pelanggan menerima email dan dapat mengunduh proforma invoice.</> });
    if (!ok) return;
    setBusy(true);
    try {
      const body = { step: app.current_step.order, with_pph23: f.with_pph23, due_date: f.due_date, note: f.note, items, ...(isLab && { custom_prices: cp }) };
      onSaved((await api.post(`/admin/applications/${app.id}/invoice`, body)).data);
      dropLocalDraft(draftKey);
      toast(prev ? 'Proforma invoice diperbarui.' : 'Proforma invoice terbit dan dikirim ke pelanggan.');
    } catch (ex) { toast(errMsg(ex), 'danger'); if (ex?.response?.status === 409) onStale?.(); } finally { setBusy(false); }
  };

  // baris pekerjaan isian Admin (SP/Kalibrasi: semua pekerjaan; lab: pekerjaan / biaya tambahan)
  const rows = (
    <>
      {items.map((it, i) => (
        <div key={i} className="inv-row">
          <span className="pair-no">{i + 1}</span>
          <div className="d-flex flex-column gap-2" style={{ minWidth: 0 }}>
            <textarea className="form-control form-control-sm" rows={isLab ? 2 : 3} aria-label={`Uraian pekerjaan ${i + 1}`} placeholder={isLab ? 'Uraian, mis. Biaya tambahan Ekspress' : 'Uraian pekerjaan'} value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)} required />
            {isLab && <input className="form-control form-control-sm" maxLength={80} aria-label={`Metode pekerjaan ${i + 1}`} placeholder="Metode (opsional), mis. SNI 2803:2024" value={it.method} onChange={(e) => setItem(i, 'method', e.target.value)} />}
            <div className="inv-calc">
              <input type="text" inputMode="numeric" className="form-control form-control-sm text-end inv-qty" aria-label={`Jumlah pekerjaan ${i + 1}`} value={it.qty} onChange={(e) => setItem(i, 'qty', onlyDigits(e.target.value).slice(0, 3))} required />
              {!isLab && <input className="form-control form-control-sm inv-unit" aria-label={`Satuan pekerjaan ${i + 1}`} placeholder="Satuan" maxLength={20} value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} />}
              <span className="text-muted2">×</span>
              <MoneyInput size="sm" className="inv-amt" aria-label={`Harga satuan pekerjaan ${i + 1}`} placeholder="Harga satuan" value={it.price} onChange={(v) => setItem(i, 'price', v)} required />
              <span className="num fw-semibold ms-auto">= {rupiah(lineAmt(it))}</span>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Hapus baris ${i + 1}`} disabled={!isLab && items.length === 1} onClick={() => setItems(items.filter((_, n) => n !== i))}><i className="bi bi-trash" /></button>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline-secondary align-self-start" disabled={items.length >= 20} onClick={() => setItems([...items, { ...EMPTY_ROW }])}><i className="bi bi-plus-lg" />{isLab ? 'Tambah Pekerjaan / Biaya Tambahan' : 'Tambah Pekerjaan'}</button>
    </>
  );

  return (
    <form className="d-flex flex-column gap-3" onSubmit={save}>
      <div className="small text-muted2">Isi harga <b>sebelum PPN</b>. PPN dan PPh 23 dihitung otomatis seperti proforma invoice resmi PSU.</div>
      {isLab ? (
        <div className="d-flex flex-column gap-2">
          <div className="small">{d.option && <>Opsi harga <b>{d.option}</b> · </>}harga per sampel × {d.lab_lines[0]?.qty || 1} sampel</div>
          <div className="table-responsive border rounded">
            <table className="table table-sm small mb-0 align-middle">
              <thead><tr><th>Pekerjaan</th><th>Metode</th><th className="text-end">Harga/Sampel</th></tr></thead>
              <tbody>
                {d.lab_lines.map((l) => (
                  <tr key={l.key}>
                    <td style={{ whiteSpace: 'pre-line', minWidth: 150 }}>{l.label}{l.custom && <span className="badge text-bg-light border ms-1 fw-normal">lainnya</span>}</td>
                    <td className="text-muted2">{l.method}</td>
                    <td className="text-end" style={{ width: 170 }}>
                      {l.custom
                        ? <MoneyInput size="sm" aria-label={`Harga ${l.label}`} placeholder="Harga/sampel" value={cp[l.key]} onChange={(v) => setCp({ ...cp, [l.key]: v })} required />
                        : l.price == null ? <span className="text-danger">Belum ada harga</span> : <span className="num">{rupiah(l.price)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing.length > 0 && <div className="alert alert-warning small mb-0">Harga {missing.map((l) => l.label.replace(/\n/g, ' ')).join(', ')} belum diatur. Atur dulu di Kelola Layanan &gt; Ruang Lingkup &amp; Harga.</div>}

          <span className="form-label mb-0 small mt-1">Brand / Spesifikasi Produk</span>
          {d.specs.length
            ? <ol className="small mb-0 ps-4">{d.specs.map((x, i) => <li key={i}>{x}</li>)}</ol>
            : <span className="small text-muted2">Tidak diisi pelanggan.</span>}
          <span className="small text-muted2">Diisi pelanggan saat pengajuan dan dicetak bernomor di kolom pekerjaan proforma invoice.</span>

          <span className="form-label mb-0 small mt-1">Pekerjaan / Biaya Tambahan (Opsional)
            <span className="d-block fw-normal text-muted2">{d.option === 'Ekspress' ? 'Pelanggan memilih Ekspress: tambahkan biaya tambahan Ekspress di sini bila belum ada di daftar harga.' : 'Mis. biaya tambahan atau pekerjaan lain di luar daftar harga.'}</span>
          </span>
          {rows}
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          <span className="form-label mb-0">Pekerjaan</span>
          {app.is_package && app.service_code === 'SP' && <div className="alert alert-info small py-2 mb-0">Paket LSPro + Lab: proforma invoice berisi 2 pekerjaan, yaitu biaya sertifikasi dan biaya uji laboratorium. Jumlah sampel diisi dari jumlah merek, harga per sampel dari paket lengkap lab dengan SNI yang sama. Periksa dan sesuaikan bila perlu.</div>}
          {rows}
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
          <tr><th>Grand Total</th><th className="text-end num">{rupiah(t.grand)}</th></tr>
          {app.payment_scheme && <>
            <tr><td className="text-muted2">Skema Pembayaran</td><td className="text-end">{schemeLabel(app.payment_scheme)}</td></tr>
            <tr><th>Dibayar di Tahap Ini</th><th className="text-end num">{rupiah(dueNow(app.payment_scheme, t.grand))}</th></tr>
            {app.payment_scheme !== 'full' && <tr><td className="text-muted2">Ditagih setelah sertifikat/LHU terbit</td><td className="text-end num">{rupiah(t.grand - dueNow(app.payment_scheme, t.grand))}</td></tr>}
          </>}
        </tbody>
      </table>

      <div className="row g-2">
        <div className="col-sm-6"><label className="form-label mb-0 small" htmlFor="idd">Jatuh Tempo</label><input id="idd" type="date" className="form-control form-control-sm" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} required /></div>
        <div className="col-sm-6"><label className="form-label mb-0 small" htmlFor="ino">Catatan (Opsional)</label><input id="ino" className="form-control form-control-sm" placeholder="Mis. termin pembayaran" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} /></div>
      </div>
      <button className="btn btn-primary" disabled={busy || sum <= 0 || missing.length > 0}>{busy ? 'Menyimpan…' : prev ? 'Simpan Perubahan Proforma Invoice' : 'Terbitkan & Kirim ke Pelanggan'}</button>
      <span className="small text-muted2 text-center">Nomor proforma invoice, kop, rekening, dan tanda tangan diambil dari Kelola Layanan &gt; Pengaturan Umum.</span>
    </form>
  );
}

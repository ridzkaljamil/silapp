/** Tahap akhir: PSU mengunggah invoice & faktur pajak (PDF) beserta catatan untuk pelanggan. */
import { useState } from 'react';
import api, { errMsg } from '../../../api';
import { FileDrop, useToast, useConfirm, rupiah } from '../../../components/ui';
import { useLocalDraft } from '../../../hooks/useLocalDraft';

export default function BillingForm({ app, onSaved, onCancel, onStale }) {
  const toast = useToast();
  const confirm = useConfirm();
  const b = app.billing;
  // catatan tersimpan otomatis di browser sampai berhasil dikirim
  const [d, setD, clear] = useLocalDraft(`silapp_tagihan_${app.id}`, { note: b.note || '', pph: b.with_pph23 });
  const [invoice, setInvoice] = useState([]);
  const [faktur, setFaktur] = useState([]);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if ((!b.sent && !invoice.length) || (!b.sent && !faktur.length)) return toast('Unggah file invoice dan faktur pajak (PDF).', 'danger');
    if (!(await confirm({ title: b.sent ? 'Perbarui Invoice & Faktur?' : 'Kirim Invoice & Faktur?', icon: 'send',
      body: b.sent ? 'Perubahan langsung terlihat oleh pelanggan.' : <>Pelanggan menerima email berisi invoice, faktur pajak{b.amount_due > 0 ? <>, dan sisa tagihan <b>{rupiah(b.amount_due)}</b></> : ''}{d.pph ? ', serta pesan untuk mengirim bukti potong PPh' : ''}.</> }))) return null;
    const fd = new FormData();
    fd.append('step', app.current_step.order); fd.append('note', d.note); fd.append('with_pph23', d.pph ? '1' : '0');
    if (invoice[0]) fd.append('invoice', invoice[0]);
    if (faktur[0]) fd.append('faktur', faktur[0]);
    setBusy(true);
    try {
      const r = await api.post(`/admin/applications/${app.id}/billing`, fd);
      clear(); toast(b.sent ? 'Invoice & faktur diperbarui.' : 'Invoice & faktur dikirim ke pelanggan.'); onSaved(r.data);
    } catch (ex) { toast(errMsg(ex), 'danger'); if (ex?.response?.status === 409) onStale(); } finally { setBusy(false); }
    return null;
  };
  return (
    <form onSubmit={save} className="row g-3">
      <div className="col-md-6"><label className="form-label" htmlFor="bf-inv">Invoice (PDF){b.invoice_name && <span className="fw-normal text-muted2"> · ganti {b.invoice_name}</span>}</label>
        <FileDrop id="bf-inv" accept=".pdf" files={invoice} onChange={setInvoice} label="Pilih file invoice" hint="PDF" /></div>
      <div className="col-md-6"><label className="form-label" htmlFor="bf-fak">Faktur Pajak (PDF){b.faktur_name && <span className="fw-normal text-muted2"> · ganti {b.faktur_name}</span>}</label>
        <FileDrop id="bf-fak" accept=".pdf" files={faktur} onChange={setFaktur} label="Pilih file faktur pajak" hint="PDF" /></div>
      <div className="col-12">
        <div className="form-check"><input id="bf-pph" type="checkbox" className="form-check-input" checked={!!d.pph} onChange={(e) => setD({ ...d, pph: e.target.checked })} />
          <label htmlFor="bf-pph" className="form-check-label small">Pelanggan memotong PPh 23 — wajib mengunggah bukti potong (bawaan mengikuti proforma)</label></div>
      </div>
      <div className="col-12"><label className="form-label" htmlFor="bf-note">Catatan untuk Pelanggan <span className="fw-normal text-muted2">(opsional)</span></label>
        <textarea id="bf-note" className="form-control" rows={3} maxLength={2000} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="mis. Pelunasan paling lambat 14 hari setelah invoice diterima." /></div>
      <div className="col-12 ui-modal-actions px-0 pb-0">
        <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onCancel}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Mengirim…' : b.sent ? 'Simpan' : 'Kirim ke Pelanggan'}</button>
      </div>
    </form>
  );
}

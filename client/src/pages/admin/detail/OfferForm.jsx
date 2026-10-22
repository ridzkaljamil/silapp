/** Tahap Penawaran & Kontrak: skema pembayaran sesuai kontrak + unggah persetujuan penawaran / kontrak. */
import { useState } from 'react';
import api, { errMsg } from '../../../api';
import { FileDrop, useToast, useConfirm } from '../../../components/ui';
import { useLocalDraft } from '../../../hooks/useLocalDraft';
import { SCHEME } from '../../../components/PaymentPanels';

export default function OfferForm({ app, onSaved, onCancel, onStale }) {
  const toast = useToast();
  const confirm = useConfirm();
  // isian tersimpan otomatis di browser sampai berhasil dikirim
  const [d, setD, clear] = useLocalDraft(`silapp_penawaran_${app.id}`, { scheme: app.payment_scheme || '', note: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!d.scheme) return toast('Pilih skema pembayaran.', 'danger');
    if (!files.length && !app.contract) return toast('Unggah persetujuan penawaran / kontrak.', 'danger');
    const changing = app.payment && app.payment_scheme && app.payment_scheme !== d.scheme;
    if (!(await confirm({ title: 'Simpan Penawaran & Kontrak?', icon: 'file-earmark-check',
      body: <>Skema pembayaran <b>{SCHEME[d.scheme][0]}</b>.{changing && ' Proforma invoice yang sudah terbit ikut menyesuaikan dan pelanggan menerima email.'}</> }))) return null;
    const fd = new FormData();
    fd.append('step', app.current_step.order); fd.append('scheme', d.scheme); fd.append('note', d.note);
    if (files[0]) fd.append('contract', files[0]);
    setBusy(true);
    try {
      const r = await api.post(`/admin/applications/${app.id}/offer`, fd);
      clear(); toast('Penawaran & kontrak disimpan.'); onSaved(r.data);
    } catch (ex) { toast(errMsg(ex), 'danger'); if (ex?.response?.status === 409) onStale(); } finally { setBusy(false); }
    return null;
  };
  return (
    <form onSubmit={save} className="d-flex flex-column gap-3">
      <div>
        <div className="form-label">Skema Pembayaran (sesuai kontrak)</div>
        <div className="scheme-opts" role="radiogroup" aria-label="Skema Pembayaran">
          {Object.entries(SCHEME).map(([k, [label, desc]]) => (
            <label key={k} className={`scheme-opt ${d.scheme === k ? 'on' : ''}`}>
              <input type="radio" name="scheme" value={k} checked={d.scheme === k} onChange={() => setD({ ...d, scheme: k })} />
              <span><b>{label}</b><small>{desc}</small></span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="form-label" htmlFor="of-file">Persetujuan Penawaran / Kontrak {app.contract && <span className="fw-normal text-muted2">(opsional, sudah ada: {app.contract.original_name})</span>}</label>
        <FileDrop id="of-file" files={files} onChange={setFiles} label="Pilih file kontrak" />
      </div>
      <div>
        <label className="form-label" htmlFor="of-note">Catatan <span className="fw-normal text-muted2">(opsional)</span></label>
        <textarea id="of-note" className="form-control" rows={2} maxLength={500} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="mis. Kontrak No. 12/PSU/X/2026" />
      </div>
      <div className="ui-modal-actions px-0 pb-0">
        <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onCancel}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </form>
  );
}

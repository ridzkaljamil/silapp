import { useEffect, useState } from 'react';
import api, { errMsg } from '../../../api';
import { useToast, Sheet } from '../../../components/ui';

/** Tinjau satu temuan: tutup, minta ulang, ubah tenggat, keputusan perpanjangan. */
export default function FindingReview({ f, app, onChange, onClose, onDownloadDoc }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [due, setDue] = useState(f?.due_date || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(''); setDue(f?.due_date || ''); }, [f]);
  const run = async (op, extra = {}) => {
    if (op === 'ulang' && !note.trim()) return toast('Tulis perbaikan apa yang masih diperlukan.', 'danger');
    setBusy(true);
    try { onChange((await api.patch(`/admin/applications/${app.id}/findings/${f.id}`, { op, note, ...extra })).data); onClose(); toast('Temuan diperbarui.'); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!f} onClose={onClose} icon="search" title={f ? `Tinjau temuan ${f.category} #${f.id}` : ''}
      footer={f && <>
        {f.status === 'dikirim' && <button className="btn btn-outline-warning" disabled={busy} onClick={() => run('ulang')}>Minta perbaikan ulang</button>}
        <button className="btn btn-primary" disabled={busy} onClick={() => run('tutup')}><i className="bi bi-check2" />Tutup temuan</button>
      </>}>
      {f && (
        <div className="d-flex flex-column gap-3">
          <div className="f-quote">{f.description}</div>
          {(f.customer_note || f.files?.length > 0) && (
            <div><div className="eyebrow mb-1">Tanggapan pelanggan</div>
              {f.customer_note && <div className="small">{f.customer_note}</div>}
              {f.files?.map((d) => <button key={d.id} type="button" className="file-chip" onClick={() => onDownloadDoc(d)}><i className="bi bi-paperclip" />{d.original_name}</button>)}
            </div>
          )}
          {f.status === 'terbuka' && !f.customer_note && <div className="small text-muted2">Pelanggan belum mengirim bukti perbaikan.</div>}
          {f.extension_status === 'diajukan' && (
            <div className="decision-item">
              <div className="small"><b>Perpanjangan 1 bulan diajukan.</b>{f.extension_reason && <> Alasan: "{f.extension_reason}"</>}</div>
              <div className="d-flex gap-2 mt-2"><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run('perpanjang_setuju')}>Setujui perpanjangan</button><button className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => run('perpanjang_tolak')}>Tolak</button></div>
            </div>
          )}
          {f.category !== 'observasi' && (
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div><label className="form-label" htmlFor={`due${f.id}`}>Tenggat</label><input id={`due${f.id}`} type="date" className="form-control" value={due} onChange={(e) => setDue(e.target.value)} /></div>
              <button className="btn btn-outline-secondary" disabled={busy || due === f.due_date} onClick={() => run('ubah', { due_date: due })}>Simpan tenggat</button>
            </div>
          )}
          <div><label className="form-label" htmlFor="fr-note">Catatan untuk pelanggan <span className="fw-normal text-muted2">(wajib untuk minta perbaikan ulang)</span></label><textarea id="fr-note" className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
      )}
    </Sheet>
  );
}

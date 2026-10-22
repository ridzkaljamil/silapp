/**
 * Panel tahap Penawaran & Kontrak (skema pembayaran, kontrak, proforma) dan tahap akhir Invoice & Faktur
 * (invoice & faktur dari PSU, bukti bayar pelunasan, bukti potong PPh 23). Dipakai area Admin dan pelanggan.
 */
import { fmtDate, rupiah } from './ui';

export const SCHEME = {
  full: ['Full di Awal', 'Dibayar penuh di tahap Penawaran & Kontrak sebelum pekerjaan dimulai.'],
  5050: ['50 : 50', 'DP 50% di tahap Penawaran & Kontrak, pelunasan 50% setelah sertifikat/LHU terbit.'],
  akhir: ['Full di Akhir', 'Pekerjaan langsung berjalan. Seluruh tagihan dibayar setelah sertifikat/LHU terbit.'],
};
export const schemeLabel = (s) => SCHEME[s]?.[0] || '—';

/** Baris ringkasan pembayaran sesuai skema (di bawah rincian proforma). */
export function SchemeRows({ p, scheme }) {
  if (!p || !scheme) return null;
  const later = Math.max(0, p.amount - p.due_now);
  return (
    <>
      <tr><td className="text-muted2">Skema Pembayaran</td><td className="text-end">{schemeLabel(scheme)}</td></tr>
      <tr><th>Dibayar di Tahap Penawaran &amp; Kontrak</th><th className="text-end num">{rupiah(p.due_now)}</th></tr>
      {later > 0 && <tr><td className="text-muted2">Ditagih setelah sertifikat/LHU terbit</td><td className="text-end num">{rupiah(later)}</td></tr>}
    </>
  );
}

/** Ringkasan tahap Penawaran & Kontrak. */
export function OfferPanel({ app, onEdit, onDownloadDoc }) {
  const s = app.payment_scheme;
  return (
    <section className="panel">
      <div className="panel-h"><h2 className="mb-0">Penawaran &amp; Kontrak</h2>{onEdit && s && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onEdit}><i className="bi bi-pencil" />Ubah</button>}</div>
      <div className="panel-b">
        {!s ? <p className="text-muted2 mb-0">{onEdit ? 'Skema pembayaran dan persetujuan penawaran / kontrak belum diatur.' : 'PSU sedang menyiapkan penawaran dan kontrak.'}</p> : (
          <dl className="dl-grid dl-wide mb-0">
            <dt>Skema Pembayaran</dt><dd><b>{schemeLabel(s)}</b><div className="small text-muted2">{SCHEME[s][1]}</div></dd>
            {app.contract && <><dt>Persetujuan / Kontrak</dt><dd><button type="button" className="file-chip mt-0" onClick={() => onDownloadDoc(app.contract)}><i className="bi bi-paperclip" />{app.contract.original_name}</button></dd></>}
            {app.payment && <><dt>Dibayar di Tahap Ini</dt><dd><b className="num">{rupiah(app.payment.due_now)}</b>{app.payment.amount > app.payment.due_now && <span className="text-muted2"> · {rupiah(app.payment.amount - app.payment.due_now)} setelah sertifikat/LHU terbit</span>}</dd></>}
          </dl>
        )}
      </div>
    </section>
  );
}

const BST = {
  belum: ['pill-neutral', 'Belum diunggah'], menunggu: ['pill-action', 'Menunggu verifikasi'], disetujui: ['pill-done', 'Disetujui'],
  ditolak: ['pill-closed', 'Ditolak, unggah ulang'], tidak_perlu: ['pill-neutral', 'Tidak diperlukan'],
};

function BillRow({ title, sub, part, onUpload, onView }) {
  const [cls, label] = BST[part.status] || BST.belum;
  return (
    <div className="bill-row">
      <div className="d-flex justify-content-between gap-2 flex-wrap"><b>{title}</b><span className={`pill ${cls}`}>{label}</span></div>
      {sub && <div className="small text-muted2">{sub}</div>}
      {part.status === 'ditolak' && part.note && <div className="small mt-1" style={{ color: 'var(--bad)' }}>Alasan: {part.note}</div>}
      {part.status === 'disetujui' && part.note && <div className="small text-muted2 mt-1">{part.note}</div>}
      <div className="d-flex gap-2 flex-wrap mt-2">
        {part.has_file && onView && <button type="button" className="file-chip mt-0" onClick={onView}><i className="bi bi-paperclip" />Lihat file{part.at ? ` · ${fmtDate(part.at)}` : ''}</button>}
        {onUpload && ['belum', 'ditolak'].includes(part.status) && <button type="button" className="btn btn-sm btn-primary" onClick={onUpload}><i className="bi bi-upload" />Unggah</button>}
      </div>
    </div>
  );
}

/**
 * Tahap akhir Invoice & Faktur. Admin: onEdit (kirim/perbarui invoice & faktur). Pelanggan: onUpload(kind).
 * onDownload(file): invoice | faktur | bayar | potong.
 */
export function BillingPanel({ app, admin, onEdit, onUpload, onDownload }) {
  const b = app.billing;
  if (!b) return null;
  const dw = ['KIM', 'FIS', 'MIK'].includes(app.service_code) ? 'LHU' : 'sertifikat';
  return (
    <section className="panel">
      <div className="panel-h"><h2 className="mb-0">Invoice &amp; Faktur</h2>{onEdit && b.sent && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onEdit}><i className="bi bi-pencil" />Ubah</button>}</div>
      <div className="panel-b d-flex flex-column gap-3">
        {!b.sent ? (
          <p className="text-muted2 mb-0">{admin ? 'Invoice dan faktur pajak belum dikirim ke pelanggan.' : 'PSU sedang menyiapkan invoice dan faktur pajak.'}</p>
        ) : (
          <>
            {!admin && b.pph_message && <div className="alert alert-warning small mb-0"><i className="bi bi-info-circle me-1" />{b.pph_message}</div>}
            <dl className="dl-grid dl-wide mb-0">
              <dt>Skema</dt><dd>{schemeLabel(app.payment_scheme || 'full')}{b.amount_due > 0 ? <> · sisa tagihan <b className="num">{rupiah(b.amount_due)}</b></> : ' · lunas di tahap Penawaran & Kontrak'}</dd>
              <dt>Dokumen dari PSU</dt>
              <dd className="d-flex flex-wrap gap-1">
                <button type="button" className="file-chip mt-0" onClick={() => onDownload('invoice')}><i className="bi bi-file-earmark-pdf" />Invoice{b.invoice_name ? `: ${b.invoice_name}` : ''}</button>
                <button type="button" className="file-chip mt-0" onClick={() => onDownload('faktur')}><i className="bi bi-file-earmark-pdf" />Faktur Pajak{b.faktur_name ? `: ${b.faktur_name}` : ''}</button>
              </dd>
              {b.note && <><dt>Catatan PSU</dt><dd style={{ whiteSpace: 'pre-line' }}>{b.note}</dd></>}
              {admin && <><dt>PPh 23</dt><dd>{b.with_pph23 ? 'Dipotong pelanggan (bukti potong wajib)' : 'Tidak dipotong'}</dd></>}
            </dl>
            <BillRow title="Bukti Bayar" part={b.pay}
              sub={b.pay.status === 'tidak_perlu' ? 'Sudah lunas di tahap Penawaran & Kontrak.' : `Pelunasan ${rupiah(b.amount_due)}. ${admin ? '' : `${dw[0].toUpperCase()}${dw.slice(1)} dapat diunduh setelah bukti bayar disetujui.`}`}
              onUpload={onUpload && (() => onUpload('bayar'))} onView={() => onDownload('bayar')} />
            <BillRow title="Bukti Potong PPh 23" part={b.cut}
              sub={b.cut.status === 'tidak_perlu' ? 'Tidak diperlukan (tanpa potong PPh 23).' : 'Boleh diunggah menyusul (biasanya 1–2 bulan setelah pembayaran).'}
              onUpload={onUpload && (() => onUpload('potong'))} onView={() => onDownload('potong')} />
            {b.completed_at && <div className="small text-muted2">Lengkap {fmtDate(b.completed_at)}.</div>}
          </>
        )}
      </div>
    </section>
  );
}

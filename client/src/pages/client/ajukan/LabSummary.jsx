/** Panel perkiraan biaya di samping langkah 2 laboratorium pengujian. */
import { rupiah } from '../../../components/ui';

export default function LabSummary({ x }) {
  const { alt, altExtra, code, customParams, lab, labEstimate, labPpn, noPrice, optName, pkgPrice, svc } = x;
  return (
    <div className="col-lg-4">
      <aside className="panel panel-b d-flex flex-column gap-2 small">
        <h2 className="mb-1">Perkiraan Biaya</h2>
        {optName && <div className="d-flex justify-content-between gap-2 text-muted2"><span>Opsi harga</span><b className="text-body">{optName}</b></div>}
        <div className="d-flex justify-content-between gap-2"><span>Harga · {lab.full_sni ? 'paket lengkap SNI' : `${lab.params.length} parameter`} × {+lab.quantity || 1} sampel</span><b className="num">{(noPrice || (lab.full_sni && !pkgPrice)) && !labEstimate ? <span className="fw-normal text-muted2">Belum Ada Harga</span> : rupiah(labEstimate)}</b></div>
        {customParams.length > 0 && <div className="d-flex justify-content-between text-muted2"><span>{customParams.length} parameter lainnya</span><span>dikonfirmasi PSU</span></div>}
        {altExtra && <div className="d-flex justify-content-between text-muted2"><span>Biaya tambahan Ekspress</span><span>dikonfirmasi PSU</span></div>}
        {noPrice && <div className="d-flex justify-content-between text-muted2"><span>Parameter belum ada harga</span><span>dikonfirmasi PSU</span></div>}
        <div className="d-flex justify-content-between gap-2 text-muted2"><span>PPN 12% × DPP Nilai Lain</span><span className="num">{rupiah(labPpn)}</span></div>
        <div className="border-top pt-2 d-flex justify-content-between align-items-baseline"><span className="fw-semibold">Estimasi Total</span><span className="big-amount">{rupiah(labEstimate + labPpn)}</span></div>
        <p className="text-muted2 mb-0">Estimasi Total = harga + PPN. Bila perusahaan Anda memotong PPh 23 (2% dari harga), nilai yang dibayar berkurang sebesar potongan itu. Tagihan resmi dikirim melalui proforma invoice setelah verifikasi.</p>
        {svc?.est_text && <div className="bg-light rounded-3 p-2">Estimasi selesai <b>{code === 'KIM' ? (alt ? '2–3 hari per sampel' : '5–7 hari per sampel') : svc.est_text}</b> setelah sampel diterima.</div>}
      </aside>
    </div>
  );
}

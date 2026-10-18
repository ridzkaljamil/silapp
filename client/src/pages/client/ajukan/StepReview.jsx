/** Langkah 4: ringkasan pengajuan sebelum dikirim. */
import { ORIGINS, Row, filledPairs, pairText } from './shared';

export default function StepReview({ x }) {
  const { code, customParams, customProduct, docList, docs, extraDocs, fields, flowSteps, isLab, kal, lab, labProduct, labSpecs, optName, sp, spProduct, specText, svc, values } = x;
  return (
    <>
      <dl className="row small">
        <dt className="col-sm-3 text-muted2 fw-normal">Layanan</dt><dd className="col-sm-9">{svc.name}{sp.is_package && code === 'SP' ? ' · paket + pengujian lab' : ''}</dd>
        {code === 'SP' && <Row k="Jenis Permohonan" v={sp.types.join(' + ')} />}
        {code === 'SP' && spProduct && <><dt className="col-sm-3 text-muted2 fw-normal">Produk</dt><dd className="col-sm-9">{spProduct.name} · <span className="mono">{spProduct.standard_no}</span> · {sp.scheme || 'Sesuai Acuan'} · {ORIGINS.find((o) => o[0] === sp.origin)?.[1]}</dd></>}
        {code === 'SP' && <Row k="Merek & Jenis" v={sp.brands.filter((b) => b.merek.trim()).map((b) => `${b.merek}${b.jenis ? ` · ${b.jenis}` : ''}`).join('; ')} />}
        {code === 'KAL' && <><dt className="col-sm-3 text-muted2 fw-normal">Alat</dt><dd className="col-sm-9">{kal.name} {kal.brand_model} · {kal.location === 'onsite' ? 'On-site' : 'Di laboratorium'}</dd></>}
        {isLab && labProduct && <><dt className="col-sm-3 text-muted2 fw-normal">Produk & parameter</dt><dd className="col-sm-9">{customProduct ? `${lab.custom_product} (di luar lingkup KAN)` : labProduct.name}{optName && !customProduct ? ` · ${optName}` : ''} · {lab.full_sni ? 'parameter lengkap sesuai SNI' : labProduct.parameters.filter((p) => lab.params.includes(p.id)).map((p) => p.name).join(', ')}{customParams.length > 0 && ` · lainnya: ${customParams.join(', ')}`}</dd></>}
        {isLab && labSpecs.length > 0 && <Row k="Brand / Spesifikasi" v={labSpecs.map(specText).join('; ')} />}
        {fields.filter((f) => (f.type === 'nomor_tanggal' ? filledPairs(values[f.key]).length : values[f.key])).map((f) => <Row key={f.key} k={f.label} v={f.type === 'nomor_tanggal' ? pairText(values[f.key]) : values[f.key]} />)}
        <dt className="col-sm-3 text-muted2 fw-normal">Dokumen</dt><dd className="col-sm-9">{[...docList.filter((d) => docs[d.name]).map((d) => d.name), ...extraDocs.filter((x) => x.file).map((x) => x.name)].join(', ') || 'Belum ada'}</dd>
        <dt className="col-sm-3 text-muted2 fw-normal">Tahapan Proses</dt><dd className="col-sm-9">{flowSteps.length} tahap: {flowSteps.map((x) => x.name).join(' → ')}</dd>
      </dl>
      <div className="alert alert-light border small mb-0">Setelah dikirim, sistem membuat <b>nomor pengajuan</b> untuk arsip dan <b>kode lacak</b> acak yang dikirim ke email Anda untuk cek progres tanpa login.</div>
    </>
  );
}

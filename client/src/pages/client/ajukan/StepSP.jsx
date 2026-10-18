/** Langkah 2 Sertifikasi Produk: jenis permohonan, produk & skema, merek, asal produk, isian tambahan. */
import { Select, rupiah } from '../../../components/ui';
import { APP_TYPES, F, ORIGINS, SURV_TEXT, pickType } from './shared';

export default function StepSP({ x }) {
  const { categories, dyn, schemes, setBrand, setSp, sp, spProduct, spProducts, surveillance } = x;
  return (
    <div className="row g-3">
      <div className="col-12">
        <span className="form-label d-block">Jenis Permohonan <span className="text-danger">*</span> <span className="fw-normal text-muted2">· Sertifikasi Awal dan Surveillance boleh dipilih bersamaan</span></span>
        <div className="type-grid">
          {APP_TYPES.map((t) => {
            const on = sp.types.includes(t);
            return (
              <label key={t} className={`choice ${on ? 'on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => setSp({ ...sp, types: pickType(sp.types, t) })} />
                <span><b>{t}</b>{t === 'Surveillance' && <span className="d-block small text-muted2">Pernyataan kesediaan untuk disurveilan</span>}</span>
              </label>
            );
          })}
        </div>
        {surveillance && <div className="alert alert-light border small mt-2 mb-0"><i className="bi bi-shield-check me-1" /><b>Pernyataan Surveillance:</b> {SURV_TEXT}</div>}
      </div>
      <F label="Kategori Produk" id="c" req><Select id="c" className="form-select" value={sp.category} onChange={(e) => setSp({ ...sp, category: e.target.value, product_id: '', scheme: '' })}><option value="">— Pilih —</option>{categories.map(([c, n]) => <option key={c} value={c}>{c} · {n} produk</option>)}</Select></F>
      <F label="Produk dalam Ruang Lingkup" id="p" req><Select id="p" className="form-select" value={sp.product_id} onChange={(e) => setSp({ ...sp, product_id: e.target.value, scheme: '' })} disabled={!sp.category}><option value="">— Pilih —</option>{spProducts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
      <F label="Skema Sertifikasi" id="s"><Select id="s" className="form-select" value={sp.scheme} onChange={(e) => setSp({ ...sp, scheme: e.target.value })} disabled={!schemes.length}><option value="">{schemes.length ? '— Pilih —' : 'Sesuai Acuan Skema'}</option>{schemes.map((x) => <option key={x}>{x}</option>)}</Select></F>
      <div className="col-md-6">
        <span className="form-label d-block">Asal Produk <span className="text-danger">*</span></span>
        <div className="segmented seg-fill" role="radiogroup" aria-label="Asal Produk">
          {ORIGINS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={sp.origin === v} aria-pressed={sp.origin === v} onClick={() => setSp({ ...sp, origin: sp.origin === v ? '' : v })}>{l}</button>)}
        </div>
      </div>
      {spProduct && <div className="col-12"><div className="alert alert-light border small mb-0"><b>Acuan standar:</b> <span className="mono">{spProduct.standard_no}</span> · <b>Sub kategori:</b> {spProduct.sub_category} · <b>Acuan skema:</b> {spProduct.scheme_reference || '—'}</div></div>}
      <div className="col-12">
        <span className="form-label d-block">Merek &amp; Jenis Produk <span className="text-danger">*</span></span>
        <div className="d-flex flex-column gap-2">
          {sp.brands.map((b, i) => (
            <div key={i} className="pair-row">
              <span className="pair-no">{i + 1}</span>
              <input className="form-control" placeholder="Merek" aria-label={`Merek ${i + 1}`} value={b.merek} onChange={(e) => setBrand(i, 'merek', e.target.value)} />
              <input className="form-control" placeholder="Jenis; Spesifikasi; Model" aria-label={`Jenis ${i + 1}`} value={b.jenis} onChange={(e) => setBrand(i, 'jenis', e.target.value)} />
              <button type="button" className="btn btn-outline-danger" aria-label={`Hapus Merek ${i + 1}`} disabled={sp.brands.length === 1} onClick={() => setSp({ ...sp, brands: sp.brands.filter((_, n) => n !== i) })}><i className="bi bi-trash" /></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm mt-2" onClick={() => setSp({ ...sp, brands: [...sp.brands, { merek: '', jenis: '' }] })}><i className="bi bi-plus-lg" />Tambah Merek &amp; Jenis</button>
      </div>
      <div className="col-12">
        {spProduct?.lab_test && !sp.is_package && (
          <div className="alert alert-info small d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="flex-grow-1"><i className="bi bi-lightbulb me-1" />Produk ini bisa diuji di {spProduct.lab_test.service} PSU{spProduct.lab_test.price ? <> (paket lengkap SNI {rupiah(spProduct.lab_test.price)}/sampel, belum termasuk PPN)</> : ''}. Pilih paket agar sertifikasi dan uji lab diproses bersama dan ditagih dalam <b>satu proforma invoice</b>.</span>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setSp({ ...sp, is_package: true })}>Pilih Paket</button>
          </div>
        )}
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="pkg" checked={sp.is_package} onChange={(e) => setSp({ ...sp, is_package: e.target.checked })} />
          <label className="form-check-label" htmlFor="pkg"><b>Paket Sertifikasi Produk + Pengujian Laboratorium PSU</b><span className="d-block small text-muted2">Sertifikasi dan uji lab ditagih dalam satu proforma invoice (jumlah sampel = jumlah merek). Surat permohonan pengujian disiapkan oleh Admin PSU. Hasil lab (LHU) ditampilkan pada tahap Pengujian laboratorium.</span></label>
        </div>
      </div>
      {dyn}
    </div>
  );
}

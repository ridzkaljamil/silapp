/** Langkah 2 Laboratorium Pengujian: produk, opsi harga, parameter uji, jumlah sampel, brand/spesifikasi. */
import { Select, rupiah } from '../../../components/ui';
import { F } from './shared';

export default function StepLab({ x }) {
  const { code, customProduct, dyn, lab, labProduct, optName, pickProduct, pkgPrice, priceOf, priceOpt, scope, setCustom, setLab, setSpec } = x;
  return (
    <div className="row g-3">
      {scope.length === 0 && <div className="col-12"><div className="alert alert-light border small mb-0">Daftar parameter untuk layanan ini belum tersedia. Tuliskan parameter yang Anda butuhkan di kolom di bawah; harganya akan dikonfirmasi PSU di proforma invoice.</div></div>}
      {scope.length === 0 && <F label="Jumlah Sampel" id="lq"><input id="lq" type="number" min={1} className="form-control" value={lab.quantity} onChange={(e) => setLab({ ...lab, quantity: e.target.value })} /></F>}
      {scope.length > 0 && (<>
      <F label="Produk / Bahan yang Diuji" id="lp"><Select id="lp" className="form-select" value={lab.product_id} onChange={(e) => pickProduct(scope.find((p) => p.id === +e.target.value))}>{scope.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
      <F label="Jumlah Sampel" id="lq"><input id="lq" type="number" min={1} className="form-control" value={lab.quantity} onChange={(e) => setLab({ ...lab, quantity: e.target.value })} /></F>
      {customProduct && <F label="Nama Produk yang Diuji" id="lcp" req full><input id="lcp" className="form-control" maxLength={120} placeholder="Contoh: Pupuk Organik Cair" value={lab.custom_product} onChange={(e) => setLab({ ...lab, custom_product: e.target.value })} /><div className="form-text">Produk ini di luar lingkup akreditasi KAN. Tuliskan nama produk dan parameter yang dibutuhkan; harga dikonfirmasi PSU di proforma invoice.</div></F>}
      {labProduct?.note && <div className="col-12"><div className="alert alert-light border small mb-0"><i className="bi bi-info-circle me-1" />{labProduct.note}</div></div>}
      {priceOpt && !customProduct && (
        <div className="col-12">
          <span className="form-label d-block">Opsi Harga</span>
          <div className="d-flex flex-wrap gap-2">
            {priceOpt.map((o, i) => {
              const v = i ? 'alt' : 'std';
              const off = i === 1 && !labProduct?.alt_available;
              return (
                <label key={o} className={`choice flex-grow-1 ${lab.option === v ? 'on' : ''} ${off ? 'opacity-50' : ''}`} style={{ minWidth: 200 }}>
                  <input type="radio" name="opt" checked={lab.option === v} disabled={off} onChange={() => setLab({ ...lab, option: v })} />
                  <span><b>{o}</b><span className="d-block small text-muted2">{off ? 'Belum tersedia untuk produk ini (ada parameter yang diuji di lab luar)' : code === 'KIM' ? (i ? 'Estimasi 2–3 hari per sampel · biaya tambahan dikonfirmasi PSU' : 'Estimasi 5–7 hari per sampel') : (i ? 'Produk / pemohon dari luar negeri' : 'Produk / pemohon dalam negeri')}</span></span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {!customProduct && <div className="col-12">
        <span className="form-label d-block">Parameter Uji <span className="fw-normal text-muted2">(harga per sampel{optName ? ` · ${optName}` : ''}, sebelum PPN)</span></span>
        <div className="d-flex flex-column gap-2 mb-2">
          <label className={`choice ${lab.full_sni ? 'on' : ''}`}>
            <input type="radio" name="mode" id="full" checked={lab.full_sni} disabled={!pkgPrice} onChange={() => setLab({ ...lab, full_sni: true, params: [] })} />
            <span className="flex-grow-1"><b>Parameter Lengkap Sesuai SNI</b><span className="d-block small text-muted2">Semua {labProduct?.parameters.length} parameter dalam satu paket</span></span>
            <b className="num">{pkgPrice ? rupiah(pkgPrice) : <span className="text-muted2 fw-normal">Belum Ada Harga</span>}</b>
          </label>
          <label className={`choice ${!lab.full_sni ? 'on' : ''}`}>
            <input type="radio" name="mode" id="pilih" checked={!lab.full_sni} onChange={() => setLab({ ...lab, full_sni: false })} />
            <span className="flex-grow-1"><b>Pilih Parameter Sendiri</b><span className="d-block small text-muted2">Centang parameter yang diperlukan di bawah</span></span>
          </label>
        </div>
        <div className="table-responsive border rounded">
          <table className="table table-sm mb-0 small align-middle">
            <thead><tr><th style={{ width: 40 }}></th><th>Parameter</th><th className="d-none d-md-table-cell">Metode</th><th className="text-end">Harga</th></tr></thead>
            <tbody>{labProduct?.parameters.map((p) => (
              <tr key={p.id} className={lab.full_sni ? 'text-muted2' : ''}>
                <td><input className="form-check-input" type="checkbox" id={`pp${p.id}`} disabled={lab.full_sni} checked={lab.full_sni || lab.params.includes(p.id)} onChange={(e) => setLab({ ...lab, params: e.target.checked ? [...lab.params, p.id] : lab.params.filter((x) => x !== p.id) })} /></td>
                <td><label htmlFor={`pp${p.id}`}>{p.name}</label>{p.method && <div className="d-md-none text-muted2" style={{ fontSize: 11 }}>{p.method}</div>}</td><td className="text-muted2 d-none d-md-table-cell">{p.method || '—'}</td><td className="text-end num">{priceOf(p) == null ? <span className="text-muted2">Belum Ada Harga</span> : rupiah(priceOf(p))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>}
      </>)}
      <div className="col-12">
        <span className="form-label d-block">{scope.length && !customProduct ? 'Parameter Lainnya (Opsional)' : <>Parameter yang Dibutuhkan <span className="text-danger">*</span></>}</span>
        <div className="d-flex flex-column gap-2">
          {lab.custom.map((v, i) => (
            <div key={i} className="pair-row pair-one">
              <input className="form-control" placeholder="Contoh: Kadar Silika (SiO₂)" aria-label={`Parameter lainnya ${i + 1}`} value={v} onChange={(e) => setCustom(i, e.target.value)} />
              <button type="button" className="btn btn-outline-danger" aria-label={`Hapus parameter ${i + 1}`} disabled={lab.custom.length === 1 && !v} onClick={() => setLab({ ...lab, custom: lab.custom.length === 1 ? [''] : lab.custom.filter((_, k) => k !== i) })}><i className="bi bi-trash" /></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm mt-2" disabled={lab.custom.length >= 20} onClick={() => setLab({ ...lab, custom: [...lab.custom, ''] })}><i className="bi bi-plus-lg" />Tambah Parameter</button>
        <div className="form-text">Harga parameter lainnya dikonfirmasi PSU di proforma invoice.</div>
      </div>
      <div className="col-12">
        <span className="form-label d-block">Brand / Spesifikasi Produk (Opsional)</span>
        <div className="d-flex flex-column gap-2">
          {lab.specs.map((x, i) => (
            <div key={i} className="pair-row">
              <span className="pair-no">{i + 1}</span>
              <input className="form-control" maxLength={80} placeholder="Brand, mis. SOLUTUS" aria-label={`Brand ${i + 1}`} value={x.brand} onChange={(e) => setSpec(i, 'brand', e.target.value)} />
              <input className="form-control" maxLength={80} placeholder="Spesifikasi, mis. NPK 13-8-30" aria-label={`Spesifikasi ${i + 1}`} value={x.spec} onChange={(e) => setSpec(i, 'spec', e.target.value)} />
              <button type="button" className="btn btn-outline-danger" aria-label={`Hapus brand ${i + 1}`} disabled={lab.specs.length === 1 && !x.brand && !x.spec} onClick={() => setLab({ ...lab, specs: lab.specs.length === 1 ? [{ brand: '', spec: '' }] : lab.specs.filter((_, k) => k !== i) })}><i className="bi bi-trash" /></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm mt-2" disabled={lab.specs.length >= 50} onClick={() => setLab({ ...lab, specs: [...lab.specs, { brand: '', spec: '' }] })}><i className="bi bi-plus-lg" />Tambah Brand / Spesifikasi</button>
        <div className="form-text">Satu baris untuk satu sampel. Daftar ini dicantumkan bernomor di proforma invoice.</div>
      </div>
      {dyn}
    </div>
  );
}

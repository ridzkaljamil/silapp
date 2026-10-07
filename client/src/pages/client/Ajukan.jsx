import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, rupiah, FILE_ACCEPT, Select } from '../../components/ui';
import { SERVICE_STATE as STATE } from '../../lib/constants';

const STEPS = ['Pilih layanan', 'Data & parameter', 'Unggah dokumen', 'Konfirmasi'];
const APP_TYPES = ['Sertifikasi baru', 'Re-sertifikasi', 'Perluasan ruang lingkup', 'Perubahan data/merek', 'Transfer'];

/** Pembungkus label + field (di luar komponen agar input tidak kehilangan fokus saat mengetik). */
const F = ({ label, children, id, full, req }) => <div className={full ? 'col-12' : 'col-md-6'}><label className="form-label" htmlFor={id}>{label}{req ? <span className="text-danger"> *</span> : null}</label>{children}</div>;

/** Isian dari form builder (diatur Super Admin). */
function DynField({ f, value, onChange }) {
  const id = `fx-${f.key}`;
  const common = { id, className: f.type === 'select' ? 'form-select' : 'form-control', value: value || '', onChange: (e) => onChange(f.key, e.target.value), required: !!f.required };
  let input;
  if (f.type === 'textarea') input = <textarea rows={2} {...common} />;
  else if (f.type === 'select') input = <Select {...common}><option value="">— pilih —</option>{(f.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o}>{o}</option>)}</Select>;
  else input = <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} {...common} />;
  return <F label={f.label} id={id} req={f.required} full={f.type === 'textarea'}>{input}</F>;
}

export default function Ajukan() {
  const nav = useNavigate();
  const toast = useToast();
  const [services, setServices] = useState(null);
  const [stage, setStage] = useState(1);
  const [code, setCode] = useState('');
  const [scope, setScope] = useState([]);
  const [formDef, setFormDef] = useState({ fields: [], documents: [] });
  const [busy, setBusy] = useState(false);
  // data form
  const [sp, setSp] = useState({ category: '', product_id: '', scheme: '', application_type: APP_TYPES[0], is_package: false });
  const [lab, setLab] = useState({ product_id: '', quantity: 1, params: [], full_sni: false, custom: '' });
  const [kal, setKal] = useState({ name: '', brand_model: '', serial_number: '', range_capacity: '', resolution: '', calibration_points: '', accessories: '', quantity: 1, location: 'lab' });
  const [values, setValues] = useState({});
  const [docs, setDocs] = useState({});

  useEffect(() => { api.get('/public/services').then((r) => setServices(r.data)); }, []);
  useEffect(() => {
    if (!code) return;
    setValues({}); setDocs({});
    api.get(`/public/services/${code}/form`).then((r) => setFormDef(r.data));
    api.get(`/public/services/${code}/scope`).then((r) => {
      setScope(r.data);
      if (code !== 'SP' && r.data[0]) setLab({ product_id: r.data[0].id, quantity: 1, params: [], full_sni: false, custom: '' });
    });
  }, [code]);

  const svc = services?.find((s) => s.code === code);
  const categories = useMemo(() => [...new Set(scope.map((p) => p.category))], [scope]);
  const spProducts = scope.filter((p) => p.category === sp.category);
  const spProduct = scope.find((p) => p.id === +sp.product_id);
  const schemes = spProduct?.scheme_types ? spProduct.scheme_types.split('/').map((x) => x.trim()) : [];
  const is1B = /1b/i.test(sp.scheme);
  const isLab = code && code !== 'SP' && code !== 'KAL';
  const labProduct = scope.find((p) => p.id === +lab.product_id);
  const customParams = lab.custom.split('\n').map((x) => x.trim()).filter(Boolean);
  const fields = formDef.fields.filter((f) => f.show_when !== '1B' || (code === 'SP' && is1B));
  const needDoc = (d) => !!d.required && !(d.admin_if_package && sp.is_package && code === 'SP');
  const labEstimate = labProduct ? (lab.full_sni ? +labProduct.package_price || 0
    : labProduct.parameters.filter((p) => lab.params.includes(p.id)).reduce((t, p) => t + (+p.price || 0), 0)) * (+lab.quantity || 1) : 0;

  if (!services) return <Loading />;
  const leaves = services.filter((s) => s.bidang);
  const parents = services.filter((s) => !s.parent_id);
  const setVal = (k, v) => setValues((x) => ({ ...x, [k]: v }));

  const validate = () => {
    if (stage === 1 && !code) return 'Pilih layanan dulu.';
    if (stage === 2) {
      if (code === 'SP' && !sp.product_id) return 'Pilih produk dari ruang lingkup.';
      if (code === 'SP' && schemes.length && !sp.scheme) return 'Pilih skema sertifikasi.';
      if (code === 'KAL' && !kal.name) return 'Nama alat wajib diisi.';
      if (isLab && !lab.full_sni && !lab.params.length && !customParams.length) return 'Pilih minimal satu parameter uji.';
      const miss = fields.find((f) => f.required && !String(values[f.key] || '').trim());
      if (miss) return `${miss.label} wajib diisi.`;
    }
    if (stage === 3) {
      const miss = formDef.documents.find((d) => needDoc(d) && !docs[d.name]);
      if (miss) return `Berkas "${miss.name}" wajib diunggah.`;
    }
    return null;
  };
  const next = () => { const e = validate(); if (e) return toast(e, 'danger'); setStage(stage + 1); };

  const submit = async () => {
    const data = { fields: Object.fromEntries(fields.map((f) => [f.key, values[f.key] || ''])) };
    if (code === 'SP') {
      Object.assign(data, { product_id: +sp.product_id, scheme: sp.scheme || null, application_type: sp.application_type, is_package: sp.is_package });
    } else if (code === 'KAL') {
      Object.assign(data, { equipment: kal, location: kal.location });
    } else {
      Object.assign(data, { product_id: +lab.product_id, full_sni: lab.full_sni, parameter_ids: lab.full_sni ? [] : lab.params, custom_params: customParams, sample: { description: labProduct?.name, quantity: +lab.quantity } });
    }
    const fd = new FormData();
    fd.append('service_code', code);
    fd.append('data', JSON.stringify(data));
    const types = [];
    Object.entries(docs).forEach(([t, f]) => { if (f) { fd.append('documents', f); types.push(t); } });
    fd.append('doc_types', JSON.stringify(types));
    setBusy(true);
    try {
      const r = await api.post('/applications', fd);
      toast(`Pengajuan ${r.data.application_no} terkirim. Kode lacak ${r.data.tracking_code} dikirim ke email Anda.`);
      nav(`/klien/pengajuan/${r.data.id}`);
    } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };

  const dyn = fields.length > 0 && (
    <>
      <div className="col-12 eyebrow mt-2">{code === 'SP' ? 'Data pabrik & produk' : 'Data tambahan'}</div>
      {fields.map((f) => <DynField key={f.key} f={f} value={values[f.key]} onChange={setVal} />)}
    </>
  );

  return (
    <>
      <PageHead eyebrow="Ajukan layanan" title={stage === 1 ? 'Pilih layanan' : `Ajukan · ${svc?.name}`} />
      <div className="wizard mb-3" aria-label="Langkah">
        {STEPS.map((s, i) => <div key={s} className={i + 1 === stage ? 'on' : i + 1 < stage ? 'done' : ''} aria-current={i + 1 === stage ? 'step' : undefined}><span>Langkah {i + 1}{i + 1 === stage ? ' · sekarang' : ''}</span><b>{s}</b></div>)}
      </div>
      <div className="row g-3 align-items-start">
      <div className={stage === 2 && isLab ? 'col-lg-8' : 'col-12'}>
      <section className="panel">
        <div className="panel-b swap" key={stage}>
          {stage === 1 && parents.map((p) => {
            const items = p.bidang ? [p] : leaves.filter((s) => s.parent_id === p.id);
            return (
              <div key={p.id} className="mb-3">
                <div className="eyebrow mb-2">{p.name}</div>
                <div className="row g-2">
                  {items.map((s) => (
                    <div className="col-sm-6 col-lg-3" key={s.code}>
                      <button type="button" className={`pick-card ${code === s.code ? 'active' : ''}`} onClick={() => setCode(s.code)}>
                        <b className="d-block" style={{ color: 'var(--navy)' }}>{s.name}</b>
                        <span className="small text-muted2 d-block">{s.steps.length} tahap · {s.est_text}</span>
                        {STATE[s.state] && <span className="pill pill-action mt-1">{STATE[s.state]}</span>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {stage === 2 && code === 'SP' && (
            <div className="row g-3">
              <F label="Jenis permohonan" id="t"><Select id="t" className="form-select" value={sp.application_type} onChange={(e) => setSp({ ...sp, application_type: e.target.value })}>{APP_TYPES.map((x) => <option key={x}>{x}</option>)}</Select></F>
              <F label="Kategori produk" id="c" req><Select id="c" className="form-select" value={sp.category} onChange={(e) => setSp({ ...sp, category: e.target.value, product_id: '', scheme: '' })}><option value="">— pilih —</option>{categories.map((x) => <option key={x}>{x}</option>)}</Select></F>
              <F label="Produk dalam ruang lingkup" id="p" req><Select id="p" className="form-select" value={sp.product_id} onChange={(e) => setSp({ ...sp, product_id: e.target.value, scheme: '' })} disabled={!sp.category}><option value="">— pilih —</option>{spProducts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
              <F label="Skema sertifikasi" id="s"><Select id="s" className="form-select" value={sp.scheme} onChange={(e) => setSp({ ...sp, scheme: e.target.value })} disabled={!schemes.length}><option value="">{schemes.length ? '— pilih —' : 'Sesuai acuan skema'}</option>{schemes.map((x) => <option key={x}>{x}</option>)}</Select></F>
              {spProduct && <div className="col-12"><div className="alert alert-light border small mb-0"><b>Acuan standar:</b> <span className="mono">{spProduct.standard_no}</span> · <b>Sub kategori:</b> {spProduct.sub_category} · <b>Acuan skema:</b> {spProduct.scheme_reference || '—'}</div></div>}
              <div className="col-12">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="pkg" checked={sp.is_package} onChange={(e) => setSp({ ...sp, is_package: e.target.checked })} />
                  <label className="form-check-label" htmlFor="pkg"><b>Paket Sertifikasi Produk + Pengujian Laboratorium PSU</b><span className="d-block small text-muted2">Surat permohonan pengujian disiapkan oleh Admin PSU. Hasil lab (LHU) ditampilkan pada tahap Pengujian laboratorium.</span></label>
                </div>
              </div>
              {dyn}
            </div>
          )}

          {stage === 2 && code === 'KAL' && (
            <div className="row g-3">
              {[['name', 'Nama alat'], ['brand_model', 'Merek / tipe-model'], ['serial_number', 'Nomor seri'], ['range_capacity', 'Kapasitas / range'], ['resolution', 'Resolusi'], ['calibration_points', 'Titik kalibrasi yang diminta'], ['accessories', 'Aksesori yang disertakan'], ['quantity', 'Jumlah alat']].map(([k, l]) => (
                <F key={k} label={l} id={k} req={k === 'name'}><input id={k} type={k === 'quantity' ? 'number' : 'text'} min={1} className="form-control" value={kal[k]} onChange={(e) => setKal({ ...kal, [k]: e.target.value })} /></F>
              ))}
              <div className="col-12">
                <span className="form-label d-block">Lokasi kalibrasi</span>
                {[['lab', 'Di Laboratorium PSU (alat dikirim/diantar)'], ['onsite', 'On-site di lokasi pelanggan']].map(([v, l]) => (
                  <div className="form-check form-check-inline" key={v}><input className="form-check-input" type="radio" id={`loc-${v}`} checked={kal.location === v} onChange={() => setKal({ ...kal, location: v })} /><label className="form-check-label" htmlFor={`loc-${v}`}>{l}</label></div>
                ))}
              </div>
              {dyn}
            </div>
          )}

          {stage === 2 && isLab && (
            <div className="row g-3">
              <F label="Produk / bahan yang diuji" id="lp"><Select id="lp" className="form-select" value={lab.product_id} onChange={(e) => setLab({ ...lab, product_id: e.target.value, params: [], full_sni: false })}>{scope.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
              <F label="Jumlah sampel" id="lq"><input id="lq" type="number" min={1} className="form-control" value={lab.quantity} onChange={(e) => setLab({ ...lab, quantity: e.target.value })} /></F>
              <div className="col-12">
                <span className="form-label d-block">Parameter uji <span className="fw-normal text-muted2">(harga per sampel, sudah termasuk PPN 11%)</span></span>
                <div className="d-flex flex-column gap-2 mb-2">
                  <label className={`choice ${lab.full_sni ? 'on' : ''}`}>
                    <input type="radio" name="mode" id="full" checked={lab.full_sni} disabled={!labProduct?.package_price} onChange={() => setLab({ ...lab, full_sni: true, params: [] })} />
                    <span className="flex-grow-1"><b>Parameter lengkap sesuai SNI</b><span className="d-block small text-muted2">Semua {labProduct?.parameters.length} parameter dalam satu paket</span></span>
                    <b className="num">{labProduct?.package_price ? rupiah(labProduct.package_price) : 'belum tersedia'}</b>
                  </label>
                  <label className={`choice ${!lab.full_sni ? 'on' : ''}`}>
                    <input type="radio" name="mode" id="pilih" checked={!lab.full_sni} onChange={() => setLab({ ...lab, full_sni: false })} />
                    <span className="flex-grow-1"><b>Pilih parameter sendiri</b><span className="d-block small text-muted2">Centang parameter yang diperlukan di bawah</span></span>
                  </label>
                </div>
                <div className="table-responsive border rounded">
                  <table className="table table-sm mb-0 small align-middle">
                    <thead><tr><th style={{ width: 40 }}></th><th>Parameter</th><th>Metode</th><th className="text-end">Harga</th></tr></thead>
                    <tbody>{labProduct?.parameters.map((p) => (
                      <tr key={p.id} className={lab.full_sni ? 'text-muted2' : ''}>
                        <td><input className="form-check-input" type="checkbox" id={`pp${p.id}`} disabled={lab.full_sni} checked={lab.full_sni || lab.params.includes(p.id)} onChange={(e) => setLab({ ...lab, params: e.target.checked ? [...lab.params, p.id] : lab.params.filter((x) => x !== p.id) })} /></td>
                        <td><label htmlFor={`pp${p.id}`}>{p.name}</label></td><td className="text-muted2">{p.method || '—'}</td><td className="text-end num">{rupiah(p.price)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <F label="Parameter lainnya (opsional, satu per baris)" id="lo" full>
                <textarea id="lo" className="form-control" rows={2} placeholder="Contoh: Kadar silika (SiO2)" value={lab.custom} onChange={(e) => setLab({ ...lab, custom: e.target.value })} />
                <div className="form-text">Parameter di luar daftar. Harga dikonfirmasi PSU pada invoice.</div>
              </F>
              {dyn}
            </div>
          )}

          {stage === 3 && (
            <div className="d-flex flex-column gap-2">
              {formDef.documents.map((d) => {
                const byAdmin = !!d.admin_if_package && sp.is_package && code === 'SP';
                return (
                  <div key={d.id} className="border rounded p-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div><b>{d.name}</b>{needDoc(d) && <span className="text-danger"> *</span>}
                      <div className="small text-muted2">{byAdmin ? 'Paket LSPro + Lab: disiapkan oleh Admin PSU (opsional bagi Anda)' : 'PDF, ZIP, JPG, atau PNG · maks. 10 MB'}</div></div>
                    <input type="file" className="form-control form-control-sm" style={{ maxWidth: 300 }} accept={FILE_ACCEPT} onChange={(e) => setDocs({ ...docs, [d.name]: e.target.files[0] })} aria-label={d.name} />
                  </div>
                );
              })}
              <div className="small text-muted2"><span className="text-danger">*</span> wajib. Dokumen lain yang belum lengkap bisa dikirim nanti jika Admin meminta (Action Required).</div>
            </div>
          )}

          {stage === 4 && (
            <>
              <dl className="row small">
                <dt className="col-sm-3 text-muted2 fw-normal">Layanan</dt><dd className="col-sm-9">{svc.name}{sp.is_package && code === 'SP' ? ' · paket + pengujian lab' : ''}</dd>
                {code === 'SP' && spProduct && <><dt className="col-sm-3 text-muted2 fw-normal">Produk</dt><dd className="col-sm-9">{spProduct.name} · <span className="mono">{spProduct.standard_no}</span> · {sp.scheme || 'sesuai acuan'}</dd></>}
                {code === 'KAL' && <><dt className="col-sm-3 text-muted2 fw-normal">Alat</dt><dd className="col-sm-9">{kal.name} {kal.brand_model} · {kal.location === 'onsite' ? 'On-site' : 'Di laboratorium'}</dd></>}
                {isLab && labProduct && <><dt className="col-sm-3 text-muted2 fw-normal">Produk & parameter</dt><dd className="col-sm-9">{labProduct.name} · {lab.full_sni ? 'parameter lengkap sesuai SNI' : labProduct.parameters.filter((p) => lab.params.includes(p.id)).map((p) => p.name).join(', ')}{customParams.length > 0 && ` · lainnya: ${customParams.join(', ')}`}</dd></>}
                {fields.filter((f) => values[f.key]).map((f) => <Row key={f.key} k={f.label} v={values[f.key]} />)}
                <dt className="col-sm-3 text-muted2 fw-normal">Dokumen</dt><dd className="col-sm-9">{Object.values(docs).filter(Boolean).length} file</dd>
                <dt className="col-sm-3 text-muted2 fw-normal">Status tracking</dt><dd className="col-sm-9">{svc.steps.length} status, mulai {svc.steps[0].status_code}</dd>
              </dl>
              <div className="alert alert-light border small mb-0">Setelah dikirim, sistem membuat <b>nomor pengajuan</b> untuk arsip dan <b>kode lacak</b> acak yang dikirim ke email Anda untuk cek progres tanpa login.</div>
            </>
          )}
        </div>
        <div className="panel-h border-top border-bottom-0">
          <button className="btn btn-outline-secondary" disabled={stage === 1} onClick={() => setStage(stage - 1)}>Kembali</button>
          {stage < 4 ? <button className="btn btn-primary" onClick={next}>Lanjut<i className="bi bi-arrow-right" /></button>
            : <button className="btn btn-gold" disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim pengajuan'}</button>}
        </div>
      </section>
      </div>
      {stage === 2 && isLab && (
        <div className="col-lg-4">
          <aside className="panel panel-b d-flex flex-column gap-2 small">
            <h2 className="mb-1">Perkiraan biaya</h2>
            <div className="d-flex justify-content-between gap-2"><span>{lab.full_sni ? 'Paket lengkap SNI' : `${lab.params.length} parameter`} × {+lab.quantity || 1} sampel</span><b className="num">{rupiah(labEstimate)}</b></div>
            {customParams.length > 0 && <div className="d-flex justify-content-between text-muted2"><span>{customParams.length} parameter lainnya</span><span>dikonfirmasi PSU</span></div>}
            <div className="border-top pt-2 d-flex justify-content-between align-items-baseline"><span className="fw-semibold">Estimasi</span><span className="big-amount">{rupiah(labEstimate)}</span></div>
            <p className="text-muted2 mb-0">Sudah termasuk PPN 11%. Tagihan resmi dikirim melalui invoice setelah verifikasi.</p>
            {svc?.est_text && <div className="bg-light rounded-3 p-2">Estimasi selesai <b>{svc.est_text}</b> setelah sampel diterima.</div>}
          </aside>
        </div>
      )}
      </div>
    </>
  );
}

const Row = ({ k, v }) => <><dt className="col-sm-3 text-muted2 fw-normal">{k}</dt><dd className="col-sm-9">{v}</dd></>;

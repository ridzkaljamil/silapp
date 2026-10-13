import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg, download } from '../../api';
import { PageHead, Loading, useToast, useConfirm, rupiah, FILE_ACCEPT, Select, useFileGuard } from '../../components/ui';
import { SERVICE_STATE as STATE, PRICE_OPTIONS } from '../../lib/constants';

const stepNames = (code) => ['Pilih Layanan', code === 'SP' ? 'Data Permohonan' : 'Data & Parameter', 'Unggah Dokumen', 'Konfirmasi'];
const APP_TYPES = ['Sertifikasi Awal', 'Surveillance', 'Re-sertifikasi', 'Perluasan Ruang Lingkup', 'Perubahan Data/Merek', 'Transfer Sertifikasi'];
/** Sertifikasi Awal dan Surveillance boleh dicentang bersamaan; jenis lain hanya satu. */
const PAIR = ['Sertifikasi Awal', 'Surveillance'];
const pickType = (cur, t) => {
  if (!PAIR.includes(t)) return [t];
  const base = cur.filter((x) => PAIR.includes(x));
  return base.includes(t) ? base.filter((x) => x !== t) : [...base, t];
};
const SURV_TEXT = 'Kami bersedia dilakukan surveilan oleh PT Penilai Standar Uji selama masa berlaku sertifikat.';
const ORIGINS = [['dn', 'Dalam Negeri'], ['ln', 'Luar Negeri']];
/** PPN 12% × DPP nilai lain (11/12 harga) = 11% dari harga, sama dengan invoice PSU. */
const ppnOf = (h) => Math.round((h * 11) / 100);
const EMPTY_SP = { category: '', product_id: '', scheme: '', types: ['Sertifikasi Awal'], origin: '', brands: [{ merek: '', jenis: '' }], is_package: false };
const EMPTY_LAB = { product_id: '', quantity: 1, params: [], full_sni: false, custom: [''], option: 'std' };
const EMPTY_KAL = { name: '', brand_model: '', serial_number: '', range_capacity: '', resolution: '', calibration_points: '', accessories: '', quantity: 1, location: 'lab' };
const validQty = (v) => Number.isInteger(+v) && +v >= 1 && +v <= 999 && String(v).trim() !== '';
const fmtSaved = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Pembungkus label + field (di luar komponen agar input tidak kehilangan fokus saat mengetik). */
const F = ({ label, children, id, full, req }) => <div className={full ? 'col-12' : 'col-md-6'}><label className="form-label" htmlFor={id}>{label}{req ? <span className="text-danger"> *</span> : null}</label>{children}</div>;

/** Isian dari form builder (diatur Super Admin). */
function DynField({ f, value, onChange }) {
  const id = `fx-${f.key}`;
  const common = { id, className: f.type === 'select' ? 'form-select' : 'form-control', value: value || '', onChange: (e) => onChange(f.key, e.target.value), required: !!f.required };
  let input;
  if (f.type === 'textarea') input = <textarea rows={2} {...common} />;
  else if (f.type === 'select') input = <Select {...common}><option value="">— Pilih —</option>{(f.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o}>{o}</option>)}</Select>;
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
  const [sp, setSp] = useState(EMPTY_SP);
  const [lab, setLab] = useState(EMPTY_LAB);
  const [kal, setKal] = useState(EMPTY_KAL);
  const [values, setValues] = useState({});
  const [docs, setDocs] = useState({});
  // dokumen pendukung lain di luar daftar wajib: [{ name, file }]
  const [extraDocs, setExtraDocs] = useState([]);
  const confirm = useConfirm();
  const guard = useFileGuard();
  const submitted = useRef(false);
  const [templates, setTemplates] = useState([]);
  // draft tersimpan di server (berkas tidak ikut disimpan)
  const [draft, setDraft] = useState(undefined);
  const [savedAt, setSavedAt] = useState(null);
  const restoring = useRef(null);
  const [params] = useSearchParams();

  useEffect(() => {
    api.get('/public/services').then((r) => setServices(r.data));
    api.get('/templates').then((r) => setTemplates(r.data)).catch(() => {});
    const from = params.get('dari');
    if (from) {
      // "Ajukan Ulang" dari pengajuan yang dibatalkan: isi form dengan data lama
      api.get(`/applications/${from}/prefill`).then((r) => { resume(r.data); toast('Data pengajuan sebelumnya sudah diisikan. Periksa lalu unggah ulang dokumennya.'); }).catch((e) => toast(errMsg(e), 'danger'));
    }
    api.get('/drafts').then((r) => {
      setDraft(r.data);
      if (r.data && params.get('draft') && !from) resume(r.data);
    }).catch(() => setDraft(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!code) return;
    const d = restoring.current;
    if (!d) { setValues({}); setDocs({}); setExtraDocs([]); }
    api.get(`/public/services/${code}/form`).then((r) => setFormDef(r.data));
    api.get(`/public/services/${code}/scope`).then((r) => {
      setScope(r.data);
      if (d) {
        const p = d.payload || {};
        if (p.sp) setSp({ ...EMPTY_SP, ...p.sp });
        if (p.lab) setLab({ ...EMPTY_LAB, ...p.lab });
        if (p.kal) setKal({ ...EMPTY_KAL, ...p.kal });
        setValues(p.values || {});
        setStage(Math.min(d.stage || 1, 3));
        restoring.current = null;
      } else if (code !== 'SP') setLab({ ...EMPTY_LAB, product_id: r.data[0]?.id || '' });
    });
  }, [code]);

  const resume = (d) => {
    restoring.current = d;
    setSavedAt(d.updated_at || null);
    if (d.service_code === code) { setCode(''); setTimeout(() => setCode(d.service_code)); } else setCode(d.service_code);
  };
  const saveDraft = async (quiet) => {
    if (!code || submitted.current) return;
    try {
      const r = await api.put('/drafts', { service_code: code, stage, payload: { sp, lab, kal, values } });
      setSavedAt(r.data.updated_at);
      if (!quiet) toast('Draft disimpan. Anda bisa melanjutkannya nanti dari Beranda.');
    } catch (e) { if (!quiet) toast(errMsg(e), 'danger'); }
  };
  // simpan otomatis 2 detik setelah ada perubahan di langkah 2–3 (langkah 4 = siap dikirim, tidak disimpan ulang)
  useEffect(() => {
    if (!code || stage < 2 || stage > 3 || busy || restoring.current) return undefined;
    const t = setTimeout(() => saveDraft(true), 2000);
    return () => clearTimeout(t);
  }, [code, stage, sp, lab, kal, values, busy]); // eslint-disable-line react-hooks/exhaustive-deps
  const discardDraft = async () => {
    await api.delete('/drafts').catch(() => {});
    setDraft(null); setSavedAt(null);
    toast('Draft dihapus.');
  };

  const svc = services?.find((s) => s.code === code);
  const categories = useMemo(() => [...new Set(scope.map((p) => p.category))].map((c) => [c, scope.filter((p) => p.category === c).length]), [scope]);
  const spProducts = scope.filter((p) => p.category === sp.category);
  const spProduct = scope.find((p) => p.id === +sp.product_id);
  const schemes = spProduct?.scheme_types ? spProduct.scheme_types.split('/').map((x) => x.trim()) : [];
  const is1B = /1b/i.test(sp.scheme);
  const isLab = code && code !== 'SP' && code !== 'KAL';
  const labProduct = scope.find((p) => p.id === +lab.product_id);
  const priceOpt = PRICE_OPTIONS[code];
  const alt = !!priceOpt && lab.option === 'alt';
  const optName = priceOpt?.[alt ? 1 : 0];
  const priceOf = (p) => (alt ? p.price_alt ?? p.price : p.price);
  const pkgPrice = labProduct ? (alt ? labProduct.package_price_alt ?? labProduct.package_price : labProduct.package_price) : null;
  // Ekspress tanpa harga khusus: harga Reguler + biaya tambahan yang dikonfirmasi PSU
  const altExtra = alt && !!labProduct && (lab.full_sni ? labProduct.package_price_alt == null : labProduct.parameters.some((p) => lab.params.includes(p.id) && p.price_alt == null));
  const pickProduct = (p) => setLab({ ...lab, product_id: p.id, params: [], full_sni: false, option: p.alt_available ? lab.option : 'std' });
  const customParams = lab.custom.map((x) => x.trim()).filter(Boolean);
  const setCustom = (i, v) => setLab({ ...lab, custom: lab.custom.map((x, k) => (k === i ? v : x)) });
  const surveillance = code === 'SP' && sp.types.includes('Surveillance');
  const docList = formDef.documents.filter((d) => d.show_when !== 'SURV' || surveillance);
  const setExtra = (i, k, v) => setExtraDocs(extraDocs.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  const setBrand = (i, k, v) => setSp({ ...sp, brands: sp.brands.map((b, n) => (n === i ? { ...b, [k]: v } : b)) });
  const templateOf = (name) => templates.find((t) => t.name === name);
  const fields = formDef.fields.filter((f) => f.show_when !== '1B' || (code === 'SP' && is1B));
  const needDoc = (d) => !!d.required && !(d.admin_if_package && sp.is_package && code === 'SP');
  const labEstimate = labProduct ? (lab.full_sni ? +pkgPrice || 0
    : labProduct.parameters.filter((p) => lab.params.includes(p.id)).reduce((t, p) => t + (+priceOf(p) || 0), 0)) * (+lab.quantity || 1) : 0;
  const labPpn = ppnOf(labEstimate);
  const noPrice = !!labProduct && !lab.full_sni && labProduct.parameters.some((p) => lab.params.includes(p.id) && priceOf(p) == null);

  if (!services) return <Loading />;
  const leaves = services.filter((s) => s.bidang);
  const STEPS = stepNames(code);
  const parents = services.filter((s) => !s.parent_id);
  const setVal = (k, v) => setValues((x) => ({ ...x, [k]: v }));

  const validate = () => {
    if (stage === 1 && !code) return 'Pilih layanan dulu.';
    if (stage === 1 && svc?.state !== 'ok') return `${svc?.name} belum beroperasi.`;
    if (stage === 2) {
      if (code === 'SP' && !sp.types.length) return 'Pilih jenis permohonan.';
      if (code === 'SP' && !sp.product_id) return 'Pilih produk dari ruang lingkup.';
      if (code === 'SP' && !sp.origin) return 'Pilih asal produk: Dalam Negeri atau Luar Negeri.';
      if (code === 'SP' && !sp.brands.some((b) => b.merek.trim())) return 'Isi minimal satu Merek beserta Jenisnya.';
      if (code === 'SP' && sp.brands.some((b) => !b.merek.trim() && b.jenis.trim())) return 'Setiap Jenis harus disertai Merek.';
      if (code === 'SP' && schemes.length && !sp.scheme) return 'Pilih skema sertifikasi.';
      if (code === 'KAL' && !kal.name.trim()) return 'Nama alat wajib diisi.';
      if (code === 'KAL' && !validQty(kal.quantity)) return 'Jumlah alat harus bilangan bulat 1–999.';
      if (isLab && !validQty(lab.quantity)) return 'Jumlah sampel harus bilangan bulat 1–999.';
      if (isLab && !lab.full_sni && !lab.params.length && !customParams.length) return 'Pilih minimal satu parameter uji.';
      const miss = fields.find((f) => f.required && !String(values[f.key] || '').trim());
      if (miss) return `${miss.label} wajib diisi.`;
    }
    if (stage === 3) {
      const miss = docList.find((d) => needDoc(d) && !docs[d.name]);
      if (miss) return `Berkas "${miss.name}" wajib diunggah.`;
      const bad = extraDocs.find((x) => (x.file && !x.name.trim()) || (!x.file && x.name.trim()));
      if (bad) return 'Lengkapi nama dan file setiap dokumen pendukung, atau hapus barisnya.';
    }
    return null;
  };
  const next = () => { const e = validate(); if (e) return toast(e, 'danger'); setStage(stage + 1); return null; };

  const submit = async () => {
    const data = { fields: Object.fromEntries(fields.map((f) => [f.key, values[f.key] || ''])) };
    if (code === 'SP') {
      Object.assign(data, { product_id: +sp.product_id, scheme: sp.scheme || null, application_type: sp.types.join(', '), origin: sp.origin,
        brands: sp.brands.filter((b) => b.merek.trim()), is_package: sp.is_package });
    } else if (code === 'KAL') {
      Object.assign(data, { equipment: { ...kal, quantity: +kal.quantity }, location: kal.location });
    } else {
      Object.assign(data, { product_id: +lab.product_id || null, price_option: alt ? 'alt' : 'std', full_sni: lab.full_sni, parameter_ids: lab.full_sni ? [] : lab.params, custom_params: customParams, sample: { description: labProduct?.name, quantity: +lab.quantity } });
    }
    const fd = new FormData();
    fd.append('service_code', code);
    fd.append('data', JSON.stringify(data));
    const types = [];
    docList.forEach((d) => { const f = docs[d.name]; if (f) { fd.append('documents', f); types.push(d.name); } });
    extraDocs.filter((x) => x.file && x.name.trim()).forEach((x) => { fd.append('documents', x.file); types.push(`Dokumen Pendukung: ${x.name.trim()}`); });
    fd.append('doc_types', JSON.stringify(types));
    setBusy(true);
    try {
      let r;
      try { r = await api.post('/applications', fd); } catch (e) {
        if (e?.response?.data?.code !== 'DUPLICATE') throw e;
        // pengajuan ganda: tanyakan dulu sebelum tetap mengirim
        const ex = e.response.data.existing;
        const go = await confirm({ title: 'Pengajuan Serupa Masih Berjalan', icon: 'exclamation-triangle', ok: 'Tetap Ajukan',
          body: <>Anda masih punya pengajuan <b>{ex.application_no}</b> ({ex.product_label}) yang sedang diproses. Tetap kirim pengajuan baru?</> });
        if (!go) return;
        data.confirm_duplicate = true;
        fd.set('data', JSON.stringify(data));
        r = await api.post('/applications', fd);
      }
      submitted.current = true;
      await api.delete('/drafts').catch(() => {});
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
      <PageHead eyebrow="Ajukan Layanan" title={stage === 1 ? 'Pilih Layanan' : `Ajukan · ${svc?.name}`}
        sub={stage === 1 ? 'Pilih layanan yang ingin diajukan. Setelah terkirim, Anda akan menerima nomor pengajuan dan kode lacak lewat email.' : null} />
      <div className="wizard mb-3" aria-label="Langkah">
        {STEPS.map((s, i) => <div key={s} className={i + 1 === stage ? 'on' : i + 1 < stage ? 'done' : ''} aria-current={i + 1 === stage ? 'step' : undefined}><span>Langkah {i + 1}{i + 1 === stage ? ' · sekarang' : ''}</span><b>{s}</b></div>)}
      </div>
      <div className="row g-3 align-items-start">
      <div className={stage === 2 && isLab ? 'col-lg-8' : 'col-12'}>
      <section className="panel">
        <div className="panel-b swap" key={stage}>
          {stage === 1 && draft && (
            <DraftCard d={draft} onResume={() => resume(draft)} onDiscard={discardDraft} />
          )}
          {stage === 1 && parents.map((p) => {
            const items = p.bidang || !leaves.some((s) => s.parent_id === p.id) ? [p] : leaves.filter((s) => s.parent_id === p.id);
            return (
              <div key={p.id} className="mb-3">
                <div className="eyebrow mb-2">{p.name}</div>
                <div className="row g-2">
                  {items.map((s) => (
                    <div className="col-sm-6 col-lg-3" key={s.code}>
                      <button type="button" className={`pick-card ${code === s.code ? 'active' : ''}`} disabled={!s.bidang || s.state !== 'ok'} title={s.state !== 'ok' ? 'Layanan ini belum beroperasi' : undefined} onClick={() => setCode(s.code)}>
                        <b className="d-block" style={{ color: 'var(--navy)' }}>{s.name}</b>
                        <span className="small text-muted2 d-block">{s.steps.length} tahap{s.est_text ? ` · ${s.est_text}` : ''}</span>
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
                    <span className="flex-grow-1"><i className="bi bi-lightbulb me-1" />Produk ini bisa diuji di {spProduct.lab_test.service} PSU{spProduct.lab_test.price ? <> (paket lengkap SNI {rupiah(spProduct.lab_test.price)}/sampel, belum termasuk PPN)</> : ''}. Pilih paket agar sertifikasi dan uji lab diproses bersama dan ditagih dalam <b>satu invoice</b>.</span>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setSp({ ...sp, is_package: true })}>Pilih Paket</button>
                  </div>
                )}
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="pkg" checked={sp.is_package} onChange={(e) => setSp({ ...sp, is_package: e.target.checked })} />
                  <label className="form-check-label" htmlFor="pkg"><b>Paket Sertifikasi Produk + Pengujian Laboratorium PSU</b><span className="d-block small text-muted2">Sertifikasi dan uji lab ditagih dalam satu invoice (jumlah sampel = jumlah merek). Surat permohonan pengujian disiapkan oleh Admin PSU. Hasil lab (LHU) ditampilkan pada tahap Pengujian laboratorium.</span></label>
                </div>
              </div>
              {dyn}
            </div>
          )}

          {stage === 2 && code === 'KAL' && (
            <div className="row g-3">
              {[['name', 'Nama Alat'], ['brand_model', 'Merek / Tipe-model'], ['serial_number', 'Nomor Seri'], ['range_capacity', 'Kapasitas / Range'], ['resolution', 'Resolusi'], ['calibration_points', 'Titik Kalibrasi yang Diminta'], ['accessories', 'Aksesori yang Disertakan'], ['quantity', 'Jumlah Alat']].map(([k, l]) => (
                <F key={k} label={l} id={k} req={k === 'name'}><input id={k} type={k === 'quantity' ? 'number' : 'text'} min={1} className="form-control" value={kal[k]} onChange={(e) => setKal({ ...kal, [k]: e.target.value })} /></F>
              ))}
              <div className="col-12">
                <span className="form-label d-block">Lokasi Kalibrasi</span>
                {[['lab', 'Di Laboratorium PSU (Alat Dikirim/Diantar)'], ['onsite', 'On-site di Lokasi Pelanggan']].map(([v, l]) => (
                  <div className="form-check form-check-inline" key={v}><input className="form-check-input" type="radio" id={`loc-${v}`} checked={kal.location === v} onChange={() => setKal({ ...kal, location: v })} /><label className="form-check-label" htmlFor={`loc-${v}`}>{l}</label></div>
                ))}
              </div>
              {dyn}
            </div>
          )}

          {stage === 2 && isLab && (
            <div className="row g-3">
              {scope.length === 0 && <div className="col-12"><div className="alert alert-light border small mb-0">Daftar parameter untuk layanan ini belum tersedia. Tuliskan parameter yang Anda butuhkan di kolom di bawah; harganya akan dikonfirmasi PSU di invoice.</div></div>}
              {scope.length === 0 && <F label="Jumlah Sampel" id="lq"><input id="lq" type="number" min={1} className="form-control" value={lab.quantity} onChange={(e) => setLab({ ...lab, quantity: e.target.value })} /></F>}
              {scope.length > 0 && (<>
              <F label="Produk / Bahan yang Diuji" id="lp"><Select id="lp" className="form-select" value={lab.product_id} onChange={(e) => pickProduct(scope.find((p) => p.id === +e.target.value))}>{scope.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
              <F label="Jumlah Sampel" id="lq"><input id="lq" type="number" min={1} className="form-control" value={lab.quantity} onChange={(e) => setLab({ ...lab, quantity: e.target.value })} /></F>
              {labProduct?.note && <div className="col-12"><div className="alert alert-light border small mb-0"><i className="bi bi-info-circle me-1" />{labProduct.note}</div></div>}
              {priceOpt && (
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
              <div className="col-12">
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
              </div>
              </>)}
              <div className="col-12">
                <span className="form-label d-block">{scope.length ? 'Parameter Lainnya (Opsional)' : 'Parameter yang Dibutuhkan'}</span>
                <div className="d-flex flex-column gap-2">
                  {lab.custom.map((v, i) => (
                    <div key={i} className="pair-row pair-one">
                      <input className="form-control" placeholder="Contoh: Kadar Silika (SiO₂)" aria-label={`Parameter lainnya ${i + 1}`} value={v} onChange={(e) => setCustom(i, e.target.value)} />
                      <button type="button" className="btn btn-outline-danger" aria-label={`Hapus parameter ${i + 1}`} disabled={lab.custom.length === 1 && !v} onClick={() => setLab({ ...lab, custom: lab.custom.length === 1 ? [''] : lab.custom.filter((_, k) => k !== i) })}><i className="bi bi-trash" /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm mt-2" disabled={lab.custom.length >= 20} onClick={() => setLab({ ...lab, custom: [...lab.custom, ''] })}><i className="bi bi-plus-lg" />Tambah Parameter</button>
                <div className="form-text">Harga parameter lainnya dikonfirmasi PSU di invoice.</div>
              </div>
              {dyn}
            </div>
          )}

          {stage === 3 && (
            <div className="d-flex flex-column gap-2">
              {docList.map((d) => {
                const byAdmin = !!d.admin_if_package && sp.is_package && code === 'SP';
                const file = docs[d.name];
                const tpl = templateOf(d.name);
                const id = `doc-${d.id}`;
                return (
                  <div key={d.id} className={`doc-row ${file ? 'has-file' : ''}`}>
                    <div className="flex-grow-1 min-w-0"><b>{d.name}</b>{needDoc(d) && <span className="text-danger"> *</span>}
                      <div className="small text-muted2">{byAdmin ? 'Paket LSPro + Lab: disiapkan oleh Admin PSU (opsional bagi Anda)' : file ? <span style={{ color: 'var(--ok)' }}><i className="bi bi-check-circle-fill me-1" />{file.name}</span> : 'PDF, Word, ZIP, JPG, atau PNG · maks. 10 MB'}</div>
                      {tpl && <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={() => download(`/templates/${tpl.id}/download`, tpl.original_name)}><i className="bi bi-file-earmark-word" />Unduh Template</button>}
                    </div>
                    <input type="file" id={id} className="visually-hidden" accept={FILE_ACCEPT} onChange={(e) => { const [f0] = guard(e.target.files); if (f0) setDocs({ ...docs, [d.name]: f0 }); e.target.value = ''; }} />
                    <label htmlFor={id} className={`btn btn-sm ${file ? 'btn-outline-secondary' : 'btn-primary'}`}><i className={`bi bi-${file ? 'arrow-repeat' : 'upload'}`} />{file ? 'Ganti File' : 'Pilih File'}</label>
                    {file && <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Hapus ${d.name}`} onClick={() => setDocs({ ...docs, [d.name]: null })}><i className="bi bi-x-lg" /></button>}
                  </div>
                );
              })}
              <div className="extra-docs">
                <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                  <span><b>Dokumen Pendukung Lainnya</b> <span className="small text-muted2">(opsional)</span></span>
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={extraDocs.length >= 8} onClick={() => setExtraDocs([...extraDocs, { name: '', file: null }])}><i className="bi bi-plus-lg" />Tambah Dokumen</button>
                </div>
                {extraDocs.map((x, i) => (
                  <div key={i} className={`doc-row mt-2 ${x.file ? 'has-file' : ''}`}>
                    <input className="form-control flex-grow-1" style={{ minWidth: 180, flexBasis: 220 }} placeholder="Nama dokumen, mis. Brosur Produk" aria-label={`Nama dokumen pendukung ${i + 1}`} value={x.name} onChange={(e) => setExtra(i, 'name', e.target.value)} />
                    <input type="file" id={`xd-${i}`} className="visually-hidden" accept={FILE_ACCEPT} onChange={(e) => { const [f0] = guard(e.target.files); if (f0) setExtra(i, 'file', f0); e.target.value = ''; }} />
                    <label htmlFor={`xd-${i}`} className={`btn btn-sm ${x.file ? 'btn-outline-secondary' : 'btn-primary'} text-truncate`} style={{ maxWidth: 220 }}><i className={`bi bi-${x.file ? 'arrow-repeat' : 'upload'}`} />{x.file ? x.file.name : 'Pilih File'}</label>
                    <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Hapus dokumen pendukung ${i + 1}`} onClick={() => setExtraDocs(extraDocs.filter((_, n) => n !== i))}><i className="bi bi-trash" /></button>
                  </div>
                ))}
              </div>
              <div className="small text-muted2"><span className="text-danger">*</span> wajib. Template surat dapat diunduh di menu Template Dokumen.</div>
            </div>
          )}

          {stage === 4 && (
            <>
              <dl className="row small">
                <dt className="col-sm-3 text-muted2 fw-normal">Layanan</dt><dd className="col-sm-9">{svc.name}{sp.is_package && code === 'SP' ? ' · paket + pengujian lab' : ''}</dd>
                {code === 'SP' && <Row k="Jenis Permohonan" v={sp.types.join(' + ')} />}
                {code === 'SP' && spProduct && <><dt className="col-sm-3 text-muted2 fw-normal">Produk</dt><dd className="col-sm-9">{spProduct.name} · <span className="mono">{spProduct.standard_no}</span> · {sp.scheme || 'Sesuai Acuan'} · {ORIGINS.find((o) => o[0] === sp.origin)?.[1]}</dd></>}
                {code === 'SP' && <Row k="Merek & Jenis" v={sp.brands.filter((b) => b.merek.trim()).map((b) => `${b.merek}${b.jenis ? ` · ${b.jenis}` : ''}`).join('; ')} />}
                {code === 'KAL' && <><dt className="col-sm-3 text-muted2 fw-normal">Alat</dt><dd className="col-sm-9">{kal.name} {kal.brand_model} · {kal.location === 'onsite' ? 'On-site' : 'Di laboratorium'}</dd></>}
                {isLab && labProduct && <><dt className="col-sm-3 text-muted2 fw-normal">Produk & parameter</dt><dd className="col-sm-9">{labProduct.name}{optName ? ` · ${optName}` : ''} · {lab.full_sni ? 'parameter lengkap sesuai SNI' : labProduct.parameters.filter((p) => lab.params.includes(p.id)).map((p) => p.name).join(', ')}{customParams.length > 0 && ` · lainnya: ${customParams.join(', ')}`}</dd></>}
                {fields.filter((f) => values[f.key]).map((f) => <Row key={f.key} k={f.label} v={values[f.key]} />)}
                <dt className="col-sm-3 text-muted2 fw-normal">Dokumen</dt><dd className="col-sm-9">{[...docList.filter((d) => docs[d.name]).map((d) => d.name), ...extraDocs.filter((x) => x.file).map((x) => x.name)].join(', ') || 'Belum ada'}</dd>
                <dt className="col-sm-3 text-muted2 fw-normal">Tahapan Proses</dt><dd className="col-sm-9">{svc.steps.length} status, mulai {svc.steps[0].status_code}</dd>
              </dl>
              <div className="alert alert-light border small mb-0">Setelah dikirim, sistem membuat <b>nomor pengajuan</b> untuk arsip dan <b>kode lacak</b> acak yang dikirim ke email Anda untuk cek progres tanpa login.</div>
            </>
          )}
        </div>
        <div className="panel-h border-top border-bottom-0 wiz-foot">
          <button className="btn btn-outline-secondary wf-back" disabled={stage === 1} onClick={() => setStage(stage - 1)}>Kembali</button>
          {code && stage > 1 && stage < 4 && (
            <span className="wf-draft">
              {savedAt && <span className="small text-muted2 d-none d-md-inline">Draft tersimpan {fmtSaved(savedAt)}</span>}
              <button type="button" className="btn btn-outline-secondary" onClick={() => saveDraft(false)}><i className="bi bi-floppy" />Simpan Draft</button>
            </span>
          )}
          {stage < 4 ? <button className="btn btn-primary wf-next" onClick={next}>Lanjut<i className="bi bi-arrow-right" /></button>
            : <button className="btn btn-gold wf-next" disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim Pengajuan'}</button>}
        </div>
      </section>
      </div>
      {stage === 2 && isLab && (
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
            <p className="text-muted2 mb-0">Estimasi Total = harga + PPN. Bila perusahaan Anda memotong PPh 23 (2% dari harga), nilai yang dibayar berkurang sebesar potongan itu. Tagihan resmi dikirim melalui invoice setelah verifikasi.</p>
            {svc?.est_text && <div className="bg-light rounded-3 p-2">Estimasi selesai <b>{code === 'KIM' ? (alt ? '2–3 hari per sampel' : '5–7 hari per sampel') : svc.est_text}</b> setelah sampel diterima.</div>}
          </aside>
        </div>
      )}
      </div>
    </>
  );
}

/** Kartu "Lanjutkan Draft" (juga dipakai di Beranda). */
export function DraftCard({ d, onResume, onDiscard, to }) {
  const body = (
    <>
      <span className="ic"><i className="bi bi-pencil-square" /></span>
      <span className="tx"><b>Lanjutkan Draft Pengajuan</b><span>{d.service_name || d.service_code} · Langkah {d.stage} dari 4 · disimpan {fmtSaved(d.updated_at)}</span></span>
    </>
  );
  return (
    <div className="draft-card">
      {body}
      <span className="acts">
        {onDiscard && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDiscard}>Hapus Draft</button>}
        {to ? <Link to={to} className="btn btn-gold btn-sm">Lanjutkan</Link> : <button type="button" className="btn btn-gold btn-sm" onClick={onResume}>Lanjutkan</button>}
      </span>
    </div>
  );
}

const Row = ({ k, v }) => <><dt className="col-sm-3 text-muted2 fw-normal">{k}</dt><dd className="col-sm-9">{v}</dd></>;

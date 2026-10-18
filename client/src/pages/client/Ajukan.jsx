import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, useConfirm, useFileGuard, taxes } from '../../components/ui';
import { SERVICE_STATE as STATE, PRICE_OPTIONS } from '../../lib/constants';
import { stepNames, EMPTY_SP, EMPTY_LAB, EMPTY_KAL, validQty, filledPairs, DynField, fmtSaved } from './ajukan/shared';
import DraftCard from './ajukan/DraftCard';
import StepSP from './ajukan/StepSP';
import StepKal from './ajukan/StepKal';
import StepLab from './ajukan/StepLab';
import StepDocs from './ajukan/StepDocs';
import StepReview from './ajukan/StepReview';
import LabSummary from './ajukan/LabSummary';


/** Ajukan Layanan: wizard 4 langkah (pilih layanan, data, berkas, konfirmasi) dengan draft tersimpan otomatis. */
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
      const r = await api.put('/drafts', { service_code: code, stage, payload: { sp, lab, kal, values } }, { silent: true });
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
    if (!(await confirm({ title: 'Hapus Draft?', body: 'Isian pengajuan yang tersimpan akan dihapus dan tidak dapat dikembalikan.', ok: 'Hapus Draft', danger: true, icon: 'trash' }))) return;
    await api.delete('/drafts', { silent: true }).catch(() => {});
    setDraft(null); setSavedAt(null);
    toast('Draft dihapus.');
  };

  const svc = services?.find((s) => s.code === code);
  const categories = useMemo(() => [...new Set(scope.map((p) => p.category))].map((c) => [c, scope.filter((p) => p.category === c).length]), [scope]);
  const spProducts = scope.filter((p) => p.category === sp.category);
  const spProduct = scope.find((p) => p.id === +sp.product_id);
  const schemes = spProduct?.scheme_types ? spProduct.scheme_types.split('/').map((x) => x.trim()) : [];
  const is1B = /1b/i.test(sp.scheme);
  // SP skema Tipe 1b memakai alur tahapan sendiri (tanpa audit & tindakan perbaikan)
  const flowSteps = (code === 'SP' && is1B && svc?.steps_1b?.length ? svc.steps_1b : svc?.steps) || [];
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
  // produk di luar lingkup akreditasi KAN: nama produk & parameter ditulis pelanggan
  const customProduct = !!labProduct?.custom_name;
  const setSpec = (i, k, v) => setLab({ ...lab, specs: lab.specs.map((x, n) => (n === i ? { ...x, [k]: v } : x)) });
  const labSpecs = lab.specs.filter((x) => x.brand.trim() || x.spec.trim());
  const specText = (x) => [x.brand.trim(), x.spec.trim()].filter(Boolean).join(' / ');
  const setCustom = (i, v) => setLab({ ...lab, custom: lab.custom.map((x, k) => (k === i ? v : x)) });
  const surveillance = code === 'SP' && sp.types.includes('Surveillance');
  // berkas yang tidak diperlukan untuk tipe skema terpilih (mis. Tipe 1b) disembunyikan — diatur di Kelola Layanan
  const hiddenForScheme = (d) => code === 'SP' && !!sp.scheme && String(d.hide_schemes || '').split(',').map((x) => x.trim().toLowerCase()).includes(sp.scheme.trim().toLowerCase());
  const docList = formDef.documents.filter((d) => (d.show_when !== 'SURV' || surveillance) && !hiddenForScheme(d));
  const setExtra = (i, k, v) => setExtraDocs(extraDocs.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  const setBrand = (i, k, v) => setSp({ ...sp, brands: sp.brands.map((b, n) => (n === i ? { ...b, [k]: v } : b)) });
  const templateOf = (name) => templates.find((t) => t.name === name);
  const fields = formDef.fields.filter((f) => f.show_when !== '1B' || (code === 'SP' && is1B));
  const needDoc = (d) => !!d.required && !(d.admin_if_package && sp.is_package && code === 'SP');
  const labEstimate = labProduct ? (lab.full_sni ? +pkgPrice || 0
    : labProduct.parameters.filter((p) => lab.params.includes(p.id)).reduce((t, p) => t + (+priceOf(p) || 0), 0)) * (+lab.quantity || 1) : 0;
  const labPpn = taxes(labEstimate).ppn;
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
      if (isLab && customProduct && !lab.custom_product.trim()) return 'Tuliskan nama produk yang akan diuji.';
      if (isLab && customProduct && !customParams.length) return 'Tuliskan minimal satu parameter yang dibutuhkan.';
      if (isLab && !lab.full_sni && !lab.params.length && !customParams.length) return 'Pilih minimal satu parameter uji.';
      for (const f of fields.filter((x) => x.type === 'nomor_tanggal')) {
        const rows = filledPairs(values[f.key]);
        if (rows.some((r) => !r.no?.trim())) return `Nomor pada isian ${f.label} wajib diisi.`;
        if (rows.some((r) => !r.date)) return `Tanggal pada isian ${f.label} wajib diisi.`;
        if (f.required && !rows.length) return `${f.label} wajib diisi.`;
      }
      const miss = fields.find((f) => f.type !== 'nomor_tanggal' && f.required && !String(values[f.key] || '').trim());
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
    if (busy) return;
    const ok = await confirm({ title: 'Kirim Pengajuan?', icon: 'send', ok: 'Ya, Kirim',
      body: <>Pengajuan <b>{svc?.name}</b> akan dikirim ke PSU. Pastikan data dan berkas sudah benar; setelah terkirim data tidak dapat diubah sendiri.</> });
    if (!ok) return;
    const data = { fields: Object.fromEntries(fields.map((f) => [f.key, f.type === 'nomor_tanggal' ? filledPairs(values[f.key]) : values[f.key] || ''])) };
    if (code === 'SP') {
      Object.assign(data, { product_id: +sp.product_id, scheme: sp.scheme || null, application_type: sp.types.join(', '), origin: sp.origin,
        brands: sp.brands.filter((b) => b.merek.trim()), is_package: sp.is_package });
    } else if (code === 'KAL') {
      Object.assign(data, { equipment: { ...kal, quantity: +kal.quantity }, location: kal.location });
    } else {
      Object.assign(data, { product_id: +lab.product_id || null, price_option: alt ? 'alt' : 'std', full_sni: lab.full_sni, parameter_ids: lab.full_sni ? [] : lab.params, custom_params: customParams, custom_product: customProduct ? lab.custom_product.trim() : '', specs: labSpecs.map((x) => ({ brand: x.brand.trim(), spec: x.spec.trim() })), sample: { description: customProduct ? lab.custom_product.trim() : labProduct?.name, quantity: +lab.quantity } });
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
      await api.delete('/drafts', { silent: true }).catch(() => {});
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

  // data & fungsi yang dipakai komponen tiap langkah
  const ctx = { alt, altExtra, categories, code, customParams, customProduct, docList, docs, dyn, extraDocs, fields, flowSteps, guard, isLab, kal, lab, labEstimate, labPpn, labProduct, labSpecs, needDoc, noPrice, optName, pickProduct, pkgPrice, priceOf, priceOpt, schemes, scope, setBrand, setCustom, setDocs, setExtra, setExtraDocs, setKal, setLab, setSp, setSpec, sp, spProduct, spProducts, specText, surveillance, svc, templateOf, templates, values };

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

          {stage === 2 && code === 'SP' && <StepSP x={ctx} />}

          {stage === 2 && code === 'KAL' && <StepKal x={ctx} />}

          {stage === 2 && isLab && <StepLab x={ctx} />}

          {stage === 3 && <StepDocs x={ctx} />}

          {stage === 4 && <StepReview x={ctx} />}
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
      {stage === 2 && isLab && <LabSummary x={ctx} />}
      </div>
    </>
  );
}

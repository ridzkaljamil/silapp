import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast } from '../../components/ui';

const STEPS = ['Pilih layanan', 'Data & parameter', 'Unggah dokumen', 'Konfirmasi'];
const STATE = { dev: 'Pengembangan', prep: 'Persiapan' };
const DOCS = {
  SP: ['Akta perusahaan & NIB', 'Spesifikasi produk', 'Sertifikat merek', 'Dokumen sistem mutu'],
  KAL: ['Foto / data teknis alat', 'Surat permohonan'],
  LAB: ['Surat permohonan', 'Data sampel / spesifikasi'],
};
const APP_TYPES = ['Sertifikasi baru', 'Re-sertifikasi', 'Perluasan ruang lingkup', 'Perubahan data/merek', 'Transfer'];

/** Pembungkus label + field (di luar komponen agar input tidak kehilangan fokus saat mengetik). */
const F = ({ label, children, id, full }) => <div className={full ? 'col-12' : 'col-md-6'}><label className="form-label" htmlFor={id}>{label}</label>{children}</div>;

export default function Ajukan() {
  const nav = useNavigate();
  const toast = useToast();
  const [services, setServices] = useState(null);
  const [stage, setStage] = useState(1);
  const [code, setCode] = useState('');
  const [scope, setScope] = useState([]);
  const [busy, setBusy] = useState(false);
  // data form
  const [sp, setSp] = useState({ category: '', product_id: '', scheme: '', application_type: APP_TYPES[0], merek: '', model: '', alamat: '', batch: '', jumlah: '', shipment: '', asal: '' });
  const [lab, setLab] = useState({ product_id: '', quantity: 1, params: [] });
  const [kal, setKal] = useState({ name: '', brand_model: '', serial_number: '', range_capacity: '', resolution: '', calibration_points: '', accessories: '', quantity: 1, location: 'lab' });
  const [docs, setDocs] = useState({});

  useEffect(() => { api.get('/public/services').then((r) => setServices(r.data)); }, []);
  useEffect(() => {
    if (!code) return;
    api.get(`/public/services/${code}/scope`).then((r) => {
      setScope(r.data);
      if (code !== 'SP' && r.data[0]) setLab({ product_id: r.data[0].id, quantity: 1, params: [] });
    });
  }, [code]);

  const svc = services?.find((s) => s.code === code);
  const categories = useMemo(() => [...new Set(scope.map((p) => p.category))], [scope]);
  const spProducts = scope.filter((p) => p.category === sp.category);
  const spProduct = scope.find((p) => p.id === +sp.product_id);
  const schemes = spProduct?.scheme_types ? spProduct.scheme_types.split('/').map((x) => x.trim()) : [];
  const is1B = /1b/i.test(sp.scheme);
  const labProduct = scope.find((p) => p.id === +lab.product_id);
  const docList = DOCS[code === 'SP' ? 'SP' : code === 'KAL' ? 'KAL' : 'LAB'];

  if (!services) return <Loading />;
  const leaves = services.filter((s) => s.bidang);
  const parents = services.filter((s) => !s.parent_id);

  const validate = () => {
    if (stage === 1 && !code) return 'Pilih layanan dulu.';
    if (stage === 2) {
      if (code === 'SP' && !sp.product_id) return 'Pilih produk dari ruang lingkup.';
      if (code === 'SP' && schemes.length && !sp.scheme) return 'Pilih skema sertifikasi.';
      if (code === 'KAL' && !kal.name) return 'Nama alat wajib diisi.';
      if (code !== 'SP' && code !== 'KAL' && !lab.params.length) return 'Pilih minimal satu parameter uji.';
    }
    return null;
  };
  const next = () => { const e = validate(); if (e) return toast(e, 'danger'); setStage(stage + 1); };

  const submit = async () => {
    const data = {};
    if (code === 'SP') {
      Object.assign(data, { product_id: +sp.product_id, scheme: sp.scheme || null, application_type: sp.application_type });
      data.details = [['merek', 'Merek', sp.merek], ['model', 'Jenis; spesifikasi; model', sp.model], ['alamat_pabrik', 'Alamat pabrik', sp.alamat]];
      if (is1B) data.details.push(['batch', 'Nomor batch / lot', sp.batch], ['jumlah', 'Jumlah produk', sp.jumlah], ['shipment', 'Shipment & invoice', sp.shipment], ['asal', 'Negara asal & pelabuhan', sp.asal]);
      data.details = data.details.map(([key, label, value]) => ({ key, label, value }));
    } else if (code === 'KAL') {
      Object.assign(data, { equipment: kal, location: kal.location });
    } else {
      Object.assign(data, { product_id: +lab.product_id, parameter_ids: lab.params, sample: { description: labProduct?.name, quantity: +lab.quantity } });
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

  return (
    <>
      <PageHead eyebrow="Ajukan layanan" title={stage === 1 ? 'Pilih layanan' : svc?.name}>
        <div className="wizard d-flex flex-wrap gap-1">{STEPS.map((s, i) => <span key={s} className={i + 1 === stage ? 'on' : ''}>{i + 1}. {s}</span>)}</div>
      </PageHead>
      <section className="panel">
        <div className="panel-b">
          {stage === 1 && parents.map((p) => {
            const items = p.bidang ? [p] : leaves.filter((s) => s.parent_id === p.id);
            return (
              <div key={p.id} className="mb-3">
                <div className="eyebrow mb-2">{p.name}</div>
                <div className="row g-2">
                  {items.map((s) => (
                    <div className="col-sm-6 col-lg-3" key={s.code}>
                      <button type="button" className={`pick-card ${code === s.code ? 'active' : ''}`} onClick={() => setCode(s.code)}>
                        <b className="d-block" style={{ color: 'var(--psu-navy)' }}>{s.name}</b>
                        <span className="small text-muted2">{s.steps.length} status · {s.est_text}</span>
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
              <F label="Jenis permohonan" id="t"><select id="t" className="form-select" value={sp.application_type} onChange={(e) => setSp({ ...sp, application_type: e.target.value })}>{APP_TYPES.map((x) => <option key={x}>{x}</option>)}</select></F>
              <F label="Kategori produk" id="c"><select id="c" className="form-select" value={sp.category} onChange={(e) => setSp({ ...sp, category: e.target.value, product_id: '', scheme: '' })}><option value="">— pilih —</option>{categories.map((x) => <option key={x}>{x}</option>)}</select></F>
              <F label="Produk dalam ruang lingkup" id="p"><select id="p" className="form-select" value={sp.product_id} onChange={(e) => setSp({ ...sp, product_id: e.target.value, scheme: '' })} disabled={!sp.category}><option value="">— pilih —</option>{spProducts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></F>
              <F label="Skema sertifikasi" id="s"><select id="s" className="form-select" value={sp.scheme} onChange={(e) => setSp({ ...sp, scheme: e.target.value })} disabled={!schemes.length}><option value="">{schemes.length ? '— pilih —' : 'Sesuai acuan skema'}</option>{schemes.map((x) => <option key={x}>{x}</option>)}</select></F>
              {spProduct && <div className="col-12"><div className="alert alert-light border small mb-0"><b>Acuan standar:</b> <span className="mono">{spProduct.standard_no}</span> · <b>Sub kategori:</b> {spProduct.sub_category} · <b>Acuan skema:</b> {spProduct.scheme_reference || '—'}</div></div>}
              <F label="Merek" id="m"><input id="m" className="form-control" value={sp.merek} onChange={(e) => setSp({ ...sp, merek: e.target.value })} /></F>
              <F label="Jenis; spesifikasi; model" id="md"><input id="md" className="form-control" value={sp.model} onChange={(e) => setSp({ ...sp, model: e.target.value })} /></F>
              <F label="Alamat pabrik" id="al" full><input id="al" className="form-control" value={sp.alamat} onChange={(e) => setSp({ ...sp, alamat: e.target.value })} /></F>
              {is1B && (<>
                <div className="col-12 eyebrow">Data tambahan Tipe 1B · per batch/shipment</div>
                <F label="Nomor batch / lot" id="b1"><input id="b1" className="form-control" value={sp.batch} onChange={(e) => setSp({ ...sp, batch: e.target.value })} /></F>
                <F label="Jumlah produk" id="b2"><input id="b2" className="form-control" value={sp.jumlah} onChange={(e) => setSp({ ...sp, jumlah: e.target.value })} /></F>
                <F label="Nomor shipment & invoice" id="b3"><input id="b3" className="form-control" value={sp.shipment} onChange={(e) => setSp({ ...sp, shipment: e.target.value })} /></F>
                <F label="Negara asal & pelabuhan" id="b4"><input id="b4" className="form-control" value={sp.asal} onChange={(e) => setSp({ ...sp, asal: e.target.value })} /></F>
              </>)}
            </div>
          )}

          {stage === 2 && code === 'KAL' && (
            <div className="row g-3">
              {[['name', 'Nama alat'], ['brand_model', 'Merek / tipe-model'], ['serial_number', 'Nomor seri'], ['range_capacity', 'Kapasitas / range'], ['resolution', 'Resolusi'], ['calibration_points', 'Titik kalibrasi yang diminta'], ['accessories', 'Aksesori yang disertakan'], ['quantity', 'Jumlah alat']].map(([k, l]) => (
                <F key={k} label={l} id={k}><input id={k} type={k === 'quantity' ? 'number' : 'text'} min={1} className="form-control" value={kal[k]} onChange={(e) => setKal({ ...kal, [k]: e.target.value })} /></F>
              ))}
              <div className="col-12">
                <span className="form-label d-block">Lokasi kalibrasi</span>
                {[['lab', 'Di Laboratorium PSU (alat dikirim/diantar)'], ['onsite', 'On-site di lokasi pelanggan']].map(([v, l]) => (
                  <div className="form-check form-check-inline" key={v}><input className="form-check-input" type="radio" id={`loc-${v}`} checked={kal.location === v} onChange={() => setKal({ ...kal, location: v })} /><label className="form-check-label" htmlFor={`loc-${v}`}>{l}</label></div>
                ))}
              </div>
            </div>
          )}

          {stage === 2 && code !== 'SP' && code !== 'KAL' && (
            <div className="row g-3">
              <F label="Produk / bahan yang diuji" id="lp"><select id="lp" className="form-select" value={lab.product_id} onChange={(e) => setLab({ ...lab, product_id: e.target.value, params: [] })}>{scope.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></F>
              <F label="Jumlah sampel" id="lq"><input id="lq" type="number" min={1} className="form-control" value={lab.quantity} onChange={(e) => setLab({ ...lab, quantity: e.target.value })} /></F>
              <div className="col-12">
                <span className="form-label d-block">Parameter uji <span className="fw-normal text-muted2">(add-on, tiap parameter dapat menambah biaya)</span></span>
                <div className="table-responsive border rounded">
                  <table className="table table-sm mb-0 small align-middle">
                    <thead><tr><th style={{ width: 40 }}></th><th>Parameter</th><th>Metode</th></tr></thead>
                    <tbody>{labProduct?.parameters.map((p) => (
                      <tr key={p.id}>
                        <td><input className="form-check-input" type="checkbox" id={`pp${p.id}`} checked={lab.params.includes(p.id)} onChange={(e) => setLab({ ...lab, params: e.target.checked ? [...lab.params, p.id] : lab.params.filter((x) => x !== p.id) })} /></td>
                        <td><label htmlFor={`pp${p.id}`}>{p.name}</label></td><td className="text-muted2">{p.method || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="small text-muted2 mt-1">{lab.params.length} parameter dipilih. Rincian biaya dikirim Admin setelah verifikasi.</div>
              </div>
            </div>
          )}

          {stage === 3 && (
            <div className="d-flex flex-column gap-2">
              {docList.map((t) => (
                <div key={t} className="border rounded p-2 d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ borderStyle: 'dashed !important' }}>
                  <div><b>{t}</b><div className="small text-muted2">PDF, ZIP, JPG, atau PNG · maks. 10 MB</div></div>
                  <input type="file" className="form-control form-control-sm" style={{ maxWidth: 300 }} accept=".pdf,.zip,.jpg,.jpeg,.png" onChange={(e) => setDocs({ ...docs, [t]: e.target.files[0] })} aria-label={t} />
                </div>
              ))}
              <div className="small text-muted2">Dokumen yang belum lengkap bisa dikirim nanti jika Admin meminta (Action Required).</div>
            </div>
          )}

          {stage === 4 && (
            <>
              <dl className="row small">
                <dt className="col-sm-3 text-muted2 fw-normal">Layanan</dt><dd className="col-sm-9">{svc.name}</dd>
                {code === 'SP' && spProduct && <><dt className="col-sm-3 text-muted2 fw-normal">Produk</dt><dd className="col-sm-9">{spProduct.name} · <span className="mono">{spProduct.standard_no}</span> · {sp.scheme || 'sesuai acuan'}</dd></>}
                {code === 'KAL' && <><dt className="col-sm-3 text-muted2 fw-normal">Alat</dt><dd className="col-sm-9">{kal.name} {kal.brand_model} · {kal.location === 'onsite' ? 'On-site' : 'Di laboratorium'}</dd></>}
                {labProduct && code !== 'SP' && code !== 'KAL' && <><dt className="col-sm-3 text-muted2 fw-normal">Produk & parameter</dt><dd className="col-sm-9">{labProduct.name} · {labProduct.parameters.filter((p) => lab.params.includes(p.id)).map((p) => p.name).join(', ')}</dd></>}
                <dt className="col-sm-3 text-muted2 fw-normal">Dokumen</dt><dd className="col-sm-9">{Object.values(docs).filter(Boolean).length} file</dd>
                <dt className="col-sm-3 text-muted2 fw-normal">Status tracking</dt><dd className="col-sm-9">{svc.steps.length} status, mulai {svc.steps[0].status_code}</dd>
              </dl>
              <div className="alert alert-light border small mb-0">Setelah dikirim, sistem membuat <b>nomor pengajuan</b> untuk arsip dan <b>kode lacak</b> acak yang dikirim ke email Anda untuk cek progres tanpa login.</div>
            </>
          )}
        </div>
        <div className="panel-h border-top border-bottom-0">
          <button className="btn btn-outline-secondary" disabled={stage === 1} onClick={() => setStage(stage - 1)}>Kembali</button>
          {stage < 4 ? <button className="btn btn-primary" onClick={next}>Lanjut</button>
            : <button className="btn btn-gold" disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim pengajuan'}</button>}
        </div>
      </section>
    </>
  );
}

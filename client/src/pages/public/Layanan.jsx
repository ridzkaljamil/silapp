import { useEffect, useState } from 'react';
import api from '../../api';
import { Loading } from '../../components/ui';
import { SERVICE_STATE as STATE } from '../../lib/constants';

const ICON = { KIM: 'droplet-half', FIS: 'rulers', MIK: 'virus', KAL: 'speedometer2' };

function Scope({ code, primary, extra }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const toggle = async () => {
    setOpen(!open);
    if (!rows) setRows((await api.get(`/public/services/${code}/scope`)).data);
  };
  return (
    <div className="w-100">
      <div className={`d-flex gap-2 flex-wrap ${primary ? 'svc-btns' : ''}`}>
        <button className={`btn ${primary ? 'btn-primary' : 'btn-outline-secondary btn-sm'}`} onClick={toggle} aria-expanded={open}>{open ? 'Tutup' : 'Lihat'} ruang lingkup</button>
        {extra}
      </div>
      {open && (
        <div className="border rounded mt-2 overflow-auto bg-white reveal" style={{ maxHeight: 300 }}>
          {!rows ? <Loading /> : (
            <table className="table table-sm small mb-0">
              <thead><tr><th>Produk</th><th>{code === 'SP' ? 'SNI / Skema' : 'Parameter'}</th></tr></thead>
              <tbody>{rows.map((p) => (
                <tr key={p.id}><td>{p.name}</td><td>{code === 'SP' ? `${p.standard_no} · ${p.scheme_types || 'sesuai acuan'}` : p.parameters.map((x) => x.name).join(', ')}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const Cp = ({ s }) => (s.cp_name ? <div className="small"><span className="text-muted2">Contact person</span> · <b>{s.cp_name}</b>{s.cp_phone && <> · <a href={`https://wa.me/${s.cp_phone.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer">{s.cp_phone}</a></>}</div> : null);

export default function Layanan() {
  const [svc, setSvc] = useState(null);
  useEffect(() => { api.get('/public/services').then((r) => setSvc(r.data)); }, []);
  if (!svc) return <Loading />;
  const sp = svc.find((s) => s.code === 'SP');
  const lab = svc.find((s) => s.code === 'LAB');
  const labs = svc.filter((s) => s.parent_id === lab?.id);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="pub-intro" style={{ maxWidth: 680 }}>
        <h1 className="mb-2" style={{ fontSize: 'clamp(1.8rem,4vw,2.3rem)', letterSpacing: '-.03em' }}>Layanan PT Penilai Standar Uji</h1>
        <p className="text-muted2 mb-0" style={{ fontSize: '1.02rem' }}>Sertifikasi produk dan pengujian laboratorium terakreditasi KAN. Setiap layanan punya tahapan tracking sendiri yang bisa dipantau dari SILAPP.</p>
      </div>

      {sp && (
        <section className="panel svc-hero">
          <div className="d-flex flex-column gap-3">
            <div className="d-flex gap-2 flex-wrap"><span className="pill pill-progress">LSPro · LSPR-051-IDN</span>{STATE[sp.state] ? <span className="pill pill-action">{STATE[sp.state]}</span> : <span className="pill pill-done">Beroperasi</span>}</div>
            <h2 className="mb-0 svc-title">{sp.name} (SPPT SNI)</h2>
            <p className="mb-0 text-muted2">{sp.description}</p>
            <dl className="svc-stats">
              {[['Ruang lingkup', `${sp.scope.products} produk`], ['Estimasi', sp.est_text || '—'], ['Tahap tracking', sp.steps.length]].map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <Cp s={sp} />
            <Scope code="SP" primary extra={sp.cp_phone ? <a className="btn btn-outline-secondary" href={`https://wa.me/${sp.cp_phone.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" />Hubungi CP</a> : <a className="btn btn-outline-secondary" href="https://penilaistandaruji.com" target="_blank" rel="noreferrer"><i className="bi bi-telephone" />Hubungi CP</a>} />
          </div>
          <ol className="steps-list align-content-start">
            {sp.steps.map((x, i) => (
              <li key={x.step_order} className={i === sp.steps.length - 1 ? 'current' : 'done'} style={{ color: 'var(--text)', fontWeight: 500 }}>
                <span className="dot" style={x.is_optional ? { background: 'none', border: '1.5px dashed #98A2B3', color: 'var(--muted)' } : i === sp.steps.length - 1 ? undefined : { background: 'var(--chip)', color: 'var(--navy)' }}>{i + 1}</span>
                <span>{x.name}{x.is_optional ? <span className="text-muted2"> · jika ada temuan</span> : null}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {lab && (
        <section className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2"><h2 className="mb-0" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{lab.name}</h2><span className="small text-muted2">{lab.description}</span></div>
          <div className="row g-3">
            {labs.map((s) => (
              <div key={s.id} className="col-sm-6 col-lg-3">
                <article className="panel svc-card h-100 p-3 d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between align-items-start">
                    <span className={`d-grid rounded-3 ${STATE[s.state] ? 'ic-mute' : 'ic-info'}`} style={{ width: 42, height: 42, placeItems: 'center', fontSize: 19 }}><i className={`bi bi-${ICON[s.code] || 'beaker'}`} /></span>
                    {STATE[s.state] && <span className="pill pill-action">{STATE[s.state]}</span>}
                  </div>
                  <h3 className="mb-0" style={{ fontSize: '1.05rem' }}>{s.name}</h3>
                  <p className="small text-muted2 mb-0">{s.description}</p>
                  <div className="mt-auto pt-2 small d-flex justify-content-between gap-2 flex-wrap"><span>{s.scope.products ? `${s.scope.products} produk · ${s.scope.parameters} parameter` : `${s.steps.length} tahap tracking`}</span><b>{s.est_text}</b></div>
                  <Cp s={s} />
                  {s.scope.products > 0 && <Scope code={s.code} />}
                </article>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="cta-navy">
        <div><h2>Ingin mengajukan layanan?</h2><p className="mb-0">Hubungi contact person layanan untuk penawaran harga. Akun SILAPP dibuat oleh PSU setelah kesepakatan.</p></div>
        <a href="https://penilaistandaruji.com" className="btn btn-gold" target="_blank" rel="noreferrer">Hubungi kami</a>
      </section>
    </div>
  );
}

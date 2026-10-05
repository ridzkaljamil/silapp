import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { PageHead, Loading } from '../../components/ui';

const STATE = { dev: 'Pengembangan', prep: 'Persiapan' };

function Scope({ code }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const toggle = async () => {
    setOpen(!open);
    if (!rows) setRows((await api.get(`/public/services/${code}/scope`)).data);
  };
  return (
    <div>
      <button className="btn btn-outline-secondary btn-sm" onClick={toggle}>{open ? 'Tutup' : 'Lihat'} ruang lingkup</button>
      {open && (
        <div className="border rounded mt-2 overflow-auto" style={{ maxHeight: 280 }}>
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

export default function Layanan() {
  const [svc, setSvc] = useState(null);
  useEffect(() => { api.get('/public/services').then((r) => setSvc(r.data)); }, []);
  if (!svc) return <Loading />;
  const parents = svc.filter((s) => !s.parent_id);
  return (
    <>
      <PageHead eyebrow="Layanan PT Penilai Standar Uji" title="Pilih layanan dan hubungi contact person-nya"
        sub="Setiap layanan punya status tracking sendiri. Untuk mengajukan, masuk atau daftar akun perusahaan lebih dulu." />
      {parents.map((p) => {
        const items = p.bidang ? [p] : svc.filter((s) => s.parent_id === p.id);
        return (
          <section key={p.id} className="mb-4">
            <h2 className="mb-3">{p.name}{!p.bidang && <span className="badge text-bg-light border ms-2 fw-normal">{items.length} sub-layanan</span>}</h2>
            <div className="row g-3">
              {items.map((s) => (
                <div key={s.id} className="col-md-6 col-lg-4">
                  <article className="svc-card">
                    <div className="d-flex justify-content-between"><span className="code">{s.code}</span>{STATE[s.state] && <span className="pill pill-action">{STATE[s.state]}</span>}</div>
                    <h2 className="mb-0">{s.name}</h2>
                    <p className="text-muted2 small mb-0">{s.description}</p>
                    <div className="eyebrow">{s.steps.length} status · estimasi {s.est_text}</div>
                    <ol className="small text-muted2 mb-0 ps-3">{s.steps.map((x) => <li key={x.step_order}>{x.name}{x.is_optional ? ' (kondisional)' : ''}</li>)}</ol>
                    {s.scope.products > 0 ? <Scope code={s.code} /> : <span className="small text-warning-emphasis">Ruang lingkup menunggu data</span>}
                    <div className="mt-auto pt-2 border-top d-flex justify-content-between align-items-center small">
                      <span><span className="text-muted2">Contact person</span><br /><b>{s.cp_name || 'Belum diisi'}</b>{s.cp_phone && <> · <span className="num">{s.cp_phone}</span></>}</span>
                      <Link to="/klien/ajukan" className="btn btn-sm btn-outline-primary">Ajukan</Link>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

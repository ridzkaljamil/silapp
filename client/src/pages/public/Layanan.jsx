import { useEffect, useState } from 'react';
import api from '../../api';
import { Loading, Sheet } from '../../components/ui';
import { SERVICE_STATE as STATE } from '../../lib/constants';
import { useContact, waLink } from '../../lib/contact';

const ICON = { KIM: 'droplet-half', FIS: 'rulers', MIK: 'virus', KAL: 'speedometer2' };

/** Tombol + pop-up ruang lingkup layanan (daftar produk & SNI / parameter uji). */
function Scope({ code, name, primary }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const show = async () => {
    setOpen(true);
    if (!rows) setRows((await api.get(`/public/services/${code}/scope`)).data);
  };
  // SP & Sistem Manajemen tampil sebagai tabel produk/standar; lab sebagai daftar parameter
  const isSP = code === 'SP' || code === 'LSM';
  const kw = q.trim().toLowerCase();
  const list = (rows || []).filter((p) => !kw || `${p.name} ${p.standard_no || ''} ${p.category || ''} ${p.parameters.map((x) => x.name).join(' ')}`.toLowerCase().includes(kw));
  return (
    <>
      <button type="button" className={`btn btn-primary ${primary ? '' : 'btn-sm align-self-start'}`} onClick={show}><i className="bi bi-list-check" />Lihat Ruang Lingkup</button>
      <Sheet open={open} onClose={() => setOpen(false)} wide="xl" icon="list-check" title={`Ruang Lingkup · ${name}`}
        sub={rows ? `${rows.length} ${code === 'LSM' ? 'standar' : 'produk'}${isSP ? '' : ` · ${rows.reduce((t, p) => t + p.parameters.length, 0)} parameter`}` : 'Memuat…'}>
        {!rows ? <Loading /> : (
          <div className="d-flex flex-column gap-3">
            <input className="form-control" placeholder={code === 'LSM' ? 'Cari standar' : isSP ? 'Cari produk atau nomor SNI' : 'Cari produk atau parameter'} aria-label="Cari Ruang Lingkup" value={q} onChange={(e) => setQ(e.target.value)} />
            {isSP ? (
              <>
              <ul className="list-group d-md-none">{list.map((p) => (
                <li key={p.id} className="list-group-item small"><b className="d-block">{p.name}</b><span className="mono">{p.standard_no}</span><span className="d-block text-muted2">{p.sub_category || p.category} · Sesuai Acuan</span></li>
              ))}</ul>
              <div className="table-responsive border rounded d-none d-md-block">
                <table className="table table-sm small mb-0 align-middle">
                  <thead><tr><th>{code === 'LSM' ? 'Ruang Lingkup' : 'Produk'}</th><th>Kategori</th><th>{code === 'LSM' ? 'Standar' : 'SNI'}</th><th>Skema</th></tr></thead>
                  <tbody>{list.map((p) => (
                    <tr key={p.id}><td className="fw-semibold">{p.name}</td><td className="text-muted2">{p.sub_category || p.category}</td><td className="mono text-nowrap">{p.standard_no}</td><td>Sesuai Acuan</td></tr>
                  ))}</tbody>
                </table>
              </div>
              </>
            ) : list.map((p) => (
              <div key={p.id} className="border rounded-3 p-3">
                <div className="d-flex justify-content-between gap-2 flex-wrap mb-2"><b>{p.name}</b>{p.standard_no && <span className="mono small text-muted2">{p.standard_no}</span>}</div>
                {p.parameters.length > 0
                  ? <ul className="scope-params small mb-0">{p.parameters.map((x) => <li key={x.id}><span>{x.name}</span>{x.method && <span className="text-muted2">{x.method}</span>}</li>)}</ul>
                  : <p className="small text-muted2 mb-0">{p.note || 'Parameter dikonfirmasi PSU.'}</p>}
              </div>
            ))}
            {!list.length && <p className="text-center text-muted2 mb-0 py-3">Tidak ada yang cocok dengan pencarian.</p>}
          </div>
        )}
      </Sheet>
    </>
  );
}

/**
 * Kartu besar layanan sertifikasi (SP & Sistem Manajemen). Tahap opsional (Tindakan Perbaikan)
 * tidak ditampilkan di halaman publik ini, tetapi tetap ada di alur pengajuan.
 */
function SvcHero({ s, badge, title }) {
  const steps = s.code === 'SP' ? s.steps.filter((x) => !x.is_optional) : s.steps;
  return (
    <section className="panel svc-hero">
      <div className="d-flex flex-column gap-3">
        <div className="d-flex gap-2 flex-wrap">{badge && <span className="pill pill-progress">{badge}</span>}{STATE[s.state] ? <span className="pill pill-action">{STATE[s.state]}</span> : <span className="pill pill-done">Beroperasi</span>}</div>
        <h2 className="mb-0 svc-title">{title}</h2>
        <p className="mb-0 text-muted2">{s.description}</p>
        <dl className="svc-stats">
          {[['Ruang Lingkup', `${s.scope.products} ${s.code === 'SP' ? 'produk' : 'standar'}`], ['Estimasi', s.est_text || '—'], ['Tahapan Proses', steps.length]].map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {s.scope.products > 0 && <div className="svc-btns"><Scope code={s.code} name={s.name} primary /></div>}
      </div>
      <ol className="steps-list align-content-start">
        {steps.map((x, i) => (
          <li key={x.step_order} className={i === steps.length - 1 ? 'current' : 'done'} style={{ color: 'var(--text)', fontWeight: 500 }}>
            <span className="dot" style={x.is_optional ? { background: 'none', border: '1.5px dashed #98A2B3', color: 'var(--muted)' } : i === steps.length - 1 ? undefined : { background: 'var(--chip)', color: 'var(--navy)' }}>{i + 1}</span>
            <span>{x.name}{x.is_optional ? <span className="text-muted2"> · jika ada temuan</span> : null}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Layanan() {
  const [svc, setSvc] = useState(null);
  const contact = useContact();
  useEffect(() => { api.get('/public/services').then((r) => setSvc(r.data)); }, []);
  if (!svc) return <Loading />;
  const sp = svc.find((s) => s.code === 'SP');
  const lab = svc.find((s) => s.code === 'LAB');
  const labs = svc.filter((s) => s.parent_id === lab?.id);
  const lsm = svc.find((s) => s.code === 'LSM');

  return (
    <div className="d-flex flex-column gap-4">
      <div className="pub-intro" style={{ maxWidth: 680 }}>
        <h1 className="mb-2" style={{ fontSize: 'clamp(1.8rem,4vw,2.3rem)', letterSpacing: '-.03em' }}>Layanan PT Penilai Standar Uji</h1>
        <p className="text-muted2 mb-0" style={{ fontSize: '1.02rem' }}>Ruang Lingkup dan Tahapan Proses Layanan Sertifikasi Produk dan Pengujian Laboratorium dari PT Penilai Standar Uji terakreditasi KAN.</p>
      </div>

      {sp && <SvcHero s={sp} badge="LSPro · LSPR-051-IDN" title={`${sp.name} (SPPT SNI)`} />}

      {lab && (
        <section className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2"><h2 className="mb-0" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{lab.name}</h2></div>
          <div className="row g-3">
            {labs.map((s) => (
              <div key={s.id} className="col-sm-6 col-lg-3">
                <article className="panel svc-card h-100 p-3 d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between align-items-start">
                    <span className={`d-grid rounded-3 ${STATE[s.state] ? 'ic-mute' : 'ic-info'}`} style={{ width: 42, height: 42, placeItems: 'center', fontSize: 19 }}><i className={`bi bi-${ICON[s.code] || 'beaker'}`} /></span>
                    {STATE[s.state] ? <span className="pill pill-action">{STATE[s.state]}</span> : <span className="pill pill-done">Beroperasi</span>}
                  </div>
                  <h3 className="mb-0" style={{ fontSize: '1.05rem' }}>{s.name}</h3>
                  <p className="small text-muted2 mb-0">{s.description}</p>
                  <div className="mt-auto pt-2 small d-flex justify-content-between gap-2 flex-wrap"><span>{s.scope.products ? `${s.scope.products} produk · ${s.scope.parameters} parameter` : `${s.steps.length} Tahapan Proses`}</span><b>{s.est_text}</b></div>
                  {s.scope.products > 0 && <Scope code={s.code} name={s.name} />}
                </article>
              </div>
            ))}
          </div>
        </section>
      )}

      {lsm && (
        <section className="d-flex flex-column gap-3">
          <h2 className="mb-0" style={{ fontSize: '1.35rem', fontWeight: 800 }}>Lembaga Sistem Manajemen</h2>
          <SvcHero s={lsm} title={lsm.name} />
        </section>
      )}

      <section className="cta-navy">
        <div><h2>Ingin Mengajukan Layanan?</h2><p className="mb-0">Hubungi kami untuk penawaran harga. Akun SILAPP dibuat oleh PSU setelah ada kesepakatan layanan.</p></div>
        <div className="d-flex gap-2 flex-wrap">
          <a href={waLink(contact.phone, 'Halo PSU, saya ingin mengajukan layanan.')} className="btn btn-gold" target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" />WhatsApp</a>
          <a href={`mailto:${contact.email}`} className="btn btn-outline-light"><i className="bi bi-envelope" />Email</a>
        </div>
      </section>
    </div>
  );
}

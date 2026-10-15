import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, homeOf } from '../../AuthContext';
import api, { errMsg } from '../../api';
import { useContact, waLink } from '../../lib/contact';
import { StepsList, StepTrack, PageHead, fmtDate, Sheet } from '../../components/ui';

const SVC_ICON = { SP: 'patch-check', KIM: 'droplet', FIS: 'rulers', MIK: 'virus', KAL: 'speedometer2' };
const COND_TONE = { 'On Progress': 'prog', 'Action Required': 'act', Certified: 'ok', Completed: 'ok', Closed: 'bad', Cancelled: 'bad' };

/** Lacak dengan kode. inApp: tampil di dalam area login (sidebar tetap ada). */
export default function Lacak({ inApp = false }) {
  const [code, setCode] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const contact = useContact();
  const [all, setAll] = useState(false);
  const { user } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setRes(null); setBusy(true); setAll(false);
    try { setRes((await api.get(`/public/track/${code.trim().toUpperCase()}`)).data); }
    catch (ex) { setErr(errMsg(ex)); }
    finally { setBusy(false); }
  };
  const cur = res?.steps.findIndex((s) => ['current', 'action', 'closed'].includes(s.state));
  const next = res && cur >= 0 ? res.steps.slice(cur + 1).find((s) => s.state === 'todo') : null;

  return (
    <div className={`d-flex flex-column gap-4 ${inApp ? '' : 'lacak-pub'}`} style={inApp ? { maxWidth: 820 } : undefined}>
      {inApp ? (
        <PageHead eyebrow="Pelacakan" title="Lacak Kode" sub="Cek progres pengajuan dengan kode lacak SLP26-XXXXXXXX, termasuk kode yang dibagikan rekan kerja Anda." />
      ) : (
        <div className="hero">
          <span className="hero-tag"><span aria-hidden="true" />SISTEM INFORMASI LAYANAN DAN PENGUJIAN PRODUK</span>
          <h1>Lacak Status Pengajuan Anda</h1>
          <p>Masukkan kode lacak dari email konfirmasi untuk melihat tahap dan progres pengajuan anda.</p>
        </div>
      )}
      <form className={`track-form ${inApp ? '' : 'track-pill'}`} onSubmit={submit}>
        <label htmlFor="kode" className="visually-hidden">Kode Lacak</label>
        {!inApp && <i className="bi bi-search track-ic" aria-hidden="true" />}
        <input id="kode" placeholder="SLP26-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" />
        <button className="btn btn-primary" disabled={busy}>{inApp && <i className="bi bi-search" />}{busy ? 'Mencari…' : 'Lacak'}</button>
      </form>
      {!inApp && !res && (
        <ul className="hero-checks" aria-label="Keunggulan">
          {['Tanpa login', 'Progres setiap tahap', 'Bisa dibagikan ke rekan kerja'].map((t) => <li key={t}><i className="bi bi-check-lg" aria-hidden="true" />{t}</li>)}
        </ul>
      )}

      {err && <div className="alert alert-danger mb-0"><b>Kode tidak ditemukan.</b> Periksa kembali kode lacak di email konfirmasi Anda.</div>}

      {res && (
        <>
          <section className="tr-card reveal" aria-label="Hasil Pelacakan">
            <div className="tr-head">
              <svg className="tr-deco" aria-hidden="true" viewBox="0 0 400 160" preserveAspectRatio="xMaxYMax slice" fill="none"><path d="M400 10C320 40 270 100 280 160H400z" fill="#F3B43A" fillOpacity=".08" /><path d="M400 10C320 40 270 100 280 160" stroke="#F3B43A" strokeOpacity=".22" strokeWidth="1.2" /></svg>
              <div className="tr-main">
                <span className="tr-svc"><i className={`bi bi-${SVC_ICON[res.service_code] || 'clipboard-check'}`} aria-hidden="true" />{res.service_name}<span aria-hidden="true" className="tr-dot">•</span><span className="mono">{res.application_no}</span></span>
                <h2>{res.status === 'selesai' ? 'Seluruh Tahap Selesai' : res.current_step.name}</h2>
                <span className={`tr-pill ${COND_TONE[res.condition] || ''}`}>{res.condition}</span>
              </div>
              <div className="tr-prog">
                <div className="tr-prog-top"><span>{res.status === 'selesai' ? 'Selesai' : `Tahap ${cur + 1} dari ${res.steps.length}`}</span><b className="num">{res.progress}%</b></div>
                <span className="tr-bar" role="progressbar" aria-valuenow={res.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progres pengajuan"><i className={res.progress === 100 ? 'ok' : ''} style={{ width: `${res.progress}%` }} /></span>
              </div>
            </div>
            <div className="tr-body">
              <div className="tr-sec-h">
                <h3>Tahapan Pengajuan</h3>
                <button type="button" className="tr-all" onClick={() => setAll(true)}>Lihat Semua Tahap<i className="bi bi-arrow-right" aria-hidden="true" /></button>
              </div>
              <StepTrack steps={res.steps} />
              <div className="tr-info">
                <div className="blue"><i className="bi bi-calendar3" aria-hidden="true" /><span><span>Pembaruan Terakhir</span><b>{fmtDate(res.last_update)}</b></span></div>
                <div className="amber"><i className="bi bi-clipboard-check" aria-hidden="true" /><span><span>Tahap Berikutnya</span><b>{next ? next.name : '—'}</b></span></div>
                <div className="blue"><i className="bi bi-clock" aria-hidden="true" /><span><span>{res.service_est ? 'Estimasi Layanan' : 'Diajukan'}</span><b>{res.service_est || fmtDate(res.created_at)}</b></span></div>
              </div>
            </div>
            <Sheet open={all} onClose={() => setAll(false)} icon="signpost-split" title="Tahapan Pengajuan" sub={`${res.service_name} · ${res.steps.length} tahap`}><StepsList steps={res.steps} /></Sheet>
          </section>
          {!!res.customer_action_needed && (
            <div className="tr-warn"><i className="bi bi-exclamation-triangle" aria-hidden="true" /><span><b>Ada tindakan yang perlu dilakukan pemohon.</b> {inApp ? <>Buka pengajuan ini dari menu <Link to="/klien/pengajuan" className="fw-bold">Pengajuan Saya</Link>.</> : 'Masuk ke akun untuk melihat permintaan PSU dan menanggapinya.'}</span></div>
          )}
          {!inApp && (
            <>
              <Link to={user ? homeOf(user) : '/masuk'} className="tr-login">
                <span className="ic"><i className="bi bi-info-circle" aria-hidden="true" /></span>
                <span className="tx">Untuk melihat detail, mengunggah dokumen, atau menanggapi permintaan PSU, silakan <b>{user ? 'buka dashboard Anda' : 'masuk ke akun Anda'}</b>.</span>
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
              </Link>
              <p className="tr-foot"><i className="bi bi-headset" aria-hidden="true" />Belum punya akun? Akun dibuat oleh PSU setelah kesepakatan layanan.<Link to="/layanan">Lihat Layanan &amp; Kontak →</Link></p>
            </>
          )}
        </>
      )}
      {!inApp && !res && (
        <div className="pub-cards">
          <Link to="/layanan" className="pub-card">
            <span className="pc-ic ic-amber-bg"><i className="bi bi-layers" /></span>
            <b>Layanan PSU</b><span>Sertifikasi produk SNI dan pengujian laboratorium terakreditasi KAN.</span>
            <span className="pc-go">Lihat Layanan →</span>
          </Link>
          <a href={waLink(contact.phone, 'Halo PSU, saya ingin bertanya tentang layanan.')} target="_blank" rel="noreferrer" className="pub-card">
            <span className="pc-ic ic-blue-bg"><i className="bi bi-whatsapp" /></span>
            <b>Butuh Bantuan?</b><span>Tanyakan penawaran harga, persyaratan dokumen, atau kendala kode lacak langsung ke tim PSU.</span>
            <span className="pc-go">Hubungi via WhatsApp →</span>
          </a>
          <Link to={user ? homeOf(user) : '/masuk'} className="pub-card navy">
            <SideDecoMini />
            <span className="pc-ic"><i className="bi bi-box-arrow-in-right" /></span>
            <b>{user ? 'Lanjutkan ke SILAPP' : 'Sudah Punya Akun?'}</b>
            <span>{user ? 'Buka dashboard untuk melihat semua pengajuan Anda.' : 'Masuk untuk mengunggah dokumen, membayar tagihan, dan mengunduh sertifikat. Akun dibuat oleh PSU setelah kesepakatan layanan.'}</span>
            <span className="pc-go">{user ? 'Ke Dashboard →' : 'Masuk ke SILAPP →'}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

/** Lengkung emas kecil di kartu navy. */
const SideDecoMini = () => (
  <svg className="pc-deco" aria-hidden="true" viewBox="0 0 300 200" fill="none">
    <path d="M300 20C220 60 180 130 200 200H300z" fill="#F3B43A" fillOpacity=".12" />
    <path d="M300 20C220 60 180 130 200 200" stroke="#F3B43A" strokeOpacity=".35" strokeWidth="1.2" />
  </svg>
);

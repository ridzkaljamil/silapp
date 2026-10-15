/** Dashboard Admin & Super Admin: ringkasan, perlu tindakan, grafik (design.md). */
import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, fmtDate, CountUp, useToast } from '../../components/ui';
import { useDismiss } from '../../hooks/useDismiss';
import { BIDANG, MONTH } from '../../lib/constants';

/** Jenis tindakan PSU untuk satu pengajuan: [label, warna pill, tombol, tombol utama?]. */
function needOf(a) {
  if (a.ext_requests > 0) return ['Perpanjangan Temuan', 'pill-progress', 'Tinjau', true];
  if (a.findings_review > 0) return ['Bukti Perbaikan', 'pill-progress', 'Tinjau', true];
  if (a.payment_status === 'menunggu') return ['Bukti Bayar Masuk', 'pill-action', 'Verifikasi', true];
  if (a.payment_status === 'belum' && ['ST-03', 'LAB-03', 'KAL-02'].includes(a.current_step.code)) return ['Proforma Invoice Belum Terbit', 'pill-action', 'Terbitkan Proforma Invoice', true];
  return ['Pengajuan Baru', 'pill-progress', 'Periksa', false];
}

const PERIODS = [3, 6, 12];

/** Pilihan periode bergaya pill: ikon kalender, label "Periode", nilai tebal. */
function PeriodPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div className="pm" ref={ref}>
      <button type="button" className="period-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <i className="bi bi-calendar3" aria-hidden="true" /><span className="text-muted2">Periode</span><b>{value} Bulan Terakhir</b>
        <i className="bi bi-chevron-down pm-chev" aria-hidden="true" />
      </button>
      <div className={`pm-menu menu-sm ${open ? 'open' : ''}`} role="listbox" aria-label="Pilih Periode">
        {PERIODS.map((p) => (
          <button key={p} type="button" role="option" aria-selected={p === value} tabIndex={open ? 0 : -1} className={`pm-item ${p === value ? 'fw-bold' : ''}`}
            onClick={() => { setOpen(false); onChange(p); }}>{p} Bulan Terakhir{p === value && <i className="bi bi-check2 ms-auto" />}</button>
        ))}
      </div>
    </div>
  );
}

/** Kartu ringkasan berwarna: ikon, judul, angka besar, tombol ›, keterangan. */
function Kpi({ tone, icon, label, value, sub, to }) {
  const body = (
    <>
      <span className="kpi-top"><span className="kpi-ic"><i className={`bi bi-${icon}`} aria-hidden="true" /></span><b>{label}</b></span>
      <span className="kpi-mid"><span className="kpi-v num">{value}</span>{to && <span className="kpi-go" aria-hidden="true"><i className="bi bi-chevron-right" /></span>}</span>
      <span className="kpi-s">{sub}</span>
    </>
  );
  return to ? <Link to={to} className={`kpi ${tone}`}>{body}</Link> : <div className={`kpi ${tone}`}>{body}</div>;
}

/** Satu baris "Perlu Tindakan": pill, perusahaan, kode, tombol, menu titik tiga. */
function NeedRow({ a }) {
  const [t, cls, btn, main] = needOf(a);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const toast = useToast();
  const nav = useNavigate();
  const to = `/admin/pengajuan/${a.id}`;
  const copy = () => { setOpen(false); navigator.clipboard?.writeText(a.tracking_code).then(() => toast(`Kode lacak ${a.tracking_code} disalin.`)); };
  return (
    <div className="need-row2">
      <span className={`pill ${cls} need-pill`}>{t}</span>
      <Link to={to} className="need-tx">
        <span className="need-co"><b>{a.company_name}</b><span> · {a.product_label.split(' · ')[0]}</span></span>
        <span className="mono need-code">{a.application_no} · {a.current_step.code}</span>
      </Link>
      <Link to={to} className={`btn ${main ? 'btn-bronze' : 'btn-outline-secondary need-sec'}`}>{btn}</Link>
      <div className="pm" ref={ref}>
        <button type="button" className="kebab" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Aksi lain untuk ${a.application_no}`}><i className="bi bi-three-dots-vertical" /></button>
        <div className={`pm-menu menu-sm ${open ? 'open' : ''}`} role="menu">
          <button type="button" role="menuitem" tabIndex={open ? 0 : -1} className="pm-item" onClick={() => { setOpen(false); nav(to); }}><i className="bi bi-box-arrow-up-right" />Lihat Detail</button>
          <button type="button" role="menuitem" tabIndex={open ? 0 : -1} className="pm-item" onClick={copy}><i className="bi bi-clipboard" />Salin Kode Lacak</button>
          <button type="button" role="menuitem" tabIndex={open ? 0 : -1} className="pm-item" onClick={() => { setOpen(false); nav(`/admin/antrean?service=${a.service_code}`); }}><i className="bi bi-inbox" />Antrean {a.service_name.replace('Laboratorium', 'Lab')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [months, setMonths] = useState(6);
  const load = useCallback(() => api.get(`/admin/dashboard?months=${months}`).then((r) => setD(r.data)), [months]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);
  if (!d) return <Loading />;
  const s = d.stats;
  const maxSvc = Math.max(1, ...d.per_service.map((x) => +x.total));
  const keys = [];
  for (let i = d.months - 1; i >= 0; i--) { const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth() - i, 1); keys.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`); }
  const vals = keys.map((m) => +(d.per_month.find((x) => x.ym === m)?.total || 0));
  // skala sumbu Y: kelipatan 4 agar garis bantu rapi
  const top = Math.max(4, Math.ceil(Math.max(...vals) / 4) * 4);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const mon = (k) => MONTH[+k.slice(5) - 1];
  const groups = Object.entries(s.per_group).map(([k, v]) => `${k} ${v}`).join(' · ');
  const superadmin = user.role === 'superadmin';
  const last = keys[keys.length - 1];

  return (
    <>
      <PageHead eyebrow={superadmin ? 'Semua Bidang' : BIDANG[user.bidang]} title="Ringkasan Layanan"
        sub={superadmin ? 'Gambaran pengajuan dari semua bidang: yang sedang berjalan, yang menunggu tindakan PSU, temuan terbuka, dan kepuasan pelanggan.' : `Gambaran pengajuan di bidang ${BIDANG[user.bidang]}: yang sedang berjalan, yang menunggu tindakan Anda, dan temuan yang masih terbuka.`}>
        <PeriodPicker value={months} onChange={setMonths} />
      </PageHead>

      <div className="kpi-grid mb-4">
        <Kpi tone="kpi-amber" icon="file-earmark-text" label="Pengajuan Berjalan" value={<CountUp value={s.running} />} sub={groups || 'Belum ada pengajuan berjalan'} to="/admin/antrean?status=berjalan" />
        <Kpi tone="kpi-blue" icon="clock-history" label="Perlu Tindakan PSU" value={<CountUp value={d.need_action.length} />} sub="Proforma invoice, verifikasi, pengajuan baru" to="/admin/antrean" />
        <Kpi tone="kpi-green" icon="journal-check" label="Temuan Terbuka" value={<CountUp value={s.findings_open} />} sub={s.findings_nearest ? `Tenggat terdekat ${fmtDate(s.findings_nearest)}` : 'Tidak ada tenggat aktif'} to="/admin/antrean" />
        <Kpi tone="kpi-red" icon="emoji-smile" label="Kepuasan Pelanggan" value={s.survey_avg === null ? '—' : <>{String(s.survey_avg).replace('.', ',')}<small className="kpi-of"> / 5</small></>}
          sub={s.survey_n ? `Dari ${s.survey_n} responden` : 'Belum ada responden'} to={superadmin ? '/admin/survei' : undefined} />
      </div>

      <section className="panel panel-lg mb-4">
        <div className="panel-h">
          <h2 className="mb-0 ph-ic"><i className="bi bi-lightning-charge-fill ic-amber" aria-hidden="true" />Perlu Tindakan Sekarang</h2>
          <Link to="/admin/antrean" className="link-arrow">Buka Antrean<i className="bi bi-arrow-right" aria-hidden="true" /></Link>
        </div>
        <div className="need-list">
          {d.need_action.length ? d.need_action.map((a) => <NeedRow key={a.id} a={a} />)
            : <p className="text-muted2 text-center py-4 mb-0">Tidak ada yang perlu ditindaklanjuti.</p>}
        </div>
      </section>

      <div className="chart-grid">
        <section className="panel panel-lg">
          <div className="panel-h">
            <h2 className="mb-0 ph-ic"><i className="bi bi-bar-chart-fill ic-amber" aria-hidden="true" />Pengajuan per Layanan</h2>
            <Link to="/admin/antrean" className="round-go" aria-label="Buka Antrean"><i className="bi bi-chevron-right" /></Link>
          </div>
          <div className="panel-b hbar">
            {d.per_service.map((x) => (
              <div className="hbar-row" key={x.code}>
                <span>{x.name.replace('Laboratorium', 'Lab')}</span>
                <span className="track"><i style={{ width: `${(x.total / maxSvc) * 100}%`, background: +x.total === maxSvc && maxSvc > 0 ? 'var(--navy)' : 'var(--navy-2)' }} /></span>
                <b className="text-end num">{x.total}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel-lg">
          <div className="panel-h">
            <h2 className="mb-0 ph-ic"><i className="bi bi-graph-up-arrow ic-amber" aria-hidden="true" />Pengajuan Masuk per Bulan</h2>
            <span className="small text-muted2">{mon(keys[0])}{keys[0].slice(0, 4) !== last.slice(0, 4) ? ` ${keys[0].slice(0, 4)}` : ''} – {mon(last)} {last.slice(0, 4)}</span>
          </div>
          <div className="panel-b">
            <div className="vchart">
              <div className="vchart-y" aria-hidden="true">{ticks.slice().reverse().map((t) => <span key={t}>{t}</span>)}</div>
              <div className="vchart-main">
                <div className="vchart-bars" role="img" aria-label={`Pengajuan masuk per bulan: ${keys.map((k, i) => `${mon(k)} ${vals[i]}`).join(', ')}`} style={{ gap: keys.length > 6 ? 6 : 12 }}>
                  {vals.map((v, i) => (
                    <div key={keys[i]} className="vcol">
                      {v > 0 && <b className="num">{v}</b>}
                      <span className={`vbar ${i === vals.length - 1 ? 'cur' : v ? 'prev' : 'zero'}`} style={{ height: v ? `${(v / top) * 100}%` : 4, animationDelay: `${i * 0.05}s` }} />
                    </div>
                  ))}
                </div>
                <div className="vchart-x" style={{ gap: keys.length > 6 ? 6 : 12 }}>
                  {keys.map((k, i) => <span key={k} className={i === keys.length - 1 ? 'cur' : ''}>{mon(k)}{keys.length <= 6 ? ` ${vals[i]}` : ''}</span>)}
                </div>
              </div>
            </div>
            <div className="vchart-legend"><span><i className="sw cur" />Bulan Berjalan ({mon(last)})</span><span><i className="sw prev" />Bulan Sebelumnya</span></div>
          </div>
        </section>
      </div>
    </>
  );
}

/** Dashboard Admin & Super Admin: KPI, perlu tindakan, grafik. */
import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, fmtDate, CountUp, Select } from '../../components/ui';
import { BIDANG, MONTH } from '../../lib/constants';

/** Jenis tindakan PSU untuk satu pengajuan di dashboard: [label, warna pill, tombol]. */
function needOf(a) {
  if (a.ext_requests > 0) return ['Perpanjangan temuan', 'pill-progress', 'Tinjau'];
  if (a.findings_review > 0) return ['Bukti perbaikan', 'pill-progress', 'Tinjau'];
  if (a.payment_status === 'menunggu') return ['Bukti bayar masuk', 'pill-action', 'Verifikasi'];
  if (a.payment_status === 'belum' && ['ST-03', 'LAB-02', 'KAL-02'].includes(a.current_step.code)) return ['Invoice belum terbit', 'pill-action', 'Terbitkan invoice'];
  return ['Pengajuan baru', 'pill-neutral', 'Periksa'];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [months, setMonths] = useState(6);
  useEffect(() => { api.get(`/admin/dashboard?months=${months}`).then((r) => setD(r.data)); }, [months]);
  if (!d) return <Loading />;
  const s = d.stats;
  const maxSvc = Math.max(1, ...d.per_service.map((x) => +x.total));
  const keys = [];
  for (let i = d.months - 1; i >= 0; i--) { const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth() - i, 1); keys.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`); }
  const vals = keys.map((m) => +(d.per_month.find((x) => x.ym === m)?.total || 0));
  const maxM = Math.max(1, ...vals);
  const groups = Object.entries(s.per_group).map(([k, v]) => `${k} ${v}`).join(' · ');
  const kpis = [
    ['Pengajuan berjalan', <CountUp value={s.running} />, groups || 'belum ada', 'var(--navy)'],
    ['Perlu tindakan PSU', <CountUp value={d.need_action.length} />, 'invoice, verifikasi, pengajuan baru', 'var(--warn)'],
    ['Temuan terbuka', <CountUp value={s.findings_open} />, s.findings_nearest ? `tenggat terdekat ${fmtDate(s.findings_nearest)}` : 'tidak ada tenggat aktif', 'var(--navy)'],
    ['Kepuasan pelanggan', s.survey_avg === null ? '—' : <>{String(s.survey_avg).replace('.', ',')}<small className="kpi-of"> / 5</small></>, s.survey_n ? `dari ${s.survey_n} responden` : 'belum ada responden', 'var(--navy)'],
  ];
  return (
    <>
      <PageHead eyebrow={user.role === 'superadmin' ? 'Semua bidang' : BIDANG[user.bidang]} title="Ringkasan layanan">
        <label className="d-flex align-items-center gap-2 small text-muted2 mb-0" htmlFor="per">Periode
          <Select id="per" className="form-select" style={{ width: 'auto' }} value={months} onChange={(e) => setMonths(+e.target.value)}><option value={6}>6 bulan terakhir</option><option value={12}>12 bulan terakhir</option></Select>
        </label>
      </PageHead>
      <div className="row g-3 mb-4">
        {kpis.map(([k, v, sub, c]) => (
          <div className="col-6 col-lg-3" key={k}><div className="stat"><div className="k">{k}</div><div className="v num" style={{ color: c }}>{v}</div><div className="s">{sub}</div></div></div>
        ))}
      </div>
      <section className="panel mb-4">
        <div className="panel-h"><h2 className="mb-0">Perlu tindakan sekarang</h2><Link to="/admin/antrean" className="small fw-semibold">Buka antrean</Link></div>
        <div className="todo-list">
          {d.need_action.length ? d.need_action.map((a) => {
            const [t, cls, btn] = needOf(a);
            return (
              <Link key={a.id} to={`/admin/pengajuan/${a.id}`} className="todo-item need-row">
                <span className={`pill ${cls} need-pill`}>{t}</span>
                <span className="tx"><b>{a.company_name} <span className="fw-normal">· {a.product_label.split(' · ')[0]}</span></b><span><span className="mono">{a.application_no}</span> · {a.current_step.code}</span></span>
                <span className="btn btn-outline-secondary btn-sm hide-sm">{btn}</span>
              </Link>
            );
          }) : <p className="text-muted2 text-center py-4 mb-0">Tidak ada yang perlu ditindaklanjuti.</p>}
        </div>
      </section>
      <div className="row g-3">
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Pengajuan per layanan</h2></div>
            <div className="panel-b hbar">
              {d.per_service.map((x) => (<Fragment key={x.code}><span>{x.name.replace('Laboratorium', 'Lab')}</span><span className="track"><i style={{ width: `${(x.total / maxSvc) * 100}%` }} /></span><b className="text-end num">{x.total}</b></Fragment>))}
            </div>
          </section>
        </div>
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Pengajuan masuk per bulan</h2><span className="small text-muted2">{MONTH[+keys[0].slice(5) - 1]} – {MONTH[+keys[keys.length - 1].slice(5) - 1]} {keys[keys.length - 1].slice(0, 4)}</span></div>
            <div className="panel-b">
              <div className="d-grid align-items-end gap-3 border-bottom pb-1" style={{ gridTemplateColumns: `repeat(${keys.length},minmax(0,1fr))`, height: 150, gap: keys.length > 6 ? 8 : 16 }}>
                {vals.map((v, i) => <div key={keys[i]} className="vbar" title={`${v} pengajuan`} style={{ animationDelay: `${i * 0.05}s`,  height: `${Math.max(3, (v / maxM) * 100)}%`, background: i === vals.length - 1 ? 'var(--navy)' : '#CBD5E3', borderRadius: '4px 4px 0 0' }} />)}
              </div>
              <div className="d-grid small text-muted2 text-center mt-1" style={{ gridTemplateColumns: `repeat(${keys.length},minmax(0,1fr))`, gap: keys.length > 6 ? 8 : 16 }}>
                {keys.map((m, i) => <span key={m} className={i === keys.length - 1 ? 'fw-bold text-body' : ''}>{MONTH[+m.slice(5) - 1]} · {vals[i]}</span>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

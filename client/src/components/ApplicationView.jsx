/**
 * Tampilan detail pengajuan, dipakai area pelanggan dan admin.
 * Panel aksi diberikan lewat prop `actions` (berbeda per role).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusPill, StepTrack, StepLegend, StepsList, LogList, fmtDate, rupiah } from './ui';
import { Sheet } from './overlays';
import { docWord } from '../lib/constants';

const PST = { antri: ['pill-progress', 'Antrian'], uji: ['pill-action', 'Dalam Pengujian'], selesai: ['pill-done', 'Selesai'] };
const CAT = { mayor: 'Mayor', minor: 'Minor', observasi: 'Observasi' };
const EXT = { diajukan: 'Perpanjangan diajukan', disetujui: 'Perpanjangan disetujui', ditolak: 'Perpanjangan ditolak' };

/** Status per parameter, ditampilkan di dalam tahap "Proses pengujian laboratorium". */
function ParamInline({ app, onChange }) {
  if (!app.parameters?.length) return null;
  const done = app.parameters.filter((p) => p.status === 'selesai').length;
  const lab04 = app.steps.find((s) => s.code === 'LAB-04');
  return (
    <div className="params-inline">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <b className="small" style={{ color: 'var(--navy)' }}>LAB-04 · {lab04?.name} — status per parameter</b>
        <span className="badge text-bg-light border">{done}/{app.parameters.length} selesai{app.full_sni ? ' · parameter lengkap SNI' : ''}{app.price_option ? ` · ${app.price_option}` : ''}</span>
      </div>
      <div className="table-responsive">
        <table className="table table-sm mb-0 align-middle small">
          <tbody>
            {app.parameters.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{p.is_custom ? <span className="badge text-bg-light border ms-1 fw-normal">lainnya</span> : null}{p.method && <div className="text-muted2" style={{ fontSize: 11 }}>{p.method}</div>}</td>
                <td className="text-end text-sm-start"><span className={`pill ${PST[p.status][0]}`}>{PST[p.status][1]}</span></td>
                {onChange && <td className="text-end">{p.status !== 'selesai' && <button className="btn btn-outline-secondary btn-sm" onClick={() => onChange(p.id, p.status === 'antri' ? 'uji' : 'selesai')}>{p.status === 'antri' ? 'Mulai Uji' : 'Tandai Selesai'}</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small text-muted2 mt-1">Nilai hasil pengujian ditampilkan di LHU setelah diterbitkan.</div>
    </div>
  );
}

/** Temuan audit (SP): tabel di desktop, kartu di HP. */
function FindingsPanel({ app, renderActions, extra, onDownloadDoc }) {
  if (!app.findings?.length && !extra) return null;
  const sub = (f) => (
    <>
      {f.extension_status !== 'tidak' && <div className="f-note warn">{EXT[f.extension_status]}{f.extension_reason && ` · "${f.extension_reason}"`}</div>}
      {f.status === 'dikirim' && <div className="f-note">Bukti perbaikan dikirim, menunggu tinjauan PSU.</div>}
      {f.customer_note && <div className="f-note">Keterangan pelanggan: {f.customer_note}</div>}
      {f.admin_note && <div className="f-note">Catatan PSU: {f.admin_note}</div>}
      {f.files?.length > 0 && <div>{f.files.map((d) => <button key={d.id} type="button" className="file-chip" onClick={() => onDownloadDoc(d)}><i className="bi bi-paperclip" />{d.original_name}</button>)}</div>}
    </>
  );
  const due = (f) => (f.status === 'ditutup' ? <span className="pill pill-done">Ditutup</span>
    : !f.due_date ? <span className="text-muted2">—</span>
      : <><b className={f.days_left < 0 ? 'text-danger' : ''}>{fmtDate(f.due_date)}</b><div className={`small ${f.days_left < 0 ? 'text-danger' : f.days_left <= 7 ? 'text-warn' : 'text-muted2'}`}>{f.days_left < 0 ? `terlambat ${-f.days_left} hari` : f.days_left === 0 ? 'hari ini' : `sisa ${f.days_left} hari`}</div></>);
  return (
    <section className="panel">
      <div className="panel-h">
        <h2 className="mb-0">Temuan Audit</h2>
        {app.audit_report_date && <span className="small text-muted2">Laporan {fmtDate(app.audit_report_date)}</span>}
      </div>
      {app.findings.length > 0 && (
        <>
          <div className="app-table table-responsive">
            <table className="table align-middle mb-0 f-table">
              <thead><tr><th style={{ width: 110 }}>Kategori</th><th>Uraian</th><th style={{ width: 130 }}>Tenggat</th>{renderActions && <th style={{ width: 1 }} />}</tr></thead>
              <tbody>
                {app.findings.map((f) => (
                  <tr key={f.id} className={f.status === 'ditutup' ? 'closed' : ''}>
                    <td><span className={`cat-pill ${f.category}`}>{CAT[f.category]}</span><div className="small text-muted2 mt-1">#{f.id}</div></td>
                    <td>{f.description}{sub(f)}</td>
                    <td className="text-nowrap">{due(f)}</td>
                    {renderActions && <td className="text-end text-nowrap">{renderActions(f)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="app-cards">
            {app.findings.map((f) => (
              <div key={f.id} className={`finding ${f.category} ${f.status === 'ditutup' ? 'closed' : ''}`}>
                <div className="d-flex justify-content-between gap-2 align-items-start">
                  <span className={`cat ${f.category}`}>{CAT[f.category]} · #{f.id}</span>
                  <span className="small text-end">{f.status === 'ditutup' ? <span className="pill pill-done">Ditutup</span> : f.due_date ? <span className={f.days_left < 0 ? 'text-danger fw-semibold' : 'text-warn fw-semibold'}>{f.days_left < 0 ? `Terlambat ${-f.days_left} hari` : `Sisa ${f.days_left} hari`} · {fmtDate(f.due_date)}</span> : <span className="text-muted2">Tanpa tenggat</span>}</span>
                </div>
                <div className="mt-1">{f.description}</div>
                {sub(f)}
                {renderActions && <div className="mt-2 d-flex flex-wrap gap-2">{renderActions(f)}</div>}
              </div>
            ))}
          </div>
        </>
      )}
      {!app.findings.length && <div className="panel-b"><p className="text-muted2 small mb-0">Belum ada temuan yang dicatat.</p></div>}
      {extra && <div className="panel-b pt-0 mt-3">{extra}</div>}
    </section>
  );
}

/**
 * Rincian invoice sesuai format PSU: harga pekerjaan, DPP nilai lain, PPN 12%, total, PPh 23 (jika dipotong), grand total.
 */
function InvoiceView({ p, onDownloadInvoice, onDownloadProof }) {
  if (!p) return null;
  return (
    <div className="small">
      <div className="d-flex justify-content-between flex-wrap gap-1 mb-1"><span className="mono">{p.invoice_no}</span><span className="text-muted2">{fmtDate(p.created_at)}</span></div>
      <table className="table table-sm inv mb-1">
        <tbody>
          {p.items.map((it, i) => (
            <tr key={i}><td style={{ whiteSpace: 'pre-line' }}>{it.label}{it.qty > 1 && <span className="d-block text-muted2">({it.qty} {it.unit || 'sampel'} × {rupiah(it.price)})</span>}</td><td className="text-end num text-nowrap">{rupiah(it.amount)}</td></tr>
          ))}
          {p.items.length > 1 && <tr><td className="text-muted2">Jumlah Harga</td><td className="text-end num">{rupiah(p.price)}</td></tr>}
          <tr><td className="text-muted2">DPP Nilai Lain (11/12 × harga)</td><td className="text-end num">{rupiah(p.dpp_lain)}</td></tr>
          <tr><td className="text-muted2">PPN 12%</td><td className="text-end num">{rupiah(p.ppn)}</td></tr>
          <tr><td className="text-muted2">Total</td><td className="text-end num">{rupiah(p.total)}</td></tr>
          {p.pph23 > 0 && <tr><td className="text-muted2">PPh 23 (2% × harga, dipotong)</td><td className="text-end num">−{rupiah(p.pph23)}</td></tr>}
          <tr><th>Grand Total (Dibayar)</th><th className="text-end num">{rupiah(p.amount)}</th></tr>
        </tbody>
      </table>
      {p.due_date && <div>Jatuh tempo: <b>{fmtDate(p.due_date)}</b></div>}
      {p.note && <div className="text-muted2">{p.note}</div>}
      <div className="d-flex flex-wrap gap-3 mt-2">
        {onDownloadInvoice && <button type="button" className="btn btn-link btn-sm p-0" onClick={onDownloadInvoice}><i className="bi bi-file-earmark-pdf me-1" />Unduh Invoice (PDF)</button>}
        {p.has_proof && onDownloadProof && <button type="button" className="btn btn-link btn-sm p-0" onClick={onDownloadProof}><i className="bi bi-receipt me-1" />Lihat Bukti Bayar</button>}
      </div>
    </div>
  );
}

const PAY = { belum: 'Invoice belum terbit', invoice: 'Menunggu pembayaran', menunggu: 'Bukti bayar diverifikasi', terverifikasi: 'Lunas' };
const PAYPILL = { belum: 'pill-progress', invoice: 'pill-action', menunggu: 'pill-action', terverifikasi: 'pill-done' };

/** Daftar dokumen dengan tombol unduh. */
function DocList({ list, admin, onDownloadDoc }) {
  return (
    <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
      {list.map((d) => (
        <li key={d.id} className="d-flex align-items-start gap-2">
          <i className="bi bi-file-earmark-text text-muted2 mt-1" aria-hidden="true" />
          <span style={{ minWidth: 0 }}>
            <button className="btn btn-link p-0 text-start fw-semibold" style={{ minHeight: 0 }} onClick={() => onDownloadDoc(d)}>{d.original_name}</button>
            {admin && !d.customer_visible && <span className="badge-internal">internal</span>}
            <span className="d-block small text-muted2">{d.doc_type} · {fmtDate(d.created_at)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const FragmentRow = ({ k, v }) => (<><dt>{k}</dt><dd>{v}</dd></>);
/** Kode lacak + tombol salin (untuk dibagikan ke rekan kerja, dibuka tanpa login). */
function CopyCode({ code }) {
  const [ok, setOk] = useState(false);
  const copy = () => navigator.clipboard?.writeText(code).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); });
  return (
    <span className="d-inline-flex align-items-center gap-1 flex-wrap">
      <span className="mono">{code}</span>
      <button type="button" className="btn btn-link btn-sm p-0" style={{ minHeight: 0 }} onClick={copy} aria-label="Salin Kode Lacak" title="Salin Kode Lacak"><i className={`bi bi-${ok ? 'check2' : 'clipboard'}`} />{ok ? 'Disalin' : 'Salin'}</button>
    </span>
  );
}

const detailOf = (app, key) => app.details.find((d) => d.key === key)?.value;

/** Riwayat satu tahap: catatan, berkas pada tahap itu, dan (tahap pembayaran) invoice + bukti bayar. */
function StepHistory({ app, step, onClose, onDownloadDoc, onDownloadInvoice, onDownloadProof }) {
  const logs = step ? app.logs.filter((l) => l.status_code === step.code) : [];
  const docs = step ? app.documents.filter((d) => d.step_order === step.order && !logs.some((l) => l.files?.some((f) => f.id === d.id))) : [];
  return (
    <Sheet open={!!step} onClose={onClose} wide icon="clock-history" title={step ? `${step.code} · ${step.name}` : ''}
      sub={step && (step.state === 'done' ? `Selesai${step.started_at ? ` · dimulai ${fmtDate(step.started_at)}` : ''}` : step.state === 'skipped' ? 'Dilewati' : 'Tahap saat ini')}>
      {step && (
        <div className="d-flex flex-column gap-3">
          {step.pay && app.payment && <section className="border rounded-3 p-3"><div className="eyebrow mb-2">Invoice & Pembayaran</div><InvoiceView p={app.payment} onDownloadInvoice={onDownloadInvoice} onDownloadProof={onDownloadProof} /></section>}
          <div><div className="eyebrow mb-2">Riwayat Tahap</div><LogList logs={logs} onDownloadDoc={onDownloadDoc} /></div>
          {docs.length > 0 && <div><div className="eyebrow mb-2">Berkas di Tahap Ini</div><DocList list={docs} onDownloadDoc={onDownloadDoc} /></div>}
        </div>
      )}
    </Sheet>
  );
}

/** Info pengujian laboratorium (SP), versi baca-saja. */
function LabInfoCard({ app, onDownloadDoc, empty }) {
  const lhu = app.documents.filter((d) => d.doc_type === 'Laporan Hasil Uji (LHU)');
  if (app.service_code !== 'SP') return null;
  if (!app.lab_info && !lhu.length) return empty ? <section className="panel panel-b"><h2 className="mb-1">Pengujian Laboratorium</h2><p className="small text-muted2 mb-0">PSU sedang menyiapkan pengujian laboratorium. Nama lab, estimasi, dan hasil (LHU) akan tampil di sini.</p></section> : null;
  return (
    <section className="panel panel-b d-flex flex-column gap-1">
      <h2 className="mb-1">Pengujian Laboratorium</h2>
      <div className="small">{app.lab_info?.name || 'Laboratorium'}{app.lab_info?.estimate && <> · estimasi {app.lab_info.estimate}</>}</div>
      {app.lab_info?.link ? <a className="small fw-semibold" href={app.lab_info.link} target="_blank" rel="noreferrer">Buka hasil lab (LHU) <i className="bi bi-box-arrow-up-right" /></a>
        : !lhu.length && <span className="small text-muted2">LHU akan muncul di sini setelah terbit.</span>}
      {lhu.length > 0 && <div>{lhu.map((d) => <button key={d.id} type="button" className="file-chip" onClick={() => onDownloadDoc(d)}><i className="bi bi-paperclip" />LHU: {d.original_name}</button>)}</div>}
    </section>
  );
}

/**
 * Detail pengajuan (Opsi A, sesuai kanvas):
 * - kepala: judul + status, tombol aksi utama di kanan (HP: bar aksi menempel di bawah)
 * - progres bersegmen selebar halaman
 * - kiri: tab Ringkasan/Temuan/Dokumen/Invoice/Riwayat · kanan: kartu keputusan, pemohon & invoice ringkas
 * Props: headerActions, mobileBar, decision {title, body}, main (panel tambahan di Ringkasan), children (panel paling bawah Ringkasan)
 */
export default function ApplicationView({ app, backTo, admin, headerActions, mobileBar, decision, main, labPanel, onParam, onDownloadDoc, onDownloadInvoice, onDownloadProof, findingActions, findingsExtra, children, tab: tabProp, onTab }) {
  const [tabState, setTabState] = useState('ringkasan');
  const tab = tabProp ?? tabState;
  const setTab = (t) => { (onTab || setTabState)(t); };
  const [allSteps, setAllSteps] = useState(false);
  const [moreDetail, setMoreDetail] = useState(false);
  const [histStep, setHistStep] = useState(null);
  const fromPsu = app.documents.filter((d) => d.source === 'admin');
  const fromCustomer = app.documents.filter((d) => d.source !== 'admin');
  const openF = app.findings.filter((f) => f.status !== 'ditutup' && f.category !== 'observasi');
  const curIdx = app.steps.findIndex((s) => ['current', 'action', 'closed'].includes(s.state));
  const next = curIdx >= 0 ? app.steps.slice(curIdx + 1).find((s) => s.state === 'todo') : null;
  const showFindings = app.findings.length > 0 || !!findingsExtra;
  const title = app.product_label.split(' · ').slice(0, 2).join(' · ');
  const docName = docWord(app.service_code, true);
  // SP: tab Pengujian Laboratorium muncul sejak tahap ST-06 berjalan atau info lab sudah ada
  const st06 = app.steps.find((x) => x.code === 'ST-06');
  const showLab = app.service_code === 'SP' && (!!app.lab_info || app.documents.some((d) => d.doc_type === 'Laporan Hasil Uji (LHU)') || (st06 && st06.state !== 'todo'));
  const tabs = [
    ['ringkasan', 'Ringkasan'],
    ...(showLab ? [['lab', 'Pengujian Lab']] : []),
    ...(showFindings ? [['temuan', 'Temuan', openF.length, openF.length > 0]] : []),
    ['dokumen', 'Dokumen', app.documents.length],
    ...(app.payment ? [['invoice', 'Invoice']] : []),
    ['riwayat', 'Riwayat'],
  ];
  const pabrik = detailOf(app, 'kota_provinsi') || detailOf(app, 'alamat_pabrik');
  const merek = detailOf(app, 'merek_jenis') || detailOf(app, 'merek');
  const bar = mobileBar ?? headerActions;

  return (
    <div className={`detail ${bar ? 'has-mbar' : ''}`}>
      <div className="detail-head">
        <div className="min-w-0">
          <Link to={backTo} className="back-link"><i className="bi bi-arrow-left" />Kembali</Link>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h1>{title}</h1>
            <StatusPill value={app.condition} />
            {app.is_package && <span className="pill pill-purple">Paket LSPro + Lab</span>}
          </div>
          <div className="text-muted2 small"><span className="mono">{app.application_no}</span> · {app.service_name}{admin && ` · ${app.company_name}`} · diajukan {fmtDate(app.created_at)}</div>
        </div>
        {headerActions && <div className="detail-actions">{headerActions}</div>}
      </div>

      {decision && !decision.quiet && <div className="decision-m">{decision.body}</div>}
      {app.status === 'ditolak' && <div className="alert alert-danger mb-3"><b>Pengajuan ditutup.</b> {app.reject_note}</div>}
      {app.status === 'batal' && <div className="alert alert-secondary mb-3"><b>Pengajuan dibatalkan pelanggan.</b> {app.reject_note}</div>}
      {app.status === 'selesai' && app.certificate && <div className="alert alert-success mb-3"><b>{docName} {app.certificate.certificate_no}</b> terbit {fmtDate(app.certificate.issued_at)}.{!app.survey_done && (admin ? ' Pelanggan belum mengisi survei kepuasan.' : ' Isi survei kepuasan untuk mengunduh dokumen.')}</div>}

      <section className="panel panel-b mb-4 d-flex flex-column gap-3 prog-panel" aria-label="Progres">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span><b>{app.status === 'selesai' ? 'Semua Tahap Selesai' : `Tahap ${curIdx + 1} dari ${app.steps.length}`}</b>{app.status !== 'selesai' && <> · {app.current_step.name}</>}{next && app.status !== 'selesai' && <span className="text-muted2 hide-sm"> · berikutnya {next.name}</span>}</span>
          <span className="d-flex align-items-center gap-3">{app.steps[curIdx]?.started_at && <span className="small text-muted2">dimulai {fmtDate(app.steps[curIdx].started_at)}</span>}<b className="prog-pct num">{app.progress}%</b></span>
        </div>
        <StepTrack steps={app.steps} onSelect={setHistStep} />
        <div className="prog-foot">
          <StepLegend />
          <span className="small text-muted2 hide-sm">Klik tahap untuk melihat riwayatnya</span>
          <button type="button" className="tr-all" onClick={() => setAllSteps(true)}>Lihat Semua Tahap<i className="bi bi-arrow-right" aria-hidden="true" /></button>
        </div>
        <Sheet open={allSteps} onClose={() => setAllSteps(false)} icon="signpost-split" title="Tahapan Pengajuan" sub={`${app.service_name} · ${app.steps.length} tahap`}><StepsList steps={app.steps} /></Sheet>
        <StepHistory app={app} step={histStep} onClose={() => setHistStep(null)} onDownloadDoc={onDownloadDoc} onDownloadInvoice={onDownloadInvoice} onDownloadProof={onDownloadProof} />
        <ParamInline app={app} onChange={onParam} />
      </section>

      <div className="detail-grid">
        <div className="da-main">
          <div className={`tabs ${tabs.length > 4 ? 'page-tabs' : ''}`} role="tablist" style={{ '--tabs': tabs.length }}>
            {tabs.map(([k, l, n, warn]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n ? <span className={`cnt ${warn ? 'warn' : ''}`}>{n}</span> : null}</button>
            ))}
          </div>

          {tab === 'ringkasan' && (
            <>
              {showFindings && (openF.length > 0 || findingsExtra || app.findings.some((f) => f.status !== 'ditutup')) && <FindingsPanel app={app} renderActions={findingActions} extra={findingsExtra} onDownloadDoc={onDownloadDoc} />}
              {main}
              <section className="panel">
                <div className="panel-h"><h2 className="mb-0">Aktivitas Terbaru</h2><button className="btn btn-link btn-sm p-0 fw-semibold" style={{ minHeight: 0 }} onClick={() => setTab('riwayat')}>Lihat Semua</button></div>
                <div className="panel-b py-1"><LogList logs={app.logs} onDownloadDoc={onDownloadDoc} limit={3} /></div>
              </section>
              {children}
            </>
          )}
          {tab === 'lab' && (labPanel || <LabInfoCard app={app} onDownloadDoc={onDownloadDoc} empty />)}
          {tab === 'temuan' && <FindingsPanel app={app} renderActions={findingActions} extra={findingsExtra} onDownloadDoc={onDownloadDoc} />}
          {tab === 'dokumen' && (
            <section className="panel panel-b d-flex flex-column gap-3">
              {!app.documents.length && <p className="text-muted2 mb-0">Belum ada dokumen.</p>}
              {fromPsu.length > 0 && <div><div className="eyebrow mb-2">Dari PSU</div><DocList list={fromPsu} admin={admin} onDownloadDoc={onDownloadDoc} /></div>}
              {fromCustomer.length > 0 && <div><div className="eyebrow mb-2">{admin ? 'Dari pelanggan' : 'Dokumen Anda'}</div><DocList list={fromCustomer} admin={admin} onDownloadDoc={onDownloadDoc} /></div>}
            </section>
          )}
          {tab === 'invoice' && app.payment && (
            <section className="panel">
              <div className="panel-h"><h2 className="mb-0">Invoice</h2><span className={`pill ${PAYPILL[app.payment_status]}`}>{PAY[app.payment_status]}</span></div>
              <div className="panel-b"><InvoiceView p={app.payment} onDownloadInvoice={onDownloadInvoice} onDownloadProof={onDownloadProof} /></div>
            </section>
          )}
          {tab === 'riwayat' && (
            <section className="panel">
              <div className="panel-h"><h2 className="mb-0">Riwayat Status</h2><span className="small text-muted2">{admin ? 'audit trail lengkap' : 'yang dapat dilihat pelanggan'}</span></div>
              <div className="panel-b py-1"><LogList logs={app.logs} onDownloadDoc={onDownloadDoc} /></div>
            </section>
          )}
        </div>

        <aside className="da-side">
          {decision && (
            <section className="panel decision-d">
              <div className="panel-h"><h2 className="mb-0">{decision.title}</h2></div>
              <div className="panel-b">{decision.body}</div>
            </section>
          )}
          <section className="panel">
            <div className="panel-h"><h2 className="mb-0">{admin ? 'Pemohon' : 'Detail'}</h2></div>
            <div className="panel-b">
              <dl className="dl-grid">
                {admin && <FragmentRow k="Perusahaan" v={<b>{app.company_name}</b>} />}
                {pabrik && <FragmentRow k="Pabrik" v={pabrik} />}
                {merek && <FragmentRow k="Merek & Jenis" v={<span style={{ whiteSpace: 'pre-line' }}>{merek}</span>} />}
                {admin && <FragmentRow k="Kontak" v={<>{app.user_name}<br /><a href={`mailto:${app.user_email}`}>{app.user_email}</a></>} />}
                <FragmentRow k="Kode Lacak" v={<CopyCode code={app.tracking_code} />} />
                {app.price_option && <FragmentRow k="Opsi Harga" v={app.price_option} />}
              </dl>
              <button type="button" className="btn btn-link btn-sm p-0 mt-2 fw-semibold" style={{ minHeight: 0 }} onClick={() => setMoreDetail(true)}>Lihat Detail Lengkap</button>
              <Sheet open={moreDetail} onClose={() => setMoreDetail(false)} wide icon="file-text" title="Detail Pengajuan" sub={`${app.application_no} · ${app.service_name}`}>
                <dl className="dl-grid mb-0">
                  {admin && <FragmentRow k="Perusahaan" v={app.company_name} />}
                  <FragmentRow k="Produk / Layanan" v={app.product_label} />
                  <FragmentRow k="Kode Lacak" v={<CopyCode code={app.tracking_code} />} />
                  <FragmentRow k="Diajukan" v={fmtDate(app.created_at)} />
                  {app.price_option && <FragmentRow k="Opsi Harga" v={app.price_option} />}
                  {app.application_type && <FragmentRow k="Jenis" v={app.application_type} />}
                  {app.scheme && <FragmentRow k="Skema" v={app.scheme} />}
                  {app.origin && <FragmentRow k="Asal Produk" v={app.origin} />}
                  {app.location && <FragmentRow k="Lokasi" v={app.location === 'onsite' ? 'On-site' : 'Di laboratorium'} />}
                  {app.details.filter((d) => !['kota_provinsi', 'merek'].includes(d.key)).map((d) => <FragmentRow key={d.label} k={d.label} v={<span style={{ whiteSpace: 'pre-line' }}>{d.value}</span>} />)}
                  {app.equipment.map((e) => <FragmentRow key={e.id} k="Alat" v={`${e.name} ${e.brand_model || ''} · S/N ${e.serial_number || '-'} · ${e.range_capacity || ''}`} />)}
                  {app.samples.map((x) => <FragmentRow key={x.id} k="Sampel" v={`${x.description} · ${x.quantity} sampel`} />)}
                </dl>
              </Sheet>
            </div>
          </section>
          {app.payment ? (
            <section className="panel panel-b inv-mini">
              <div className="d-flex justify-content-between align-items-center gap-2"><h2 className="mb-0">Invoice</h2><span className={`pill ${PAYPILL[app.payment_status]}`}>{PAY[app.payment_status]}</span></div>
              <div className="amt num">{rupiah(app.payment.amount)}</div>
              <div className="small text-muted2"><span className="mono">{app.payment.invoice_no}</span> · termasuk PPN{app.payment.pph23 > 0 ? ', dipotong PPh 23' : ''}{app.payment.due_date && app.payment_status !== 'terverifikasi' && <> · jatuh tempo {fmtDate(app.payment.due_date)}</>}</div>
              <button type="button" className="btn btn-link btn-sm p-0 mt-1 fw-semibold align-self-start" style={{ minHeight: 0 }} onClick={() => setTab('invoice')}>Lihat Rincian</button>
            </section>
          ) : app.current_step.is_payment_step && (
            <section className="panel panel-b inv-mini"><h2 className="mb-1">Invoice</h2><span className="small text-muted2">Belum terbit.</span></section>
          )}
        </aside>
      </div>

      {bar && <div className="mbar">{bar}</div>}
    </div>
  );
}

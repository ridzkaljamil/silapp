/**
 * Tampilan detail pengajuan, dipakai area pelanggan dan admin.
 * Panel aksi diberikan lewat prop `actions` (berbeda per role).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusPill, SegProgress, StepsList, LogList, fmtDate, rupiah } from './ui';
import { docWord } from '../lib/constants';

const PST = { antri: ['pill-progress', 'Antrian'], uji: ['pill-action', 'Dalam pengujian'], selesai: ['pill-done', 'Selesai'] };
const CAT = { mayor: 'Mayor', minor: 'Minor', observasi: 'Observasi' };
const FST = { terbuka: ['pill-action', 'Menunggu perbaikan'], dikirim: ['pill-progress', 'Bukti dikirim, ditinjau PSU'], ditutup: ['pill-done', 'Ditutup'] };
const EXT = { diajukan: 'Perpanjangan diajukan', disetujui: 'Perpanjangan disetujui', ditolak: 'Perpanjangan ditolak' };

/** Status per parameter, ditampilkan di dalam tahap "Proses pengujian laboratorium". */
export function ParamInline({ app, onChange }) {
  if (!app.parameters?.length) return null;
  const done = app.parameters.filter((p) => p.status === 'selesai').length;
  const lab05 = app.steps.find((s) => s.code === 'LAB-05');
  return (
    <div className="params-inline">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <b className="small" style={{ color: 'var(--navy)' }}>LAB-05 · {lab05?.name} — status per parameter</b>
        <span className="badge text-bg-light border">{done}/{app.parameters.length} selesai{app.full_sni ? ' · parameter lengkap SNI' : ''}</span>
      </div>
      <div className="table-responsive">
        <table className="table table-sm mb-0 align-middle small">
          <tbody>
            {app.parameters.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{p.is_custom ? <span className="badge text-bg-light border ms-1 fw-normal">lainnya</span> : null}{p.method && <div className="text-muted2" style={{ fontSize: 11 }}>{p.method}</div>}</td>
                <td className="text-end text-sm-start"><span className={`pill ${PST[p.status][0]}`}>{PST[p.status][1]}</span></td>
                {onChange && <td className="text-end">{p.status !== 'selesai' && <button className="btn btn-outline-secondary btn-sm" onClick={() => onChange(p.id, p.status === 'antri' ? 'uji' : 'selesai')}>{p.status === 'antri' ? 'Mulai uji' : 'Tandai selesai'}</button>}</td>}
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
export function FindingsPanel({ app, renderActions, extra, onDownloadDoc }) {
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
        <h2 className="mb-0">Temuan audit</h2>
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

/** Rincian invoice (harga sudah termasuk PPN 11%). */
export function InvoiceView({ p, onDownloadInvoice }) {
  if (!p) return null;
  return (
    <div className="small">
      <div className="d-flex justify-content-between flex-wrap gap-1 mb-1"><span className="mono">{p.invoice_no}</span><span className="text-muted2">{fmtDate(p.created_at)}</span></div>
      <table className="table table-sm inv mb-1">
        <tbody>
          {p.items.map((it, i) => (
            <tr key={i}><td>{it.label}{it.qty > 1 && <span className="text-muted2"> · {rupiah(it.price)} × {it.qty}</span>}</td><td className="text-end num text-nowrap">{rupiah(it.amount)}</td></tr>
          ))}
          <tr><td className="text-muted2">DPP</td><td className="text-end num">{rupiah(p.dpp)}</td></tr>
          <tr><td className="text-muted2">PPN 11%</td><td className="text-end num">{rupiah(p.ppn)}</td></tr>
          <tr><th>Total (termasuk PPN)</th><th className="text-end num">{rupiah(p.amount)}</th></tr>
        </tbody>
      </table>
      {p.due_date && <div>Batas pembayaran: <b>{fmtDate(p.due_date)}</b></div>}
      {p.note && <div className="text-muted2">{p.note}</div>}
      {p.has_invoice_file && <button type="button" className="btn btn-link btn-sm p-0" onClick={onDownloadInvoice}><i className="bi bi-file-earmark-pdf me-1" />Unduh file invoice</button>}
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
const detailOf = (app, key) => app.details.find((d) => d.key === key)?.value;

/** Info pengujian laboratorium (SP), versi baca-saja. */
export function LabInfoCard({ app, onDownloadDoc }) {
  const lhu = app.documents.filter((d) => d.doc_type === 'Laporan Hasil Uji (LHU)');
  if (app.service_code !== 'SP' || (!app.lab_info && !lhu.length)) return null;
  return (
    <section className="panel panel-b d-flex flex-column gap-1">
      <h2 className="mb-1">Pengujian laboratorium</h2>
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
export default function ApplicationView({ app, backTo, admin, headerActions, mobileBar, decision, main, onParam, onDownloadDoc, onDownloadInvoice, findingActions, findingsExtra, children, tab: tabProp, onTab }) {
  const [tabState, setTabState] = useState('ringkasan');
  const tab = tabProp ?? tabState;
  const setTab = (t) => { (onTab || setTabState)(t); };
  const [allSteps, setAllSteps] = useState(false);
  const [moreDetail, setMoreDetail] = useState(false);
  const fromPsu = app.documents.filter((d) => d.source === 'admin');
  const fromCustomer = app.documents.filter((d) => d.source !== 'admin');
  const openF = app.findings.filter((f) => f.status !== 'ditutup' && f.category !== 'observasi');
  const curIdx = app.steps.findIndex((s) => ['current', 'action', 'closed'].includes(s.state));
  const next = curIdx >= 0 ? app.steps.slice(curIdx + 1).find((s) => s.state === 'todo') : null;
  const showFindings = app.findings.length > 0 || !!findingsExtra;
  const title = app.product_label.split(' · ').slice(0, 2).join(' · ');
  const docName = docWord(app.service_code, true);
  const tabs = [
    ['ringkasan', 'Ringkasan'],
    ...(showFindings ? [['temuan', 'Temuan', openF.length, openF.length > 0]] : []),
    ['dokumen', 'Dokumen', app.documents.length],
    ...(app.payment ? [['invoice', 'Invoice']] : []),
    ['riwayat', 'Riwayat'],
  ];
  const pabrik = detailOf(app, 'kota_provinsi') || detailOf(app, 'alamat_pabrik');
  const merek = detailOf(app, 'merek');
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
      {app.status === 'selesai' && app.certificate && <div className="alert alert-success mb-3"><b>{docName} {app.certificate.certificate_no}</b> terbit {fmtDate(app.certificate.issued_at)}.{!app.survey_done && (admin ? ' Pelanggan belum mengisi survei kepuasan.' : ' Isi survei kepuasan untuk mengunduh dokumen.')}</div>}

      <section className="panel panel-b mb-4 d-flex flex-column gap-3" aria-label="Progres">
        <div className="d-flex justify-content-between flex-wrap gap-2 small">
          <span><b style={{ color: 'var(--navy)' }}>{app.status === 'selesai' ? 'Semua tahap selesai' : `Tahap ${curIdx + 1} dari ${app.steps.length}`}</b>{app.status !== 'selesai' && <> · {app.current_step.name}</>}{next && app.status !== 'selesai' && <span className="text-muted2 hide-sm"> · berikutnya {next.name}</span>}</span>
          <span className="text-muted2">{app.progress}%{app.steps[curIdx]?.started_at && ` · dimulai ${fmtDate(app.steps[curIdx].started_at)}`}</span>
        </div>
        <SegProgress steps={app.steps} />
        <button type="button" className="btn btn-link p-0 align-self-start small fw-semibold" style={{ minHeight: 0 }} onClick={() => setAllSteps(!allSteps)} aria-expanded={allSteps}>{allSteps ? 'Sembunyikan tahap' : 'Lihat semua tahap'}</button>
        {allSteps && <div className="reveal"><StepsList steps={app.steps} /></div>}
        <ParamInline app={app} onChange={onParam} />
      </section>

      <div className="detail-grid">
        <div className="da-main">
          <div className="tabs" role="tablist" style={{ '--tabs': tabs.length }}>
            {tabs.map(([k, l, n, warn]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n ? <span className={`cnt ${warn ? 'warn' : ''}`}>{n}</span> : null}</button>
            ))}
          </div>

          {tab === 'ringkasan' && (
            <>
              {showFindings && (openF.length > 0 || findingsExtra || app.findings.some((f) => f.status !== 'ditutup')) && <FindingsPanel app={app} renderActions={findingActions} extra={findingsExtra} onDownloadDoc={onDownloadDoc} />}
              {main}
              {!admin && <LabInfoCard app={app} onDownloadDoc={onDownloadDoc} />}
              <section className="panel">
                <div className="panel-h"><h2 className="mb-0">Aktivitas terbaru</h2><button className="btn btn-link btn-sm p-0 fw-semibold" style={{ minHeight: 0 }} onClick={() => setTab('riwayat')}>Lihat semua</button></div>
                <div className="panel-b py-1"><LogList logs={app.logs} onDownloadDoc={onDownloadDoc} limit={3} /></div>
              </section>
              {children}
            </>
          )}
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
              <div className="panel-b"><InvoiceView p={app.payment} onDownloadInvoice={onDownloadInvoice} /></div>
            </section>
          )}
          {tab === 'riwayat' && (
            <section className="panel">
              <div className="panel-h"><h2 className="mb-0">Riwayat status</h2><span className="small text-muted2">{admin ? 'audit trail lengkap' : 'yang dapat dilihat pelanggan'}</span></div>
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
                {merek && <FragmentRow k="Merek" v={merek} />}
                {admin && <FragmentRow k="Kontak" v={<>{app.user_name}<br /><a href={`mailto:${app.user_email}`}>{app.user_email}</a></>} />}
                <FragmentRow k="Kode lacak" v={<span className="mono">{app.tracking_code}</span>} />
              </dl>
              {moreDetail && <dl className="dl-grid swap mt-2">
                {app.application_type && <FragmentRow k="Jenis" v={app.application_type} />}
                {app.scheme && <FragmentRow k="Skema" v={app.scheme} />}
                {app.location && <FragmentRow k="Lokasi" v={app.location === 'onsite' ? 'On-site' : 'Di laboratorium'} />}
                {app.details.filter((d) => !['kota_provinsi', 'merek'].includes(d.key)).map((d) => <FragmentRow key={d.label} k={d.label} v={d.value} />)}
                {app.equipment.map((e) => <FragmentRow key={e.id} k="Alat" v={`${e.name} ${e.brand_model || ''} · S/N ${e.serial_number || '-'} · ${e.range_capacity || ''}`} />)}
                {app.samples.map((x) => <FragmentRow key={x.id} k="Sampel" v={`${x.description} · ${x.quantity} sampel`} />)}
              </dl>}
              <button type="button" className="btn btn-link btn-sm p-0 mt-2 fw-semibold" style={{ minHeight: 0 }} onClick={() => setMoreDetail(!moreDetail)} aria-expanded={moreDetail}>{moreDetail ? 'Ringkas' : 'Lihat detail lengkap'}</button>
            </div>
          </section>
          {app.payment ? (
            <section className="panel panel-b inv-mini">
              <div className="d-flex justify-content-between align-items-center gap-2"><h2 className="mb-0">Invoice</h2><span className={`pill ${PAYPILL[app.payment_status]}`}>{PAY[app.payment_status]}</span></div>
              <div className="amt num">{rupiah(app.payment.amount)}</div>
              <div className="small text-muted2"><span className="mono">{app.payment.invoice_no}</span> · termasuk PPN 11%{app.payment.due_date && app.payment_status !== 'terverifikasi' && <> · jatuh tempo {fmtDate(app.payment.due_date)}</>}</div>
              <button type="button" className="btn btn-link btn-sm p-0 mt-1 fw-semibold align-self-start" style={{ minHeight: 0 }} onClick={() => setTab('invoice')}>Lihat rincian</button>
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

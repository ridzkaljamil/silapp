/**
 * Tampilan detail pengajuan, dipakai area pelanggan dan admin.
 * Panel aksi diberikan lewat prop `actions` (berbeda per role).
 */
import { Link } from 'react-router-dom';
import { StatusPill, Progress, Stepper, LogList, fmtDate } from './ui';

const PST = { antri: ['pill-progress', 'Antrian'], uji: ['pill-action', 'Dalam pengujian'], selesai: ['pill-done', 'Selesai'] };

export function ParamPanel({ app, onChange }) {
  if (!app.parameters?.length) return null;
  const done = app.parameters.filter((p) => p.status === 'selesai').length;
  return (
    <section className="panel">
      <div className="panel-h"><h2 className="mb-0">Status parameter</h2><span className="badge text-bg-light border">{done}/{app.parameters.length} selesai</span></div>
      <div className="table-responsive">
        <table className="table table-sm mb-0 align-middle small">
          <tbody>
            {app.parameters.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{p.method && <div className="text-muted2" style={{ fontSize: 11 }}>{p.method}</div>}</td>
                <td><span className={`pill ${PST[p.status][0]}`}>{PST[p.status][1]}</span></td>
                {onChange && <td className="text-end">{p.status !== 'selesai' && <button className="btn btn-outline-secondary btn-sm" onClick={() => onChange(p.id, p.status === 'antri' ? 'uji' : 'selesai')}>{p.status === 'antri' ? 'Mulai uji' : 'Tandai selesai'}</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 small text-muted2">Nilai hasil pengujian ditampilkan di LHU setelah diterbitkan.</div>
    </section>
  );
}

export default function ApplicationView({ app, backTo, admin, actions, onParam, onDownloadDoc }) {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <Link to={backTo} className="btn btn-sm btn-outline-secondary mb-2"><i className="bi bi-arrow-left" /> Kembali</Link>
          <h1 className="mb-1 num">{app.application_no}</h1>
          <div className="text-muted2">{app.service_name} · {app.product_label}{admin && ` · ${app.company_name}`}</div>
        </div>
        <StatusPill value={app.condition} />
      </div>

      {app.status === 'aksi' && <div className="alert alert-warning mb-0"><b>Action Required.</b> {app.action_note}</div>}
      {app.status === 'ditolak' && <div className="alert alert-danger mb-0"><b>Closed.</b> {app.reject_note}</div>}
      {app.status === 'selesai' && app.certificate && <div className="alert alert-success mb-0"><b>{app.condition}.</b> Sertifikat / LHU <span className="mono">{app.certificate.certificate_no}</span> terbit {fmtDate(app.certificate.issued_at)}.</div>}

      <section className="panel">
        <div className="panel-h"><h2 className="mb-0">Progres</h2><span className="badge text-bg-light border fw-normal">{app.status === 'selesai' ? 'Selesai' : `${app.current_step.code} · ${app.current_step.name}`}</span></div>
        <div className="panel-b d-flex flex-column gap-3"><Progress value={app.progress} big /><Stepper steps={app.steps} /></div>
      </section>

      <div className="row g-3">
        <div className="col-lg-7">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Riwayat status</h2><span className="badge text-bg-light border fw-normal">{admin ? 'audit trail lengkap' : 'yang dapat dilihat pelanggan'}</span></div>
            <div className="panel-b"><LogList logs={app.logs} /></div>
          </section>
        </div>
        <div className="col-lg-5 d-flex flex-column gap-3">
          {actions && <section className="panel"><div className="panel-h"><h2 className="mb-0">{admin ? 'Tindakan Admin' : 'Tindakan Anda'}</h2></div><div className="panel-b">{actions}</div></section>}
          <ParamPanel app={app} onChange={onParam} />
          <section className="panel">
            <div className="panel-h"><h2 className="mb-0">Detail</h2></div>
            <div className="panel-b small">
              <dl className="row mb-0">
                <dt className="col-5 text-muted2 fw-normal">Kode lacak</dt><dd className="col-7 mono">{app.tracking_code}</dd>
                <dt className="col-5 text-muted2 fw-normal">Diajukan</dt><dd className="col-7">{fmtDate(app.created_at)}</dd>
                {app.application_type && <><dt className="col-5 text-muted2 fw-normal">Jenis permohonan</dt><dd className="col-7">{app.application_type}</dd></>}
                {app.scheme && <><dt className="col-5 text-muted2 fw-normal">Skema</dt><dd className="col-7">{app.scheme}</dd></>}
                {app.location && <><dt className="col-5 text-muted2 fw-normal">Lokasi</dt><dd className="col-7">{app.location === 'onsite' ? 'On-site' : 'Di laboratorium'}</dd></>}
                <dt className="col-5 text-muted2 fw-normal">Pembayaran</dt><dd className="col-7">{{ belum: 'Belum', menunggu: 'Menunggu verifikasi', terverifikasi: 'Terverifikasi' }[app.payment_status]}{app.payment && <div className="mono">{app.payment.invoice_no}</div>}</dd>
                {app.details.map((d) => <FragmentRow key={d.label} k={d.label} v={d.value} />)}
                {app.equipment.map((e) => <FragmentRow key={e.id} k="Alat" v={`${e.name} ${e.brand_model || ''} · S/N ${e.serial_number || '-'} · ${e.range_capacity || ''}`} />)}
                {app.samples.map((s) => <FragmentRow key={s.id} k="Sampel" v={`${s.description} · ${s.quantity} sampel`} />)}
                {admin && <FragmentRow k="Pemohon" v={`${app.user_name} · ${app.user_email}`} />}
              </dl>
              {app.documents.length > 0 && (
                <>
                  <div className="eyebrow mt-3 mb-1">Dokumen</div>
                  <ul className="list-unstyled mb-0">
                    {app.documents.map((d) => (
                      <li key={d.id}><button className="btn btn-link btn-sm p-0 text-start" onClick={() => onDownloadDoc(d)}><i className="bi bi-file-earmark-arrow-down me-1" />{d.doc_type}: {d.original_name}</button></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const FragmentRow = ({ k, v }) => (<><dt className="col-5 text-muted2 fw-normal">{k}</dt><dd className="col-7">{v}</dd></>);

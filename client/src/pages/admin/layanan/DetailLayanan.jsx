/** Detail layanan (Super Admin): deskripsi, tahapan proses, contact person, estimasi, status operasional, dan SLA per tahap. */
import { Fragment, useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../../api';
import { PageHead, Loading, useToast, MobileList, Select, FormSheet } from '../../../components/ui';

const OPS = { ok: ['pill-done', 'Beroperasi'], dev: ['pill-action', 'Pengembangan'], prep: ['pill-progress', 'Persiapan'] };
/** Nama alur tahapan: '' = alur utama, '1B' = alur khusus skema Tipe 1b (SP). */
const FLOW = { '': 'Alur Utama', '1B': 'Alur Tipe 1b' };
const mainOf = (s) => s.steps.filter((x) => !x.flow);
const altOf = (s) => s.steps.filter((x) => x.flow);
export default function DetailLayanan() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get('/superadmin/services').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/superadmin/services/${edit.id}`, edit);
      for (const st of edit.steps) await api.put(`/superadmin/steps/${st.id}`, st);
      toast(`${edit.name} disimpan.`); setEdit(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const leaves = rows.filter((s) => s.bidang || s.code === 'LSM');
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Master Layanan" sub="Detail setiap layanan: deskripsi, tahapan proses, estimasi waktu, contact person, status operasional, dan target SLA per tahap." />
      <section className="panel mb-3">
        <MobileList items={leaves} row={(s) => ({
          key: s.id, avatar: s.code, title: s.name,
          sub: `${mainOf(s)[0]?.status_code} s.d. ${mainOf(s).at(-1)?.status_code} · ${mainOf(s).length} status${altOf(s).length ? ` · + ${FLOW['1B']} (${altOf(s).length})` : ''}`,
          pills: [OPS[s.state]],
          detail: {
            rows: [['Kode', <span className="mono">{s.code}</span>], ['Tahapan Proses', `${mainOf(s)[0]?.status_code} s.d. ${mainOf(s).at(-1)?.status_code}`], ...(altOf(s).length ? [[FLOW['1B'], altOf(s).map((x) => x.name).join(' → ')]] : []), ['Kondisional', s.steps.filter((x) => x.is_optional).map((x) => x.status_code).join(', ') || '—'], ['Contact Person', s.cp_name ? `${s.cp_name}${s.cp_phone ? ` · ${s.cp_phone}` : ''}` : 'Belum diisi'], ['Estimasi', s.est_text]],
            actions: [{ label: 'Ubah', icon: 'pencil', primary: true, onClick: () => setEdit(JSON.parse(JSON.stringify(s))) }],
          },
        })} />
        <div className="table-responsive d-only">
        <table className="table mb-0 align-middle">
          <thead><tr><th>Kode</th><th>Layanan</th><th>Tahapan Proses</th><th>Contact Person</th><th>Estimasi</th><th>Operasional</th><th></th></tr></thead>
          <tbody>{leaves.map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.code}</td><td>{s.name}</td>
              <td className="small">{mainOf(s)[0]?.status_code} s.d. {mainOf(s).at(-1)?.status_code}<div className="text-muted2">{mainOf(s).length} status{mainOf(s).some((x) => x.is_optional) ? ' · ' + mainOf(s).filter((x) => x.is_optional).map((x) => x.status_code).join(', ') + ' kondisional' : ''}</div>
                {altOf(s).length > 0 && <div className="text-muted2">+ {FLOW['1B']}: {altOf(s).length} status</div>}</td>
              <td className="small">{s.cp_name || <span className="text-muted2">Belum diisi</span>}<div className="num">{s.cp_phone}</div></td>
              <td className="small">{s.est_text}</td>
              <td><span className={`pill ${OPS[s.state][0]}`}>{OPS[s.state][1]}</span></td>
              <td><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(JSON.parse(JSON.stringify(s)))}>Ubah</button></td>
            </tr>
          ))}</tbody>
        </table>
        </div>
      </section>
      <FormSheet open={!!edit} onClose={() => setEdit(null)} onSubmit={save} busy={busy} wide="xl" icon="layers"
        confirm={() => ({ title: 'Simpan Perubahan Layanan?', body: <>Detail dan tahapan <b>{edit?.name}</b> akan diperbarui.</> })}
        title={edit ? `Ubah ${edit.name}` : ''} sub="Perubahan nama tahap langsung terlihat di halaman pelanggan dan lacak.">
        {edit && (
          <div className="row g-3">
            {[['cp_name', 'Nama Contact Person'], ['cp_phone', 'No. WhatsApp CP'], ['est_text', 'Estimasi Waktu']].map(([k, l]) => (
              <div className="col-md-4" key={k}><label className="form-label" htmlFor={k}>{l}</label><input id={k} className="form-control" value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
            ))}
            <div className="col-md-4"><label className="form-label" htmlFor="stt">Status Operasional</label><Select id="stt" className="form-select" value={edit.state} onChange={(e) => setEdit({ ...edit, state: e.target.value })}><option value="ok">Beroperasi</option><option value="prep">Persiapan</option><option value="dev">Pengembangan</option></Select></div>
            <div className="col-md-8"><label className="form-label" htmlFor="dsc">Deskripsi</label><textarea id="dsc" rows={2} maxLength={255} className="form-control" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="col-12 table-responsive">
              <table className="table table-sm small align-middle mb-0 stack-table">
                <thead><tr><th>Kode</th><th>Nama Tahap</th><th>Progres</th><th>Penanda</th><th style={{ width: 130 }}>Target SLA (Hari)</th></tr></thead>
                <tbody>{edit.steps.map((st, i) => (
                  <Fragment key={st.id}>
                  {(i === 0 ? edit.steps.some((x) => x.flow) : st.flow !== edit.steps[i - 1].flow) && <tr className="flow-h"><th colSpan={5}>{FLOW[st.flow] || st.flow}{st.flow === '1B' && <span className="fw-normal text-muted2"> · dipakai pengajuan dengan skema Tipe 1b</span>}</th></tr>}
                  <tr>
                    <td className="mono st-full"><b>{st.status_code}</b></td>
                    <td className="st-full" data-label="Nama Tahap"><input className="form-control form-control-sm" value={st.name} aria-label={`Nama ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, name: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                    <td className="num" data-label="Progres">{st.progress_pct}%</td>
                    <td data-label="Penanda">{[st.is_payment_step && 'bayar', st.is_certificate_step && 'sertifikat', st.is_optional && 'kondisional'].filter(Boolean).join(', ') || '—'}</td>
                    <td className="st-full" data-label="Target SLA (Hari)"><input type="number" min={0} className="form-control form-control-sm" value={st.sla_days ?? ''} aria-label={`SLA ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, sla_days: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                  </tr>
                  </Fragment>
                ))}</tbody>
              </table>
              <div className="form-text">Target SLA dalam hari kalender, dihitung sejak tahap ditangani PSU (saat menunggu pelanggan tidak dihitung). Kosongkan bila tahap tidak punya target. Pengajuan yang melewati target ditandai di Antrean dan Dashboard.</div>
            </div>
          </div>
        )}
      </FormSheet>
    </>
  );
}

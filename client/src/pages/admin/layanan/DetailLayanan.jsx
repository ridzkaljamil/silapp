/** Detail layanan (Super Admin): deskripsi, tahapan proses, contact person, estimasi, status operasional, dan SLA per tahap. */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../../api';
import { PageHead, Loading, useToast, MobileList, Select, FormSheet } from '../../../components/ui';

const OPS = { ok: ['pill-done', 'Beroperasi'], dev: ['pill-action', 'Pengembangan'], prep: ['pill-progress', 'Persiapan'] };
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
          sub: `${s.steps[0]?.status_code} s.d. ${s.steps.at(-1)?.status_code} · ${s.steps.length} status`,
          pills: [OPS[s.state]],
          detail: {
            rows: [['Kode', <span className="mono">{s.code}</span>], ['Tahapan Proses', `${s.steps[0]?.status_code} s.d. ${s.steps.at(-1)?.status_code}`], ['Kondisional', s.steps.filter((x) => x.is_optional).map((x) => x.status_code).join(', ') || '—'], ['Contact Person', s.cp_name ? `${s.cp_name}${s.cp_phone ? ` · ${s.cp_phone}` : ''}` : 'Belum diisi'], ['Estimasi', s.est_text]],
            actions: [{ label: 'Ubah', icon: 'pencil', primary: true, onClick: () => setEdit(JSON.parse(JSON.stringify(s))) }],
          },
        })} />
        <div className="table-responsive d-only">
        <table className="table mb-0 align-middle">
          <thead><tr><th>Kode</th><th>Layanan</th><th>Tahapan Proses</th><th>Contact Person</th><th>Estimasi</th><th>Operasional</th><th></th></tr></thead>
          <tbody>{leaves.map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.code}</td><td>{s.name}</td>
              <td className="small">{s.steps[0]?.status_code} s.d. {s.steps.at(-1)?.status_code}<div className="text-muted2">{s.steps.length} status{s.steps.some((x) => x.is_optional) ? ' · ' + s.steps.filter((x) => x.is_optional).map((x) => x.status_code).join(', ') + ' kondisional' : ''}</div></td>
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
                  <tr key={st.id}>
                    <td className="mono st-full"><b>{st.status_code}</b></td>
                    <td className="st-full" data-label="Nama Tahap"><input className="form-control form-control-sm" value={st.name} aria-label={`Nama ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, name: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                    <td className="num" data-label="Progres">{st.progress_pct}%</td>
                    <td data-label="Penanda">{[st.is_payment_step && 'bayar', st.is_certificate_step && 'sertifikat', st.is_optional && 'kondisional'].filter(Boolean).join(', ') || '—'}</td>
                    <td className="st-full" data-label="Target SLA (Hari)"><input type="number" min={0} className="form-control form-control-sm" value={st.sla_days ?? ''} aria-label={`SLA ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, sla_days: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </FormSheet>
    </>
  );
}

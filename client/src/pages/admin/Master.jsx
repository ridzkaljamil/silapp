/** Master layanan: status tracking, contact person, SLA (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, MobileList, Select } from '../../components/ui';

const OPS = { ok: ['pill-done', 'Beroperasi'], dev: ['pill-action', 'Pengembangan'], prep: ['pill-progress', 'Persiapan'] };
export default function Master() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.get('/superadmin/services').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const save = async () => {
    try {
      await api.put(`/superadmin/services/${edit.id}`, edit);
      for (const st of edit.steps) await api.put(`/superadmin/steps/${st.id}`, st);
      toast('Master layanan disimpan.'); setEdit(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const leaves = rows.filter((s) => s.bidang);
  return (
    <>
      <PageHead eyebrow="Master layanan" title="Status tracking, contact person, dan SLA" sub="Status utama per layanan sesuai rancangan sistem tracking. Super Admin dapat mengubah contact person, estimasi, status operasional, nama tahap, dan target SLA." />
      <section className="panel mb-3">
        <MobileList items={leaves} row={(s) => ({
          key: s.id, avatar: s.code, title: s.name,
          sub: `${s.steps[0]?.status_code} s.d. ${s.steps.at(-1)?.status_code} · ${s.steps.length} status`,
          pills: [OPS[s.state]],
          detail: {
            rows: [['Kode', <span className="mono">{s.code}</span>], ['Status tracking', `${s.steps[0]?.status_code} s.d. ${s.steps.at(-1)?.status_code}`], ['Kondisional', s.steps.filter((x) => x.is_optional).map((x) => x.status_code).join(', ') || '—'], ['Contact person', s.cp_name ? `${s.cp_name}${s.cp_phone ? ` · ${s.cp_phone}` : ''}` : 'Belum diisi'], ['Estimasi', s.est_text]],
            actions: [{ label: 'Ubah', icon: 'pencil', primary: true, scrollTo: 'master-edit', onClick: () => setEdit(JSON.parse(JSON.stringify(s))) }],
          },
        })} />
        <div className="table-responsive d-only">
        <table className="table mb-0 align-middle">
          <thead><tr><th>Kode</th><th>Layanan</th><th>Status tracking</th><th>Contact person</th><th>Estimasi</th><th>Operasional</th><th></th></tr></thead>
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
      {edit && (
        <section className="panel" id="master-edit">
          <div className="panel-h"><h2 className="mb-0">Ubah {edit.name}</h2></div>
          <div className="panel-b row g-3">
            {[['cp_name', 'Nama contact person'], ['cp_phone', 'No. WhatsApp CP'], ['est_text', 'Estimasi waktu']].map(([k, l]) => (
              <div className="col-md-4" key={k}><label className="form-label" htmlFor={k}>{l}</label><input id={k} className="form-control" value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
            ))}
            <div className="col-md-4"><label className="form-label" htmlFor="stt">Status operasional</label><Select id="stt" className="form-select" value={edit.state} onChange={(e) => setEdit({ ...edit, state: e.target.value })}><option value="ok">Beroperasi</option><option value="prep">Persiapan</option><option value="dev">Pengembangan</option></Select></div>
            <div className="col-md-8"><label className="form-label" htmlFor="dsc">Deskripsi</label><input id="dsc" className="form-control" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="col-12 table-responsive">
              <table className="table table-sm small align-middle mb-0 stack-table">
                <thead><tr><th>Kode</th><th>Nama tahap</th><th>Progres</th><th>Penanda</th><th style={{ width: 130 }}>Target SLA (hari)</th></tr></thead>
                <tbody>{edit.steps.map((st, i) => (
                  <tr key={st.id}>
                    <td className="mono st-full"><b>{st.status_code}</b></td>
                    <td className="st-full" data-label="Nama tahap"><input className="form-control form-control-sm" value={st.name} aria-label={`Nama ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, name: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                    <td className="num" data-label="Progres">{st.progress_pct}%</td>
                    <td data-label="Penanda">{[st.is_payment_step && 'bayar', st.is_certificate_step && 'sertifikat', st.is_optional && 'kondisional'].filter(Boolean).join(', ') || '—'}</td>
                    <td className="st-full" data-label="Target SLA (hari)"><input type="number" min={0} className="form-control form-control-sm" value={st.sla_days ?? ''} aria-label={`SLA ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, sla_days: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="col-12 d-flex gap-2"><button className="btn btn-primary" onClick={save}>Simpan</button><button className="btn btn-outline-secondary" onClick={() => setEdit(null)}>Batal</button></div>
          </div>
        </section>
      )}
    </>
  );
}

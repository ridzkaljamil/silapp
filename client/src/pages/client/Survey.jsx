/** Survei kepuasan pelanggan: wajib sebelum unduh sertifikat/LHU. */
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { Loading, useToast } from '../../components/ui';
import { docWord } from '../../lib/constants';

/** Survei kepuasan pelanggan: wajib sebelum unduh sertifikat/LHU. */
export default function Survey({ app, onDone }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/applications/${app.id}/survey`).then((r) => setData(r.data)); }, [app.id]);
  if (!data) return <Loading />;
  const submit = async () => {
    if (data.questions.some((q) => !scores[q.id])) return toast('Mohon beri nilai untuk semua pertanyaan.', 'danger');
    setBusy(true);
    try { const r = await api.post(`/applications/${app.id}/survey`, { scores, suggestion }); onDone(r.data); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <section className="panel" aria-labelledby="sv-title">
      <div className="panel-h"><h2 className="mb-0" id="sv-title">Survei Kepuasan Pelanggan</h2><span className="small text-muted2">wajib diisi untuk setiap penerbitan dokumen</span></div>
      <div className="panel-b d-flex flex-column gap-3">
        <p className="mb-0 small">Sebelum mengunduh {docWord(app.service_code)}, mohon beri penilaian atas layanan kami. Skala 1 = sangat tidak puas, 5 = sangat puas.</p>
        {data.questions.map((q, i) => (
          <fieldset key={q.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2">
            <legend className="fs-6 mb-0 flex-grow-1" style={{ float: 'none', width: 'auto', maxWidth: 520 }}>{i + 1}. {q.question}</legend>
            <div className="score">
              {[1, 2, 3, 4, 5].map((v) => (
                <span key={v}><input type="radio" id={`q${q.id}-${v}`} name={`q${q.id}`} checked={scores[q.id] === v} onChange={() => setScores({ ...scores, [q.id]: v })} /><label htmlFor={`q${q.id}-${v}`}>{v}</label></span>
              ))}
            </div>
          </fieldset>
        ))}
        <div><label className="form-label" htmlFor="sg">Kritik dan saran (opsional)</label><textarea id="sg" className="form-control" rows={3} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} /></div>
        <div><button className="btn btn-gold" disabled={busy} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim survei'}</button></div>
      </div>
    </section>
  );
}

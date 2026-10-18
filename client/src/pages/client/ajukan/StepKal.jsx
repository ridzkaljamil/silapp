/** Langkah 2 Kalibrasi: data alat dan lokasi kalibrasi. */
import { F } from './shared';

export default function StepKal({ x }) {
  const { dyn, kal, setKal } = x;
  return (
    <div className="row g-3">
      {[['name', 'Nama Alat'], ['brand_model', 'Merek / Tipe-model'], ['serial_number', 'Nomor Seri'], ['range_capacity', 'Kapasitas / Range'], ['resolution', 'Resolusi'], ['calibration_points', 'Titik Kalibrasi yang Diminta'], ['accessories', 'Aksesori yang Disertakan'], ['quantity', 'Jumlah Alat']].map(([k, l]) => (
        <F key={k} label={l} id={k} req={k === 'name'}><input id={k} type={k === 'quantity' ? 'number' : 'text'} min={1} className="form-control" value={kal[k]} onChange={(e) => setKal({ ...kal, [k]: e.target.value })} /></F>
      ))}
      <div className="col-12">
        <span className="form-label d-block">Lokasi Kalibrasi</span>
        {[['lab', 'Di Laboratorium PSU (Alat Dikirim/Diantar)'], ['onsite', 'On-site di Lokasi Pelanggan']].map(([v, l]) => (
          <div className="form-check form-check-inline" key={v}><input className="form-check-input" type="radio" id={`loc-${v}`} checked={kal.location === v} onChange={() => setKal({ ...kal, location: v })} /><label className="form-check-label" htmlFor={`loc-${v}`}>{l}</label></div>
        ))}
      </div>
      {dyn}
    </div>
  );
}

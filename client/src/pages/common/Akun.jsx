import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useAuth } from '../../AuthContext';
import { Avatar, PageHead, useToast, useConfirm } from '../../components/ui';
import { useSignOut } from '../../components/Layouts';
import { roleLabel } from '../../lib/constants';


/** Pengaturan akun: foto profil, data diri, keamanan. Dipakai semua role. */
export default function Akun() {
  const { user, setSessionUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const signOut = useSignOut();
  const fileRef = useRef(null);
  const [f, setF] = useState({ name: user.name || '', phone: user.phone || '', address: user.address || '' });
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const isUser = user.role === 'user';
  const base = isUser ? '/klien' : '/admin';
  const dirty = f.name !== (user.name || '') || f.phone !== (user.phone || '') || f.address !== (user.address || '');

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { setSessionUser((await api.put('/auth/profile', f)).data.user); toast('Perubahan akun disimpan.'); }
    catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(jpe?g|png)$/i.test(file.name)) return toast('Format foto harus JPG atau PNG.', 'danger');
    if (file.size > 2 * 1024 * 1024) return toast('Ukuran foto maksimal 2 MB.', 'danger');
    const fd = new FormData(); fd.append('avatar', file);
    setUp(true);
    try { setSessionUser((await api.post('/auth/avatar', fd)).data.user); toast('Foto profil diperbarui.'); }
    catch (ex) { toast(errMsg(ex), 'danger'); } finally { setUp(false); }
  };
  const removePhoto = async () => {
    if (!(await confirm({ title: 'Hapus foto profil?', body: 'Foto akan diganti dengan inisial nama Anda.', ok: 'Hapus foto', danger: true, icon: 'trash' }))) return;
    try { setSessionUser((await api.delete('/auth/avatar')).data.user); toast('Foto profil dihapus.'); }
    catch (ex) { toast(errMsg(ex), 'danger'); }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHead eyebrow="Akun" title="Pengaturan akun" sub="Kelola foto profil dan data kontak Anda." />
      <div className="d-flex flex-column gap-3">
        <section className="panel">
          <div className="panel-h"><h2 className="mb-0">Foto profil</h2></div>
          <div className="panel-b d-flex align-items-center gap-3 flex-wrap">
            <div className={`avatar-edit ${up ? 'busy' : ''}`}>
              <Avatar user={user} size={76} />
              {up && <span className="spinner-border spinner-border-sm" />}
            </div>
            <div className="d-flex flex-column gap-2">
              <div className="d-flex gap-2 flex-wrap">
                <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={up}><i className="bi bi-upload" />{user.avatar_url ? 'Ganti foto' : 'Unggah foto'}</button>
                {user.avatar_url && <button type="button" className="btn btn-outline-secondary" onClick={removePhoto} disabled={up}><i className="bi bi-trash" />Hapus</button>}
              </div>
              <span className="small text-muted2">JPG atau PNG, maksimal 2 MB. Disarankan foto persegi.</span>
            </div>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" className="d-none" onChange={pick} />
          </div>
        </section>

        <form className="panel" onSubmit={save}>
          <div className="panel-h"><h2 className="mb-0">Data diri</h2></div>
          <div className="panel-b">
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label" htmlFor="ak-nm">Nama lengkap</label><input id="ak-nm" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={120} /></div>
              <div className="col-md-6"><label className="form-label" htmlFor="ak-ph">Nomor telepon / WhatsApp</label><input id="ak-ph" className="form-control" inputMode="tel" placeholder="08xxxxxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={30} /></div>
              <div className="col-md-6"><label className="form-label" htmlFor="ak-em">Email</label><input id="ak-em" className="form-control" value={user.email} disabled /><div className="form-text">Email dipakai untuk masuk. Hubungi Admin PSU untuk mengubahnya.</div></div>
              {isUser ? (
                <div className="col-md-6"><label className="form-label" htmlFor="ak-co">Perusahaan</label><input id="ak-co" className="form-control" value={user.company_name || ''} disabled /><div className="form-text">Data perusahaan dikelola oleh Admin PSU.</div></div>
              ) : (
                <div className="col-md-6"><label className="form-label" htmlFor="ak-rl">Peran</label><input id="ak-rl" className="form-control" value={roleLabel(user)} disabled /></div>
              )}
              <div className="col-12"><label className="form-label" htmlFor="ak-ad">Alamat {isUser ? 'korespondensi' : ''}</label><textarea id="ak-ad" className="form-control" rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={255} /></div>
            </div>
          </div>
          <div className="panel-f">
            <button type="button" className="btn btn-outline-secondary" disabled={!dirty || busy} onClick={() => setF({ name: user.name || '', phone: user.phone || '', address: user.address || '' })}>Batal</button>
            <button className="btn btn-primary" disabled={!dirty || busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
          </div>
        </form>

        <section className="panel">
          <div className="panel-h"><h2 className="mb-0">Keamanan</h2></div>
          <div className="panel-b d-flex flex-column gap-0 p-0">
            <Link to={`${base}/sandi`} className="set-row"><i className="bi bi-key" /><span><b>Ganti kata sandi</b><small>Gunakan minimal 8 karakter yang sulit ditebak.</small></span><i className="bi bi-chevron-right ms-auto" /></Link>
            <button type="button" className="set-row danger" onClick={signOut}><i className="bi bi-box-arrow-right" /><span><b>Keluar</b><small>Akhiri sesi di perangkat ini.</small></span><i className="bi bi-chevron-right ms-auto" /></button>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Perkecil foto sebelum diunggah (foto profil): sisi terpanjang maks. `max` px, disimpan sebagai JPEG.
 * Foto kamera HP yang 2–5 MB menjadi ±20–60 KB sehingga unggah dan tampil jauh lebih cepat.
 * Jika browser tidak mendukung (atau gagal membaca), file asli dikembalikan apa adanya.
 */
export async function shrinkImage(file, max = 320, quality = 0.86) {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    URL.revokeObjectURL(url);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG transparan diberi latar putih
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

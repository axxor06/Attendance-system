import { useEffect, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, Trash2, UploadCloud, X } from 'lucide-react';

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function PhotoUpload({ label = 'Profile photo', onUpload, onRemove, initialUrl = null }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initialUrl);
  const [error, setError] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState(initialUrl);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  async function handleChange(event) {
    const next = event.target.files?.[0];
    event.target.value = '';
    setError('');
    if (!next) return;
    if (!TYPES.includes(next.type)) {
      setFile(null);
      setError('Only JPG, PNG and WebP images are allowed.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      setError('Image must be 3 MB or smaller.');
      return;
    }
    setFile(next);
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(next));
    if (!onUpload) return;
    setIsUploading(true);
    try {
      const result = await onUpload(next);
      const url = result?.url || result?.image?.url;
      if (!url) throw new Error('Photo upload failed.');
      setUploadedUrl(url);
      setPreview(url);
    } catch {
      setUploadedUrl(null);
      setError('Photo upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function remove() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setUploadedUrl(null);
    setError('');
    onRemove?.();
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-ink">{label}</label>
        <span className="text-[11px] text-slate">JPG, PNG or WebP · max 3 MB</span>
      </div>
      <div className="rounded-2xl border border-dashed border-ink/15 bg-paper/60 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-ink/10 bg-white text-slate">
            {preview ? <img src={preview} alt="Profile preview" className="h-full w-full object-cover" /> : <ImagePlus size={24} aria-hidden="true" />}
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-paper focus-within:ring-2 focus-within:ring-amber">
              <UploadCloud size={15} aria-hidden="true" /> {file || uploadedUrl ? 'Replace photo' : 'Choose photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleChange} disabled={isUploading} />
            </label>
            {file && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate"><Check size={13} className="text-sage" aria-hidden="true" />{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type.replace('image/', '').toUpperCase()}</p>}
            {isUploading && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink"><LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> Uploading photo…</p>}
            {uploadedUrl && !isUploading && <p className="mt-2 text-xs font-semibold text-sage">Photo ready to save.</p>}
          </div>
          {(preview || file || uploadedUrl) && !isUploading && <button type="button" onClick={remove} className="rounded-lg p-2 text-clay transition hover:bg-clay-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber" aria-label="Remove profile photo"><Trash2 size={16} aria-hidden="true" /></button>}
        </div>
        {error && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-clay" role="alert"><X size={14} aria-hidden="true" />{error}</p>}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { getFallbackSessionToken } from '../api/client';

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
  mimeHint?: string | null;
}

export function AuthenticatedImage({
  src,
  alt,
  className = '',
  mimeHint,
}: AuthenticatedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>(mimeHint || '');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setError(false);
    setBlobUrl(null);

    const token = getFallbackSessionToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(src, {
      credentials: 'include',
      headers,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load protected media');
        const ct = res.headers.get('content-type') || mimeHint || '';
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setContentType(ct);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, mimeHint]);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 text-center">
        Unable to load protected attachment preview.
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="rounded-xl bg-slate-100 p-6 text-xs text-slate-500 text-center animate-pulse">
        Loading preview...
      </div>
    );
  }

  if (contentType.includes('pdf')) {
    return (
      <div className="space-y-2">
        <iframe
          src={blobUrl}
          title={alt}
          className={`w-full h-[60vh] rounded-xl border border-slate-200 bg-white ${className}`}
        />
        <a
          href={blobUrl}
          download="receipt.pdf"
          className="inline-block text-xs font-semibold text-[#D71920] hover:underline"
        >
          Download PDF Receipt
        </a>
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}

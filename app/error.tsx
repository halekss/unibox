"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel" style={{ padding: 24, maxWidth: 640 }}>
      <h2>Action impossible</h2>
      <p>{error.message}</p>
      <button className="btn primary" onClick={reset}>Réessayer</button>
    </div>
  );
}

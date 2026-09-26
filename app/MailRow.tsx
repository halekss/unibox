import type { ReactNode } from "react";
import { plain, senderName, shortDate } from "./text.ts";
import { Prov } from "./Icons.tsx";

export type Mail = { id: number; provider: string; subject: string | null; sender: string | null; received_at: Date; preview: string | null };

// One email on one line: [checkbox] O/G | sender | subject — snippet | date | actions, preview folded underneath.
export function MailRow({ e, actions }: { e: Mail; actions?: ReactNode }) {
  const text = plain(e.preview);
  return (
    <div className="mrow">
      <label>
        <input type="checkbox" name="ids" value={e.id} defaultChecked />
        <Prov p={e.provider} />
        <span className="from">{senderName(e.sender)}</span>
        <span className="ellip subj">
          {e.subject || "(sans objet)"} {text && <span className="muted">{text.slice(0, 160)}</span>}
        </span>
      </label>
      <time dateTime={e.received_at.toISOString()}>{shortDate(e.received_at)}</time>
      <span>{actions}</span>
      {text && (
        <details>
          <summary>Aperçu</summary>
          <pre>{text}</pre>
        </details>
      )}
    </div>
  );
}

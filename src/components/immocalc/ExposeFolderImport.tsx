"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAX_EXPOSE_FILE_MB } from '@/lib/exposeFileLimits';
import { importBrowserExposeFile } from '@/lib/browserExposeFileImport';
import { folderFileKey, unseenFolderFiles } from '@/lib/exposeFolder';
import type { ExposeFacts, ExposeImportResult } from '@/lib/exposeImport';

type Directory = {
  name: string;
  values(): AsyncIterable<{ kind: string; getFile(): Promise<File> }>;
};
type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: 'read' }) => Promise<Directory> };
type Result = ExposeImportResult & { facts?: ExposeFacts };

export function ExposeFolderImport({ busy, onImport }: { busy: boolean; onImport: (result: Result) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [directoryName, setDirectoryName] = useState('Noch kein Ordner gewählt');
  const [queue, setQueue] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [canWatch, setCanWatch] = useState(false);
  const [hasDirectory, setHasDirectory] = useState(false);
  const [failures, setFailures] = useState<Array<{ file: File; error: string }>>([]);
  const input = useRef<HTMLInputElement>(null);
  const directory = useRef<Directory | null>(null);
  const seen = useRef(new Set<string>());
  const generation = useRef(0);
  const polling = useRef(false);
  const importing = useRef(false);
  const callback = useRef(onImport);
  useEffect(() => { callback.current = onImport; }, [onImport]);


  const enqueue = (files: File[]) => {
    const fresh = unseenFolderFiles(files, seen.current);
    fresh.forEach(file => seen.current.add(folderFileKey(file)));
    if (fresh.length) {
      setQueue(previous => [...previous, ...fresh]);
      setMessage(`${fresh.length} neue Datei(en) gefunden. Die Werte werden nacheinander zur Prüfung angezeigt.`);
    } else setMessage('Keine neuen unterstützten Exposés gefunden.');
  };

  useEffect(() => {
    if (!active || !directory.current) return;
    const session = generation.current;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const files: File[] = [];
        for await (const entry of directory.current!.values()) {
          if (entry.kind === 'file') files.push(await entry.getFile());
        }
        if (session === generation.current) enqueue(files);
      } catch {
        if (session === generation.current) {
          setActive(false);
          setMessage('Der Ordnerzugriff ist nicht mehr verfügbar. Bitte wähle den Ordner erneut aus.');
        }
      } finally { polling.current = false; }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (busy || loading || importing.current || !queue.length) return;
    importing.current = true;
    const file = queue[0];
    const session = generation.current;
    setLoading(true);
    void (async () => {
      try {
        const result = await importBrowserExposeFile(file) as { data: ExposeImportResult; facts?: ExposeFacts };
        if (session === generation.current) {
          setOpen(false);
          callback.current({ ...result.data, facts: result.facts });
          setMessage(`${file.name}: Erkannte Werte bitte bestätigen.`);
        }
      } catch (error) {
        if (session === generation.current) {
          setOpen(true);
          const reason = error instanceof Error ? error.message : 'Import fehlgeschlagen.';
          setMessage(`${file.name}: ${reason}`);
          setFailures(previous => [...previous, { file, error: reason }]);
        }
      } finally {
        if (session === generation.current) setQueue(previous => previous.slice(1));
        importing.current = false;
        setLoading(false);
      }
    })();
    // A preview blocks the next file until the parent closes it.
  }, [busy, loading, queue]);

  const chooseFolder = async () => {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) { input.current?.click(); return; }
    try {
      const selected = await picker.call(window, { mode: 'read' });
      generation.current++;
      setActive(false);
      setQueue([]);
      seen.current.clear();
      directory.current = selected;
      setHasDirectory(true);
      setDirectoryName(selected.name);
      // Wait for the next render so selecting a replacement restarts the effect.
      setMessage('Ordner gewählt. Mit „Automatisch importieren“ starten.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('Die Ordnerauswahl wurde vom Browser blockiert. Nutze „Ordner einmalig einlesen“.');
    }
  };

  const pause = () => {
    generation.current++;
    setActive(false);
    setQueue([]);
    setMessage('Import pausiert. Zum Fortsetzen den Ordner erneut auswählen.');
    directory.current = null;
    setHasDirectory(false);
  };

  return <>
    <button type="button" className={`icon-button local-inbox-action${active ? ' icon-button--active' : ''}`} onClick={() => { setCanWatch(typeof (window as PickerWindow).showDirectoryPicker === 'function'); setOpen(true); }} aria-label="Exposé-Ordner auswählen" aria-pressed={active}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
      <span>PDF-Ablage{active ? ' ●' : ''}</span>
    </button>
    <input hidden type="file" multiple ref={element => { input.current = element; if (element) element.setAttribute('webkitdirectory', ''); }} onChange={event => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      generation.current++;
      setActive(false);
      directory.current = null;
    setHasDirectory(false);
      setQueue([]);
      setDirectoryName(files[0].webkitRelativePath.split('/')[0] || 'Ausgewählter Ordner');
      // Preserve seen revisions when the same folder is selected again.
      enqueue(files);
      event.target.value = '';
    }} />
    {open && createPortal(<div className="dialog-backdrop"><section className="glass-panel scan-dialog local-inbox-dialog" role="dialog" aria-modal="true" aria-labelledby="expose-folder-title" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
      <h2 id="expose-folder-title">Exposé-Ordner</h2>
      <p>Wähle deinen Exposé-Ordner. Unterstützt werden PDF, DOCX, TXT und HTML. Die Dokumente werden auf deinem Gerät ausgelesen. Pro Datei sind maximal {MAX_EXPOSE_FILE_MB} MB möglich. Erkannte Werte übernimmst du erst nach Prüfung.</p>
      <code className="local-inbox-dialog__path">{directoryName}</code>
      <p className="local-inbox-dialog__hint">{canWatch ? 'Der automatische Import prüft die Dateien direkt im gewählten Ordner alle fünf Sekunden, solange diese Seite geöffnet bleibt. Nach Neuladen bitte erneut auswählen.' : 'Dieser Browser unterstützt keine laufende Ordnerüberwachung. Wähle den Ordner erneut aus, um neue oder geänderte Exposés einzulesen. Bereits erkannte Dateiversionen werden in dieser Sitzung übersprungen.'} Unterordner werden bei der einmaligen Auswahl ebenfalls eingelesen.</p>
      <p role="status">{loading ? 'Exposé wird ausgewertet …' : message}{active ? ' · Ordnerüberwachung aktiv' : ''}{queue.length ? ` · ${queue.length} Datei(en) ausstehend` : ''}</p>
      {failures.length > 0 && <div role="alert"><strong>Nicht importierte Dateien</strong><ul>{failures.map((failure, index) => <li key={index}>{failure.file.name}: {failure.error}</li>)}</ul><button type="button" className="dialog-button dialog-button--secondary" disabled={loading || busy} onClick={() => { setQueue(previous => [...previous, ...failures.map(failure => failure.file)]); setFailures([]); }}>Fehlgeschlagene Dateien erneut versuchen</button></div>}
      <div className="dialog-actions" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="dialog-button dialog-button--secondary" onClick={() => setOpen(false)} autoFocus>Schließen</button>
        <button type="button" className="dialog-button dialog-button--primary" disabled={loading || busy} onClick={() => void chooseFolder()}>{canWatch ? 'Ordner auswählen' : 'Ordner auswählen und einlesen'}</button>
        {canWatch && <button type="button" className="dialog-button dialog-button--secondary" disabled={loading || busy} onClick={() => input.current?.click()}>Ordner einmalig einlesen</button>}
        {canWatch && hasDirectory && !active && <button type="button" className="dialog-button dialog-button--primary" onClick={() => setActive(true)}>Automatisch importieren</button>}
        {(active || queue.length > 0) && <button type="button" className="dialog-button dialog-button--secondary" onClick={pause}>Import pausieren</button>}
      </div>
    </section></div>, document.body)}
  </>;
}

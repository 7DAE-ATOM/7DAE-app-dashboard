"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  parseImportedDiagramSave,
  type DiscoverDiagramSave,
} from "@/lib/discoverDiagramSaves";

type Props = {
  activeSaveName: string | null;
  /** The diagram has drifted from `activeSaveName` since it was written. */
  dirty: boolean;
  saves: string[];
  errorMessage: string | null;
  /** Empty canvas: there is nothing to write, export, or overwrite with. */
  disableSave: boolean;
  /** A load is in flight — unlike `/depgraph`, reopening a Discover diagram
   * needs the backend, so it can take a moment and it can fail. */
  loading: boolean;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onExportActive: () => void;
  onExportSave: (name: string) => void;
  onImport: (name: string, data: DiscoverDiagramSave) => void;
  onImportError: (message: string) => void;
};

/**
 * Save / Load controls for the Discover toolbar: a floppy button that writes
 * to the active save in one click, and a "…" menu carrying the five actions.
 *
 * Ported from `/depgraph`'s `SaveLoadControls` in the sibling `app-dashboard`
 * — same wording, same modals, same rules (empty name refused, existing name
 * silently overwritten, delete without confirmation) so the two pages don't
 * grow two vocabularies for the same job. The dressing follows this repo's
 * `DiscoverExportMenu`: same icon-button frame, same popover, same
 * Escape/outside-click mechanics.
 */
export default function DiagramSaveControls({
  activeSaveName,
  dirty,
  saves,
  errorMessage,
  disableSave,
  loading,
  onSave,
  onSaveAs,
  onLoad,
  onDelete,
  onExportActive,
  onExportSave,
  onImport,
  onImportError,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"saveAs" | "load" | "import" | null>(null);
  const [name, setName] = useState("");
  const [importDraft, setImportDraft] = useState<{
    data: DiscoverDiagramSave;
    name: string;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  const closeImport = () => {
    setImportDraft(null);
    setModal(null);
  };

  const submitSaveAs = () => {
    const trimmed = name.trim();
    if (!trimmed) return; // empty and whitespace-only names are refused
    onSaveAs(trimmed);
    setName("");
    setModal(null);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so the same file can be picked again later
    if (!file) return;
    try {
      const data = parseImportedDiagramSave(await file.text());
      const suggested = file.name.replace(/\.json$/i, "").trim() || "Imported diagram";
      setImportDraft({ data, name: suggested });
      setModal("import");
    } catch (err) {
      onImportError(err instanceof Error ? err.message : "This file could not be imported.");
    }
  };

  const importName = importDraft?.name.trim() ?? "";
  // Unlike *Save as new*, an import does not overwrite: the user did not
  // choose this name, it was proposed from the file.
  const importConflict = !!importDraft && saves.includes(importName);

  const submitImport = () => {
    if (!importDraft || !importName || importConflict) return;
    onImport(importName, importDraft.data);
    closeImport();
  };

  const saveDisabled = !activeSaveName || disableSave || loading;
  const exportDisabled = !activeSaveName || disableSave || loading;

  let floppyClass = "text-muted opacity-50 cursor-not-allowed";
  if (activeSaveName && !disableSave) {
    floppyClass = dirty ? "text-danger" : "text-success";
  }

  let floppyTitle = "No diagram saved yet";
  if (activeSaveName) {
    floppyTitle = dirty ? `${activeSaveName} — unsaved changes` : activeSaveName;
  }

  const itemClass =
    "flex w-full items-center justify-between gap-6 rounded px-2 py-1.5 text-left text-sm";
  const item = (enabled: boolean) =>
    clsx(itemClass, enabled ? "text-fg hover:bg-surface-2" : "cursor-not-allowed text-muted");

  const buttonFrame =
    "flex h-9 w-9 items-center justify-center rounded border border-border bg-surface disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        title={floppyTitle}
        aria-label={floppyTitle}
        className={clsx(buttonFrame, floppyClass)}
      >
        <SaveIcon />
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Diagram save actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(buttonFrame, "text-muted hover:text-fg")}
      >
        <span aria-hidden className="text-base leading-none">
          …
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileSelected}
        className="hidden"
      />

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-card border border-border bg-surface p-2 shadow-lg"
        >
          <p className="mb-1 px-2 text-xs uppercase tracking-[0.1em] text-muted">Diagram</p>
          <button
            type="button"
            role="menuitem"
            disabled={saveDisabled}
            onClick={() => {
              setOpen(false);
              onSave();
            }}
            className={item(!saveDisabled)}
          >
            Save
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disableSave || loading}
            onClick={() => {
              setOpen(false);
              setName("");
              setModal("saveAs");
            }}
            className={item(!disableSave && !loading)}
          >
            Save as new
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={loading}
            onClick={() => {
              setOpen(false);
              setModal("load");
            }}
            className={item(!loading)}
          >
            Load
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={exportDisabled}
            onClick={() => {
              setOpen(false);
              onExportActive();
            }}
            className={item(!exportDisabled)}
          >
            Export
            <span className="font-mono text-[10px] text-muted">.json</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              fileInputRef.current?.click();
            }}
            className={item(true)}
          >
            Import
            <span className="font-mono text-[10px] text-muted">.json</span>
          </button>
        </div>
      )}

      {modal === "saveAs" && (
        <Modal titleId="diagram-save-as-title" title="Save as new" onClose={() => setModal(null)}>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitSaveAs();
              if (e.key === "Escape") setModal(null);
            }}
            placeholder="Diagram name…"
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="rounded px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitSaveAs}
              disabled={!name.trim()}
              className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </Modal>
      )}

      {modal === "load" && (
        <Modal titleId="diagram-load-title" title="Load" onClose={() => setModal(null)}>
          {saves.length === 0 ? (
            <p className="px-1 py-1.5 text-sm text-muted">No saved diagrams yet.</p>
          ) : (
            <div className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
              {saves.map((saveName) => (
                <div
                  key={saveName}
                  className="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onLoad(saveName);
                      setModal(null);
                    }}
                    className="flex-1 truncate text-left text-fg"
                  >
                    {saveName}
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportSave(saveName)}
                    aria-label={`Export ${saveName}`}
                    className="text-muted hover:text-accent"
                  >
                    <DownloadIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(saveName)}
                    aria-label={`Delete ${saveName}`}
                    className="text-muted hover:text-danger"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {modal === "import" && importDraft && (
        <Modal titleId="diagram-import-title" title="Import diagram" onClose={closeImport}>
          <input
            autoFocus
            type="text"
            value={importDraft.name}
            onChange={(e) => setImportDraft((d) => (d ? { ...d, name: e.target.value } : d))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitImport();
              if (e.key === "Escape") closeImport();
            }}
            placeholder="Diagram name…"
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
          />
          {importConflict && (
            <p className="mt-1.5 text-xs text-danger">
              A diagram named &ldquo;{importName}&rdquo; already exists — choose another name.
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeImport}
              className="rounded px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitImport}
              disabled={!importName || importConflict}
              className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              Import
            </button>
          </div>
        </Modal>
      )}

      {errorMessage && (
        <div className="fixed right-4 top-4 z-50 max-w-xs rounded-card border border-danger/40 bg-surface px-3 py-2 text-xs text-danger shadow-lg">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

/** A `role="dialog"` div rather than a native `<dialog>`: the latter brings
 * its own closing and focus behaviour, which would diverge from the rest of
 * the app's overlays. */
function Modal({
  titleId,
  title,
  onClose,
  children,
}: Readonly<{
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}>) {
  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-lg"
      >
        <h2 id={titleId} className="mb-3 text-base font-semibold text-fg">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function SaveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

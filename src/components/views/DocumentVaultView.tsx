import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  Download,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  Trash2,
  Lock,
  RefreshCw,
  FolderOpen,
  Inbox,
  HardDrive,
} from 'lucide-react';
import { useSafety } from '../../safety/SafetyContext.tsx';
import type { DocumentMetadata } from '../../types/domain.ts';

interface CaseOption {
  readonly id: string;
  readonly sanitizedSummary: string;
  readonly status: string;
}

interface QueuedUploadItem {
  readonly id: string;
  readonly file: File;
  readonly classification: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const DocumentVaultView: React.FC = () => {
  const { registerPurgeCallback } = useSafety();

  // State
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);

  // Queue state
  const [queuedFiles, setQueuedFiles] = useState<QueuedUploadItem[]>([]);
  const [classification, setClassification] = useState<string>('CONFIDENTIAL');

  // UI status
  const [isLoadingCases, setIsLoadingCases] = useState<boolean>(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pure purge handler to wipe queued File objects and reset file inputs
  const purgeVaultVolatileState = useCallback(() => {
    setQueuedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
    setSuccessMsg(null);
  }, []);

  // Register with Safety Core purge registry
  useEffect(() => {
    const unregister = registerPurgeCallback('document-vault-view', 'form_drafts', () => {
      purgeVaultVolatileState();
    });

    return () => {
      unregister();
    };
  }, [registerPurgeCallback, purgeVaultVolatileState]);

  // Fetch accessible cases
  const fetchAccessibleCases = useCallback(async () => {
    setIsLoadingCases(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/cases', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Document vault access is restricted to authorized clients and assigned advocates.');
        }
        throw new Error('Failed to load accessible cases.');
      }

      const data = await res.json();
      const loadedCases: CaseOption[] = Array.isArray(data.cases) ? data.cases : [];
      setCases(loadedCases);

      if (loadedCases.length > 0 && !selectedCaseId) {
        setSelectedCaseId(loadedCases[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading accessible cases.';
      setError(msg);
      setCases([]);
    } finally {
      setIsLoadingCases(false);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    fetchAccessibleCases();
  }, [fetchAccessibleCases]);

  // Fetch documents for selected case
  const fetchDocumentsForCase = useCallback(async (caseId: string) => {
    if (!caseId) return;

    setIsLoadingDocs(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/documents/case/${encodeURIComponent(caseId)}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        throw new Error('Unable to retrieve document vault index.');
      }

      const data = await res.json();
      const docsList: DocumentMetadata[] = Array.isArray(data.documents) ? data.documents : [];
      setDocuments(docsList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading document vault.';
      setError(msg);
      setDocuments([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCaseId) {
      fetchDocumentsForCase(selectedCaseId);
    }
  }, [selectedCaseId, fetchDocumentsForCase]);

  // Handle File Selection (Max 2 queued files limit)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: QueuedUploadItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];

      // Validate max size (10 MiB)
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setError(`File "${f.name}" exceeds the 10 MiB size limit.`);
        continue;
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(f.type)) {
        setError(`File "${f.name}" format is not allowed. Only PDF, JPEG, and PNG files are accepted.`);
        continue;
      }

      newItems.push({
        id: `${Date.now()}-${i}`,
        file: f,
        classification,
      });
    }

    setQueuedFiles((prev) => {
      const combined = [...prev, ...newItems];
      if (combined.length > 2) {
        setError('Maximum 2 queued files allowed at one time.');
        return combined.slice(0, 2);
      }
      return combined;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        // Strip Data URL prefix (e.g. "data:application/pdf;base64,")
        const base64Content = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64Content);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Execute Upload
  const handleUploadQueuedFiles = async () => {
    if (queuedFiles.length === 0 || !selectedCaseId || isUploading) return;

    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      for (const item of queuedFiles) {
        const base64Content = await fileToBase64(item.file);

        const payload = {
          caseId: selectedCaseId,
          fileName: item.file.name,
          mimeType: item.file.type,
          fileBase64: base64Content,
          classification: item.classification,
        };

        const res = await fetch('/api/v1/documents/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Failed to upload "${item.file.name}".`);
        }
      }

      setSuccessMsg(`${queuedFiles.length} file(s) uploaded and scanned successfully.`);
      purgeVaultVolatileState();
      await fetchDocumentsForCase(selectedCaseId);

      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during document upload.';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Private Streaming Download
  const handleDownloadDocument = async (doc: DocumentMetadata) => {
    try {
      const res = await fetch(`/api/v1/documents/${encodeURIComponent(doc.id)}/download`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        throw new Error('Download failed or authorization expired.');
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.sanitizedFileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();

      // Revoke immediately after trigger
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(link);
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download file.';
      setError(msg);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6 text-slate-900 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <HardDrive className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Private Document Vault
              </h1>
              <p className="text-xs text-slate-500">
                Magic-Byte Verified Storage • Heuristic Malware Scanned • Direct Streamed Downloads
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            10 MiB Scan Boundary Active
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed pt-1">
          Upload legal petitions, medical records, or protective orders. Uploaded files undergo signature inspection and malware scanning before being placed in opaque private storage.
        </p>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => selectedCaseId && fetchDocumentsForCase(selectedCaseId)}
              className="text-xs font-semibold text-rose-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar Case Selector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-emerald-600" />
              Select Case ({cases.length})
            </span>
            <button
              type="button"
              onClick={fetchAccessibleCases}
              disabled={isLoadingCases}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCases ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoadingCases ? (
            <div className="space-y-2 py-4">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : cases.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Inbox className="mx-auto h-8 w-8 text-slate-300" />
              <p className="text-xs font-medium pt-2">No accessible cases.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {cases.map((c) => {
                const isSelected = c.id === selectedCaseId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-semibold line-clamp-1">{c.sanitizedSummary}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Vault Content Area */}
        <div className="md:col-span-2 space-y-6">
          {/* Upload Dropzone / Controls */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-600" />
                Upload File to Vault (Max 2 Queued)
              </span>
              <span className="text-[11px] text-slate-400">PDF, JPG, PNG &le; 10 MiB</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={!selectedCaseId || queuedFiles.length >= 2 || isUploading}
                className="hidden"
                id="vaultFileInput"
              />

              <label
                htmlFor="vaultFileInput"
                className={`flex-1 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors ${
                  !selectedCaseId || queuedFiles.length >= 2 || isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span>Choose PDF or Image File...</span>
              </label>

              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-900 font-medium"
              >
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="HIGHLY_SENSITIVE">HIGHLY_SENSITIVE</option>
                <option value="INTERNAL">INTERNAL</option>
              </select>
            </div>

            {/* Queued Files Preview */}
            {queuedFiles.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 uppercase block">
                  Queued for Upload & Security Scan ({queuedFiles.length})
                </span>
                {queuedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-950 font-medium"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span className="truncate">{item.file.name}</span>
                      <span className="text-[10px] text-emerald-800">({formatBytes(item.file.size)})</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeQueuedFile(item.id)}
                      className="text-emerald-700 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleUploadQueuedFiles}
                  disabled={isUploading || queuedFiles.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isUploading ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Scanning & Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Upload & Verify File</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Document Index Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-600" />
                Case Documents ({documents.length})
              </span>

              {selectedCaseId && (
                <button
                  type="button"
                  onClick={() => fetchDocumentsForCase(selectedCaseId)}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                  <span>Refresh Vault</span>
                </button>
              )}
            </div>

            {isLoadingDocs ? (
              <div className="space-y-2 py-4">
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Lock className="mx-auto h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium">No verified documents stored for this case.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs gap-2"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="truncate max-w-xs">{doc.sanitizedFileName}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{formatBytes(doc.fileSizeBytes)}</span>
                        <span>&bull;</span>
                        <span className="font-mono text-[10px] bg-slate-200/80 px-1.5 py-0.2 rounded-xs uppercase">
                          {doc.classification}
                        </span>
                        <span>&bull;</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(doc)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors self-start sm:self-auto shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Stream Download</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentVaultView;

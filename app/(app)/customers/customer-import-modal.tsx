'use client';

import { Upload, X, Check, AlertCircle, AlertTriangle, Download, Loader2 } from 'lucide-react';
import type { CustomerImportPreviewRow } from '@/types/api';
import { ModalDialog } from '../sales/modal-dialog';

const BTN_PRIMARY = 'inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2';
const BTN_SECONDARY = 'inline-flex items-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 py-2';

export interface CustomerImportModalProps {
  show: boolean;
  onClose: () => void;
  previewRows: CustomerImportPreviewRow[];
  summary: { total: number; valid: number; invalid: number; warnings: number } | null;
  importing: boolean;
  validating: boolean;
  onConfirm: () => void;
  onDownloadTemplate: () => void;
}

function rowPreviewStatus(row: CustomerImportPreviewRow): 'valid' | 'warning' | 'error' {
  if (!row.valid) return 'error';
  if (row.warnings.length > 0) return 'warning';
  return 'valid';
}

export function CustomerImportModal({
  show,
  onClose,
  previewRows,
  summary,
  importing,
  validating,
  onConfirm,
  onDownloadTemplate,
}: Readonly<CustomerImportModalProps>) {
  if (!show) return null;

  const validRows = previewRows.filter((r) => r.valid && r.resolved);
  const hasInvalid = (summary?.invalid ?? 0) > 0;
  const hasWarnings = (summary?.warnings ?? 0) > 0;

  let subtitle = `${previewRows.length} rows`;
  if (validating) subtitle = 'Validating workbook…';
  else if (summary) {
    subtitle = `${summary.total} rows — ${summary.valid} valid, ${summary.invalid} with errors`;
    if (summary.warnings > 0) subtitle += `, ${summary.warnings} with warnings`;
  }

  const customerLabel = validRows.length === 1 ? 'Customer' : 'Customers';
  const importButtonLabel = importing
    ? 'Importing…'
    : `Import ${validRows.length} ${customerLabel}`;

  return (
    <ModalDialog onClose={onClose}>
      <div className="relative z-10 w-full max-w-3xl rounded-md border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Upload size={18} className="text-primary" /> Import Customers
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {hasWarnings && (
          <div className="mb-4 p-3 rounded-md border border-amber-300 bg-amber-50 text-sm dark:bg-amber-900/20 dark:border-amber-800">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              {summary?.warnings} row(s) match an existing customer at the same hub or repeat in this file.
              You can still import if intended.
            </p>
          </div>
        )}

        {hasInvalid && (
          <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 text-sm">
            <p className="font-medium text-orange-800 mb-1">
              {summary?.invalid} row(s) have validation errors and will not be imported.
            </p>
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="text-orange-800 underline text-xs flex items-center gap-1 mt-1 hover:text-orange-900"
            >
              <Download size={12} /> Download a fresh template
            </button>
          </div>
        )}

        <div className="mb-4 p-3 rounded-md border bg-muted/20 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Template columns:</p>
          <p><strong>customer_name</strong> — display name (same name allowed at different hubs).</p>
          <p><strong>hub_name</strong> — choose from the dropdown in the template.</p>
        </div>

        {validating && previewRows.length === 0 && (
          <div className="mb-4 rounded-md border bg-primary/5 p-6 text-center">
            <Loader2 size={28} className="mx-auto mb-3 animate-spin text-primary" />
            <p className="font-semibold">Uploading and validating workbook...</p>
            <p className="mt-1 text-xs text-muted-foreground">Please wait while we read the selected Excel file.</p>
          </div>
        )}

        {previewRows.length > 0 && (
          <div className="rounded-md border overflow-hidden mb-4">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b sticky top-0">
                  <tr>
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">#</th>
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">Customer</th>
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">Hub</th>
                    <th className="h-8 px-3 text-center font-medium text-muted-foreground">Status</th>
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewRows.slice(0, 100).map((row) => {
                    const status = rowPreviewStatus(row);
                    return (
                      <tr
                        key={`import-row-${row.lineNo}`}
                        className={
                          status === 'error'
                            ? 'bg-orange-50/50'
                            : status === 'warning'
                              ? 'bg-amber-50/50'
                              : 'hover:bg-muted/30'
                        }
                      >
                        <td className="px-3 py-2 text-muted-foreground">{row.lineNo}</td>
                        <td className="px-3 py-2 font-medium">{row.customer_name}</td>
                        <td className="px-3 py-2">{row.hub_name || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {status === 'valid' && <Check size={14} className="text-green-600 mx-auto" />}
                          {status === 'warning' && (
                            <AlertTriangle size={14} className="text-amber-600 mx-auto" />
                          )}
                          {status === 'error' && (
                            <AlertCircle size={14} className="text-orange-600 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {status === 'error'
                            ? row.errors.join('; ')
                            : row.warnings.length > 0
                              ? row.warnings.join('; ')
                              : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={validRows.length === 0 || importing || validating}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            {importing && <Loader2 size={16} className="mr-2 animate-spin" />}
            {importButtonLabel}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

'use client';

import { Upload, X, Check, AlertCircle, Download, Loader2 } from 'lucide-react';
import type { SalesImportChunkResult, SalesImportPreviewRow } from '@/types/api';
import { fmt, BTN_PRIMARY, BTN_SECONDARY } from '../sales/sales-utils';
import { ModalDialog } from '../sales/modal-dialog';

export interface SalesImportModalProps {
  show: boolean;
  onClose: () => void;
  previewRows: SalesImportPreviewRow[];
  summary: { total: number; valid: number; invalid: number } | null;
  importing: boolean;
  validating: boolean;
  showImportConfirm: boolean;
  importProgress: { processed: number; total: number; imported: number; failed: number } | null;
  importResult: SalesImportChunkResult | null;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onDownloadTemplate: (type?: 'catalog' | 'custom') => void;
}

export function SalesImportModal({
  show,
  onClose,
  previewRows,
  summary,
  importing,
  validating,
  showImportConfirm,
  importProgress,
  importResult,
  onConfirm,
  onCancelConfirm,
  onDownloadTemplate,
}: Readonly<SalesImportModalProps>) {
  if (!show) return null;

  const validRows = previewRows.filter((r) => r.valid);
  const hasInvalid = (summary?.invalid ?? 0) > 0;
  const allCustom = previewRows.length > 0 && previewRows.every((r) => r.import_mode === 'custom');
  const freshTemplateType: 'catalog' | 'custom' = allCustom ? 'custom' : 'catalog';

  let subtitle = `${previewRows.length} rows`;
  if (validating) subtitle = 'Validating workbook…';
  else if (summary) {
    subtitle = `${summary.total} rows — ${summary.valid} valid, ${summary.invalid} with errors`;
  }

  const saleLabel = validRows.length === 1 ? 'Sale' : 'Sales';
  const progressPct = importProgress && importProgress.total > 0
    ? Math.min(100, Math.round((importProgress.processed / importProgress.total) * 100))
    : 0;

  const failedResults = (importResult?.results ?? []).filter((r) => !r.success);

  let importButtonLabel = `Import ${validRows.length} ${saleLabel}`;
  if (showImportConfirm && !importing) {
    importButtonLabel = `Yes, import ${validRows.length} ${saleLabel}`;
  } else if (importing) {
    importButtonLabel = `Importing ${importProgress?.processed ?? 0} / ${importProgress?.total ?? validRows.length}…`;
  }

  return (
    <ModalDialog onClose={importing ? () => {} : onClose}>
      <div className="relative z-10 w-full max-w-4xl rounded-md border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Upload size={18} className="text-primary" /> Import Sales
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {showImportConfirm && !importing && (
          <div className="mb-4 p-4 rounded-md border border-primary/30 bg-primary/5 text-sm">
            <p className="font-semibold text-foreground">
              Import {validRows.length} sale{validRows.length === 1 ? '' : 's'} from this file?
            </p>
            <p className="text-muted-foreground mt-1">
              Large files are imported in batches of 50 so no rows are skipped. This may take a few minutes.
            </p>
          </div>
        )}

        {importing && importProgress && (
          <div className="mb-4 p-4 rounded-md border bg-muted/20">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Importing sales…</span>
              <span className="text-muted-foreground">
                {importProgress.processed} / {importProgress.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {importProgress.imported} imported, {importProgress.failed} failed so far
            </p>
          </div>
        )}

        {importResult && failedResults.length > 0 && (
          <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 text-sm">
            <p className="font-medium text-orange-800 mb-2">
              {importResult.failed_so_far} row(s) failed to import
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-orange-800">
              {failedResults.slice(0, 20).map((r) => (
                <p key={`fail-${r.lineNo}`}>
                  Row {r.lineNo}: {r.error ?? 'Unknown error'}
                </p>
              ))}
              {failedResults.length > 20 && (
                <p className="italic">…and {failedResults.length - 20} more</p>
              )}
            </div>
          </div>
        )}

        {hasInvalid && (
          <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 text-sm">
            <p className="font-medium text-orange-800 mb-1">
              {summary?.invalid} row(s) have validation errors and will be skipped.
            </p>
            <button
              type="button"
              onClick={() => onDownloadTemplate(freshTemplateType)}
              className="text-orange-800 underline text-xs flex items-center gap-1 mt-1 hover:text-orange-900"
            >
              <Download size={12} /> Download a fresh template
            </button>
          </div>
        )}

        <div className="mb-4 p-3 rounded-md border bg-muted/20 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Excel template columns:</p>
          {allCustom ? (
            <>
              <p><strong>Custom template:</strong> product_description + amount required.</p>
              <p>Custom product rows never deduct stock, regardless of sale date.</p>
            </>
          ) : (
            <>
              <p><strong>Live (today+):</strong> product_name + quantity required; stock is deducted.</p>
              <p><strong>Historical (before today):</strong> amount required; product optional free text; no stock impact.</p>
            </>
          )}
          <p className="mt-2">Each upload supports up to <strong>500 data rows</strong>. Re-download the template if dropdowns stop after row 501.</p>
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
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">Customer</th>
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">Hub</th>
                    <th className="h-8 px-3 text-left font-medium text-muted-foreground">Product</th>
                    <th className="h-8 px-3 text-center font-medium text-muted-foreground">Type</th>
                    <th className="h-8 px-3 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="h-8 px-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="h-8 px-3 text-center font-medium text-muted-foreground">Hist.</th>
                    <th className="h-8 px-3 text-center font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewRows.map((row) => (
                    <tr
                      key={`import-row-${row.lineNo}`}
                      className={row.valid ? 'hover:bg-muted/30' : 'bg-orange-50/50'}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{row.lineNo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.date_sold}</td>
                      <td className="px-3 py-2 font-medium">{row.customer_name}</td>
                      <td className="px-3 py-2">{row.hub_name}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]" title={row.product_description || row.product_name}>
                        {row.product_description || row.product_name || '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.import_mode === 'custom' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {row.import_mode === 'custom' ? 'Custom' : 'Catalog'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{row.quantity || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {row.amount === undefined ? '—' : fmt(row.amount)}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px]">
                        {row.historical ? 'Yes' : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.valid ? (
                          <Check size={14} className="text-green-600 mx-auto" />
                        ) : (
                          <span title={row.errors.join('; ')} className="inline-flex items-center justify-center">
                            <AlertCircle size={14} className="text-orange-600" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasInvalid && (
          <div className="mb-4 max-h-24 overflow-y-auto space-y-1 text-xs text-orange-700">
            {previewRows
              .filter((r) => !r.valid)
              .slice(0, 10)
              .map((r) => (
                <p key={`err-${r.lineNo}`}>
                  Row {r.lineNo}: {r.errors.join('; ')}
                </p>
              ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          {showImportConfirm && !importing ? (
            <button type="button" onClick={onCancelConfirm} className={BTN_SECONDARY}>
              Back
            </button>
          ) : (
            <button type="button" onClick={onClose} disabled={importing} className={BTN_SECONDARY}>
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={validRows.length === 0 || importing || validating}
            className={`${BTN_PRIMARY} disabled:opacity-50 inline-flex items-center`}
          >
            {importing && <Loader2 size={16} className="mr-2 animate-spin" />}
            {importButtonLabel}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

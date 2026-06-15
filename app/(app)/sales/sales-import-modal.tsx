'use client';

import { Upload, X, Check, AlertCircle, Download } from 'lucide-react';
import type { SalesImportPreviewRow } from '@/types/api';
import { fmt, BTN_PRIMARY, BTN_SECONDARY } from '../sales/sales-utils';
import { ModalDialog } from '../sales/modal-dialog';

export interface SalesImportModalProps {
  show: boolean;
  onClose: () => void;
  previewRows: SalesImportPreviewRow[];
  summary: { total: number; valid: number; invalid: number } | null;
  importing: boolean;
  validating: boolean;
  onConfirm: () => void;
  onDownloadTemplate: () => void;
}

export function SalesImportModal({
  show,
  onClose,
  previewRows,
  summary,
  importing,
  validating,
  onConfirm,
  onDownloadTemplate,
}: Readonly<SalesImportModalProps>) {
  if (!show) return null;

  const validRows = previewRows.filter((r) => r.valid);
  const hasInvalid = (summary?.invalid ?? 0) > 0;

  let subtitle = `${previewRows.length} rows`;
  if (validating) subtitle = 'Validating workbook…';
  else if (summary) {
    subtitle = `${summary.total} rows — ${summary.valid} valid, ${summary.invalid} with errors`;
  }

  const importButtonLabel = importing
    ? 'Importing…'
    : `Import ${validRows.length} Sale${validRows.length === 1 ? '' : 's'}`;

  return (
    <ModalDialog onClose={onClose}>
      <div className="relative z-10 w-full max-w-4xl rounded-md border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Upload size={18} className="text-primary" /> Import Sales
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {hasInvalid && (
          <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 text-sm">
            <p className="font-medium text-orange-800 mb-1">
              {summary?.invalid} row(s) have validation errors and will be skipped.
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
          <p className="font-medium text-foreground mb-1">Excel template columns:</p>
          <p><strong>Live (today+):</strong> product_name + quantity required; stock is deducted.</p>
          <p><strong>Historical (before today):</strong> amount required; product optional free text; no stock impact.</p>
        </div>

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
                    <th className="h-8 px-3 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="h-8 px-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="h-8 px-3 text-center font-medium text-muted-foreground">Hist.</th>
                    <th className="h-8 px-3 text-center font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewRows.slice(0, 50).map((row) => (
                    <tr
                      key={`import-row-${row.lineNo}`}
                      className={row.valid ? 'hover:bg-muted/30' : 'bg-orange-50/50'}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{row.lineNo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.date_sold}</td>
                      <td className="px-3 py-2 font-medium">{row.customer_name}</td>
                      <td className="px-3 py-2">{row.hub_name}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]" title={row.product_name}>
                        {row.product_name || '—'}
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
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={validRows.length === 0 || importing || validating}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            {importButtonLabel}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

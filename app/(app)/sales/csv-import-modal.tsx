'use client';

import { Upload, X, Check } from 'lucide-react';
import { Customer } from '@/types';
import { fmt, BTN_PRIMARY, BTN_SECONDARY, type CsvPreviewRow } from './sales-utils';
import { ModalDialog } from './modal-dialog';

export interface CsvImportModalProps {
  show: boolean;
  onClose: () => void;
  csvPreview: CsvPreviewRow[];
  csvErrors: string[];
  importing: boolean;
  customers: Customer[];
  onConfirm: () => void;
}

export function CsvImportModal({
  show,
  onClose,
  csvPreview,
  csvErrors,
  importing,
  customers,
  onConfirm,
}: Readonly<CsvImportModalProps>) {
  if (!show) return null;

  return (
    <ModalDialog onClose={onClose}>
      <div className="relative z-10 w-full max-w-3xl rounded-md border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2"><Upload size={18} className="text-primary" /> Import Historical Sales</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{csvPreview.length} rows parsed from CSV</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        {csvErrors.length > 0 && (
          <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 text-sm">
            <p className="font-medium text-orange-800 mb-1">Warnings ({csvErrors.length}):</p>
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {csvErrors.map((err) => <p key={err} className="text-orange-700 text-xs">{err}</p>)}
            </div>
          </div>
        )}

        {/* Required format hint */}
        <div className="mb-4 p-3 rounded-md border bg-muted/20 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Expected CSV columns:</p>
          <p><strong>Required:</strong> date, customer, amount</p>
          <p><strong>Optional:</strong> product, agent, margin %, status, channel, delivery, payment terms, credit, notes</p>
          <p className="mt-1">Customer names are auto-matched to existing records. Unmatched names will import with &quot;unknown&quot; customer ID.</p>
        </div>

        {/* Preview table */}
        {csvPreview.length > 0 && (
          <div className="rounded-md border overflow-hidden mb-4">
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b sticky top-0"><tr>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground">#</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="h-8 px-3 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground">Product</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground">Agent</th>
                  <th className="h-8 px-3 text-center font-medium text-muted-foreground">Match</th>
                </tr></thead>
                <tbody className="divide-y">
                  {csvPreview.slice(0, 50).map((row) => {
                    const matched = customers.find((c) => c.name.toLowerCase() === String(row.customer || '').toLowerCase());
                    return (
                      <tr key={`csv-row-${row.lineNo}`} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{row.lineNo - 1}</td>
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2 font-medium">{row.customer}</td>
                        <td className="px-3 py-2 text-right">{fmt(Number(row.amount) || 0)}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{row.product || row.products || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.agent || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {matched ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-orange-500 text-[10px] font-medium">NEW</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {csvPreview.length > 50 && <p className="p-2 text-xs text-muted-foreground text-center border-t">Showing first 50 of {csvPreview.length} rows</p>}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={csvPreview.length === 0 || importing} className={`${BTN_PRIMARY} disabled:opacity-50`}>
            {importing ? 'Importing...' : `Import ${csvPreview.length} Sales`}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

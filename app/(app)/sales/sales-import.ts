import { axiosGetBlob, axiosPost, axiosPostForm } from '@/lib/api';
import { requireApi } from '@/lib/require-api';
import type {
  ApiBulkImportSaleRow,
  ApiListResponse,
  SalesImportResult,
  SalesImportValidateResponse,
} from '@/types/api';

export async function downloadImportTemplate() {
  requireApi();
  const buffer = await axiosGetBlob('sales/import/template', true);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sales-import-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export async function validateImportFile(file: File) {
  requireApi();
  const form = new FormData();
  form.append('file', file);
  const res = (await axiosPostForm('sales/import/validate', form, true)) as ApiListResponse<SalesImportValidateResponse>;
  return res.data;
}

export async function confirmImport(rows: ApiBulkImportSaleRow[]) {
  requireApi();
  const res = (await axiosPost('sales/import', { rows }, true)) as ApiListResponse<SalesImportResult>;
  return res.data;
}

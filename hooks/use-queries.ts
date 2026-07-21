'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StorageService } from '../lib/storage-service';
import {
  Customer, Sale, Feedback, Compensation,
  Enquiry, Agent, Task, InventoryItem, StockLog,
  CreditRecord, AuditLog, Hub, Supplier, SupplierIssue,
} from '../types';

// --- Hubs ---
export function useHubs() {
  return useQuery({ queryKey: ['hubs'], queryFn: () => StorageService.getHubs() });
}
export function useSaveHubs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Hub[]) => { StorageService.saveHubs(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hubs'] }),
  });
}

// --- Customers ---
export function useCustomers() {
  return useQuery({ queryKey: ['customers'], queryFn: () => StorageService.getCustomers() });
}
export function useSaveCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Customer[]) => { StorageService.saveCustomers(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}


// --- Sales ---
export function useSales() {
  return useQuery({ queryKey: ['sales'], queryFn: () => StorageService.getSales() });
}
export function useSaveSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Sale[]) => { StorageService.saveSales(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}

// --- Feedback ---
export function useFeedback() {
  return useQuery({ queryKey: ['feedback'], queryFn: () => StorageService.getFeedback() });
}
export function useSaveFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Feedback[]) => { StorageService.saveFeedback(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

// --- Compensations ---
export function useCompensations() {
  return useQuery({ queryKey: ['compensations'], queryFn: () => StorageService.getCompensations() });
}
export function useSaveCompensations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Compensation[]) => { StorageService.saveCompensations(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compensations'] }),
  });
}

// --- Enquiries ---
export function useEnquiries() {
  return useQuery({ queryKey: ['enquiries'], queryFn: () => StorageService.getEnquiries() });
}
export function useSaveEnquiries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Enquiry[]) => { StorageService.saveEnquiries(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  });
}

// --- Agents ---
export function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: () => StorageService.getAgents() });
}
export function useSaveAgents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Agent[]) => { StorageService.saveAgents(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

// --- Tasks ---
export function useTasks() {
  return useQuery({ queryKey: ['tasks'], queryFn: () => StorageService.getTasks() });
}
export function useSaveTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Task[]) => { StorageService.saveTasks(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// --- Inventory ---
export function useInventory() {
  return useQuery({ queryKey: ['inventory'], queryFn: () => StorageService.getInventory() });
}
export function useSaveInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: InventoryItem[]) => { StorageService.saveInventory(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

// --- Stock Logs ---
export function useStockLogs() {
  return useQuery({ queryKey: ['stockLogs'], queryFn: () => StorageService.getStockLogs() });
}
export function useSaveStockLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: StockLog[]) => { StorageService.saveStockLogs(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stockLogs'] }),
  });
}

// --- Credits ---
export function useCredits() {
  return useQuery({ queryKey: ['credits'], queryFn: () => StorageService.getCredits() });
}
export function useSaveCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: CreditRecord[]) => { StorageService.saveCredits(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credits'] }),
  });
}

// --- Audit Logs ---
export function useAuditLogs() {
  return useQuery({ queryKey: ['auditLogs'], queryFn: () => StorageService.getAuditLogs() });
}

// --- Suppliers ---
export function useSuppliers() {
  return useQuery({ queryKey: ['suppliers'], queryFn: () => StorageService.getSuppliers() });
}
export function useSaveSuppliers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Supplier[]) => { StorageService.saveSuppliers(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

// --- Supplier Issues ---
export function useSupplierIssues() {
  return useQuery({ queryKey: ['supplierIssues'], queryFn: () => StorageService.getSupplierIssues() });
}
export function useSaveSupplierIssues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: SupplierIssue[]) => { StorageService.saveSupplierIssues(items); return items; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplierIssues'] }),
  });
}

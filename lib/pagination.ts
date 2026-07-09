export type PaginationCell = number | 'ellipsis';

export function buildPaginationCells(
  page: number,
  totalPages: number,
  siblingCount = 1,
  boundaryCount = 1,
): PaginationCell[] {
  if (totalPages <= 0) return [];

  const current = Math.min(Math.max(page, 1), totalPages);
  const pages = new Set<number>();

  for (let i = 1; i <= Math.min(boundaryCount, totalPages); i += 1) {
    pages.add(i);
  }

  for (
    let i = Math.max(totalPages - boundaryCount + 1, 1);
    i <= totalPages;
    i += 1
  ) {
    pages.add(i);
  }

  for (
    let i = Math.max(current - siblingCount, 1);
    i <= Math.min(current + siblingCount, totalPages);
    i += 1
  ) {
    pages.add(i);
  }

  const ordered = [...pages].sort((a, b) => a - b);
  const cells: PaginationCell[] = [];
  let prev: number | null = null;

  for (const p of ordered) {
    if (prev !== null) {
      const gap = p - prev;
      if (gap === 2) {
        cells.push(prev + 1);
      } else if (gap > 2) {
        cells.push('ellipsis');
      }
    }
    cells.push(p);
    prev = p;
  }

  return cells;
}

"use client";

import { useState, useMemo, useCallback } from "react";

// ============================================================
// usePagination — client-side pagination logic
// ============================================================
export function usePagination<T>(items: T[], pageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to page 1 if items change and current page is out of bounds
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage: safePage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    resetPage,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
    startIndex: (safePage - 1) * pageSize + 1,
    endIndex: Math.min(safePage * pageSize, items.length),
    totalItems: items.length,
  } as const;
}

// ============================================================
// useSorting — column sorting logic
// ============================================================
export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useSorting<T>(items: T[], defaultSort?: SortConfig) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    defaultSort || { key: "", direction: null },
  );

  const toggleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: "", direction: null };
      return { key, direction: "asc" };
    });
  }, []);

  const sortedItems = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return items;

    return [...items].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortConfig.key];
      const bVal = (b as Record<string, unknown>)[sortConfig.key];

      // Handle nulls
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric comparison (handles currency strings like "£1,234")
      const aNum =
        typeof aVal === "number"
          ? aVal
          : parseFloat(String(aVal).replace(/[£$,]/g, ""));
      const bNum =
        typeof bVal === "number"
          ? bVal
          : parseFloat(String(bVal).replace(/[£$,]/g, ""));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [items, sortConfig]);

  const getSortDirection = useCallback(
    (key: string): SortDirection => {
      return sortConfig.key === key ? sortConfig.direction : null;
    },
    [sortConfig],
  );

  const clearSort = useCallback(() => {
    setSortConfig({ key: "", direction: null });
  }, []);

  return {
    sortedItems,
    sortConfig,
    toggleSort,
    getSortDirection,
    clearSort,
  } as const;
}

// ============================================================
// useFilteredSortedPaginated — combines search + sort + pagination
// ============================================================
export function useFilteredSortedPaginated<T>(
  items: T[],
  searchFn: (item: T, query: string) => boolean,
  pageSize = 10,
  defaultSort?: SortConfig,
) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter((item) => searchFn(item, searchQuery.toLowerCase()));
  }, [items, searchQuery, searchFn]);

  const { sortedItems, sortConfig, toggleSort, getSortDirection, clearSort } =
    useSorting(filtered, defaultSort);

  const pagination = usePagination(sortedItems, pageSize);

  // Reset to page 1 when search changes
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      pagination.resetPage();
    },
    [pagination],
  );

  return {
    // Search
    searchQuery,
    setSearchQuery: handleSearch,
    // Sorting
    sortConfig,
    toggleSort,
    getSortDirection,
    clearSort,
    // Pagination
    ...pagination,
    // Derived
    filteredCount: filtered.length,
    totalCount: items.length,
  } as const;
}

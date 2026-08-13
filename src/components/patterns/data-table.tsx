"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  sortable?: boolean
  sortValue?: (row: T) => string | number | null | undefined
  className?: string
  hideOnMobile?: boolean
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
  onRowClick,
  selectable,
  selectedIds,
  onSelectedIdsChange,
  className,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  empty?: ReactNode
  onRowClick?: (row: T) => void
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectedIdsChange?: (next: Set<string>) => void
  className?: string
}) {
  const [sortId, setSortId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const sorted = useMemo(() => {
    if (!sortId) return rows
    const col = columns.find((c) => c.id === sortId)
    if (!col?.sortValue) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return copy
  }, [rows, columns, sortId, sortDir])

  const allSelected = selectable && rows.length > 0 && selectedIds?.size === rows.length

  function toggleSort(id: string) {
    if (sortId === id) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortId(id)
      setSortDir("asc")
    }
  }

  function toggleAll() {
    if (!onSelectedIdsChange) return
    if (allSelected) onSelectedIdsChange(new Set())
    else onSelectedIdsChange(new Set(rows.map((r) => r.id)))
  }

  function toggleOne(id: string) {
    if (!onSelectedIdsChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedIdsChange(next)
  }

  if (rows.length === 0 && empty) return <>{empty}</>

  return (
    <div className={cn("overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]", className)}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <TableRow>
            {selectable ? (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={Boolean(allSelected)}
                  onChange={toggleAll}
                  className="size-3.5 accent-primary"
                />
              </TableHead>
            ) : null}
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  col.hideOnMobile && "hidden md:table-cell",
                  col.className,
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort(col.id)}
                  >
                    {col.header}
                    {sortId === col.id ? (sortDir === "asc" ? " ↑" : " ↓") : null}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={row.id}
              className={cn(onRowClick && "cursor-pointer")}
              onClick={() => onRowClick?.(row)}
              data-state={selectedIds?.has(row.id) ? "selected" : undefined}
            >
              {selectable ? (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label="Select row"
                    checked={Boolean(selectedIds?.has(row.id))}
                    onChange={() => toggleOne(row.id)}
                    className="size-3.5 accent-primary"
                  />
                </TableCell>
              ) : null}
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(col.hideOnMobile && "hidden md:table-cell", col.className)}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

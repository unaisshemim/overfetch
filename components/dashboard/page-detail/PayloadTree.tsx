import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FieldUsage, PayloadTreeNode } from './types';

interface PayloadTreeProps {
  nodes: PayloadTreeNode[];
  selectedPath: string | null;
  onSelect: (node: PayloadTreeNode) => void;
}

function usageClasses(usage: FieldUsage): string {
  if (usage === 'used') return 'text-of-used';
  if (usage === 'unused') return 'text-of-waste';
  return 'text-of-muted';
}

function nodeMatchesQuery(node: PayloadTreeNode, query: string): boolean {
  if (node.key.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)) {
    return true;
  }
  return node.children.some((child) => nodeMatchesQuery(child, query));
}

function filterNodes(nodes: PayloadTreeNode[], query: string): PayloadTreeNode[] {
  if (!query) return nodes;
  return nodes
    .filter((node) => nodeMatchesQuery(node, query))
    .map((node) => ({
      ...node,
      children: filterNodes(node.children, query),
    }));
}

function TreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
  defaultOpen,
}: {
  node: PayloadTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: PayloadTreeNode) => void;
  defaultOpen?: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(defaultOpen ?? depth < 3);
  const selected = selectedPath === node.path;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node);
          if (hasChildren) setOpen((v) => !v);
        }}
        className={`flex w-full items-center gap-1 rounded-md px-2 py-1 text-left font-mono text-xs transition ${
          selected ? 'bg-of-purple-light/80 text-of-purple-dark' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-of-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-of-muted" />
          )
        ) : (
          <span className="inline-block w-3.5 shrink-0" />
        )}
        <span className={`truncate font-medium ${usageClasses(node.usage)}`}>{node.key}</span>
        <span className="ml-auto shrink-0 text-[10px] uppercase text-of-muted">{node.type}</span>
      </button>
      {hasChildren && open
        ? node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              defaultOpen={defaultOpen}
            />
          ))
        : null}
    </div>
  );
}

export function PayloadTree({ nodes, selectedPath, onSelect }: PayloadTreeProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => filterNodes(nodes, query.trim().toLowerCase()),
    [nodes, query],
  );

  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-xl border border-of-border bg-white shadow-sm">
      <div className="border-b border-of-border/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Payload Structure</h3>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-of-border bg-of-surface px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-of-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields…"
            className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-of-muted">
            {nodes.length === 0
              ? 'No payload structure available for this page yet.'
              : 'No fields match your search.'}
          </p>
        ) : (
          filtered.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              defaultOpen
            />
          ))
        )}
      </div>
    </div>
  );
}

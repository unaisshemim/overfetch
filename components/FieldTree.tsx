interface FieldTreeProps {
  tree: Record<string, unknown>;
  variant?: 'used' | 'unused';
}

function TreeNode({
  name,
  node,
  depth,
  variant,
}: {
  name: string;
  node: unknown;
  depth: number;
  variant: 'used' | 'unused';
}) {
  const isLeaf =
    typeof node !== 'object' || node === null || Object.keys(node).length === 0;
  const color =
    variant === 'used' ? 'text-of-used' : 'text-of-waste';

  if (isLeaf) {
    return (
      <div
        className="flex items-center gap-1.5 py-0.5 font-mono text-xs"
        style={{ paddingLeft: depth * 14 }}
      >
        <span className={`${color} opacity-70`}>•</span>
        <span className="text-gray-700">{name}</span>
      </div>
    );
  }

  const children = node as Record<string, unknown>;
  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-0.5 font-mono text-xs font-medium text-gray-800"
        style={{ paddingLeft: depth * 14 }}
      >
        <span className={`${color} opacity-70`}>▸</span>
        <span>{name}</span>
      </div>
      {Object.entries(children).map(([key, child]) => (
        <TreeNode
          key={`${name}.${key}`}
          name={key}
          node={child}
          depth={depth + 1}
          variant={variant}
        />
      ))}
    </div>
  );
}

export function FieldTree({ tree, variant = 'unused' }: FieldTreeProps) {
  const entries = Object.entries(tree);
  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-of-muted">No fields to display</p>
    );
  }
  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-of-border bg-of-surface p-2">
      {entries.map(([key, node]) => (
        <TreeNode key={key} name={key} node={node} depth={0} variant={variant} />
      ))}
    </div>
  );
}

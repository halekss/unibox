// Sidebar folder tree, built from the flat folder list (display names like "Epitech/Stages").
export type Folder = { path: string; name: string; n: number; provs: Set<string>; children: Map<string, Folder> };

// "Epitech/Stages" becomes a child of "Epitech"; a parent that only exists through its children still gets a node.
// Counts and O/G badges of a parent cover its whole subtree.
export function folderTree(list: { f: string; provs: string[]; n: number }[]): Folder {
  const root: Folder = { path: "", name: "", n: 0, provs: new Set(), children: new Map() };
  for (const { f, provs, n } of list) {
    let node = root;
    for (const name of f.split("/")) {
      const path = node.path ? `${node.path}/${name}` : name;
      if (!node.children.has(name)) node.children.set(name, { path, name, n: 0, provs: new Set(), children: new Map() });
      node = node.children.get(name)!;
      node.n += n;
      provs.forEach((p) => node.provs.add(p));
    }
  }
  return root;
}

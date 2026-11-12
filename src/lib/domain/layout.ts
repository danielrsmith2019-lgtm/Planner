import { DEFAULT_DURATION_MIN } from "./alignment";

/**
 * Timeline layout (blueprint Section 3, "Rich interactions"): overlapping
 * blocks render side by side. A simple interval-packing pass:
 *
 * 1. Sort by start (longer first on ties, so the long block takes column 0).
 * 2. Walk the blocks, grouping each run of transitively overlapping blocks
 *    into a cluster.
 * 3. In a cluster, each block takes the first column whose last block has
 *    ended; columns = how many columns that cluster needed.
 *
 * Overlaps aren't prevented; real days overlap. Touching blocks (one ends at
 * 10:00, the next starts at 10:00) don't overlap.
 */

export type TimedBlock = { id: string; startMin: number; durationMin: number | null };

export type PackedBlock<T extends TimedBlock> = {
  task: T;
  /** 0-based column within its overlap cluster. */
  column: number;
  /** Columns in that cluster; the block's width is 1 / columns. */
  columns: number;
  startMin: number;
  endMin: number;
};

/** Minutes a block occupies; tasks without a duration use the schema default. */
export function blockEnd(block: TimedBlock): number {
  const duration = block.durationMin !== null && block.durationMin > 0 ? block.durationMin : DEFAULT_DURATION_MIN;
  return block.startMin + duration;
}

export function packOverlaps<T extends TimedBlock>(tasks: readonly T[]): PackedBlock<T>[] {
  const sorted = [...tasks].sort((a, b) => a.startMin - b.startMin || blockEnd(b) - blockEnd(a) || (a.id < b.id ? -1 : 1));
  const result: PackedBlock<T>[] = [];

  let cluster: PackedBlock<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    for (const block of cluster) block.columns = columnEnds.length;
    result.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const task of sorted) {
    const startMin = task.startMin;
    const endMin = blockEnd(task);
    if (startMin >= clusterEnd && cluster.length > 0) closeCluster();

    let column = columnEnds.findIndex((end) => end <= startMin);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(endMin);
    } else {
      columnEnds[column] = endMin;
    }
    cluster.push({ task, column, columns: 1, startMin, endMin });
    clusterEnd = cluster.length === 1 ? endMin : Math.max(clusterEnd, endMin);
  }
  if (cluster.length > 0) closeCluster();
  return result;
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const patterns = [
  ["Arrays & Hashing", "Frequency maps, sets, and array transformations."],
  ["Two Pointers", "Coordinate two indices to scan or partition data."],
  ["Sliding Window", "Maintain a moving range with an invariant."],
  ["Fast & Slow Pointers", "Cycle detection and linked-list midpoint techniques."],
  ["Stack & Monotonic Stack", "Use LIFO state and monotonic invariants."],
  ["Binary Search", "Search ordered domains or monotonic answers."],
  ["Linked Lists", "Pointer manipulation, reversal, and merging."],
  ["Trees", "DFS, BFS, and tree property reasoning."],
  ["Tries", "Prefix lookup and bitwise trie techniques."],
  ["Backtracking", "Enumerate candidates with choose-explore-unchoose."],
  ["Heap / Top K", "Priority queues for best-first and bounded selection."],
  ["Intervals & Greedy", "Sort intervals and make locally optimal choices."],
  ["Graphs", "Traversal, connectivity, shortest paths, and ordering."],
  ["Dynamic Programming", "Reuse overlapping subproblem results."],
  ["Bit Manipulation", "Masks, XOR, and binary arithmetic."],
  ["Math & Geometry", "Number theory, coordinates, and simulation."],
  ["Union Find", "Disjoint-set connectivity with path compression."]
] as const;

async function main() {
  await Promise.all(patterns.map(([name, description]) => prisma.pattern.upsert({
    where: { name }, update: { description }, create: { name, description },
  })));
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

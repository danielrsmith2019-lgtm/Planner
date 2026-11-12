import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { DayData, DayTask } from "@/lib/domain/goal-tree";
import { queryKeys } from "@/queries/keys";
import type { CompletionResult } from "@/services/tasks";
import {
  completionMutationKey,
  createCompletionHandlers,
  type CompletionContext,
  type CompletionVariables,
  type RunCompletion,
} from "./completion-handlers";

// The real runner calls Server Actions; every test passes its own.
vi.mock("@/actions/tasks", () => ({ completeTaskAction: vi.fn(), uncompleteTaskAction: vi.fn() }));

const DATE = "2026-11-12";
const NOW = new Date("2026-11-12T16:00:00Z");

const task = (id: string, milestoneId: string): DayTask => ({
  id,
  goalId: "g1",
  milestoneId,
  title: id,
  notes: null,
  status: "TODO",
  isTopThree: false,
  scheduledDate: DATE,
  startMin: null,
  durationMin: null,
  contribution: null,
  rank: id,
  carryCount: 0,
  completedAt: null,
});

// Goal with two weight-1 milestones, each with two TODO tasks.
const day = (): DayData => ({
  date: DATE,
  tasks: [task("a1", "m1"), task("a2", "m1"), task("b1", "m2")],
  goalTree: [
    {
      id: "g1",
      title: "Goal",
      color: "#34C759",
      status: "ACTIVE",
      progressMode: "MILESTONES",
      metricUnit: null,
      metricTarget: null,
      metricCurrent: 0,
      progress: 0,
      milestones: [
        { id: "m1", title: "M1", status: "OPEN", weight: 1, progress: 0, counts: { todo: 2, done: 0, skipped: 0 } },
        { id: "m2", title: "M2", status: "OPEN", weight: 1, progress: 0, counts: { todo: 2, done: 0, skipped: 0 } },
      ],
    },
  ],
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(run: RunCompletion) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.day(DATE), day());
  // Stands in for the server refetch that invalidation triggers.
  const refetch = vi.fn(async () => day());
  client.setQueryDefaults(queryKeys.day(DATE), { queryFn: refetch, staleTime: Infinity });
  // An active observer, like the /debug page, so invalidation refetches.
  new QueryObserver(client, { queryKey: queryKeys.day(DATE) }).subscribe(() => {});
  const handlers = createCompletionHandlers(client, DATE, run, () => NOW);
  const mutate = (variables: CompletionVariables) => {
    const observer = new MutationObserver<CompletionResult, Error, CompletionVariables, CompletionContext>(client, {
      mutationKey: completionMutationKey(DATE),
      mutationFn: handlers.mutationFn,
      onMutate: (v) => handlers.onMutate(v),
      onError: (e, v, c) => handlers.onError(e, v, c),
      onSettled: (d) => handlers.onSettled(d),
    });
    return observer.mutate(variables).catch(() => undefined);
  };
  const cached = () => client.getQueryData<DayData>(queryKeys.day(DATE));
  return { client, mutate, cached, refetch };
}

const goalProgress = (d: DayData | undefined) => d?.goalTree[0].progress;

describe("optimistic completion", () => {
  it("updates the cache before the server answers, then reconciles", async () => {
    const server = deferred<CompletionResult>();
    const s = setup(() => server.promise);
    const pending = s.mutate({ taskId: "a1", direction: "complete" });
    await vi.waitFor(() => expect(s.cached()?.tasks[0].status).toBe("DONE"));
    // m1: 1 of 2 done -> 0.5; goal: (0.5 + 0) / 2.
    expect(goalProgress(s.cached())).toBe(0.25);

    const optimistic = s.cached();
    if (optimistic === undefined) throw new Error("no cache");
    server.resolve({
      task: { ...optimistic.tasks[0] },
      milestone: { id: "m1", goalId: "g1", title: "M1", status: "OPEN", weight: 1, progress: 0.5, targetDate: null, rank: "a", completedAt: null },
      goal: {
        id: "g1", title: "Goal", why: null, color: "#34C759", status: "ACTIVE", progressMode: "MILESTONES",
        metricUnit: null, metricTarget: null, metricCurrent: 0, progress: 0.25, startDate: DATE, targetDate: null,
        rank: "a", completedAt: null,
      },
      delta: 0.25,
      changed: true,
    });
    await pending;
    expect(s.refetch).toHaveBeenCalledTimes(1);
  });

  it("restores the snapshot when the server fails", async () => {
    const s = setup(async () => {
      throw new Error("boom");
    });
    await s.mutate({ taskId: "a1", direction: "complete" });
    expect(s.cached()).toEqual(day());
  });

  it("undoes only the failed completion when another one is still in flight", async () => {
    const first = deferred<CompletionResult>();
    const second = deferred<CompletionResult>();
    const runs = [first, second];
    const s = setup(() => {
      const next = runs.shift();
      if (next === undefined) throw new Error("unexpected call");
      return next.promise;
    });

    const p1 = s.mutate({ taskId: "a1", direction: "complete" });
    await vi.waitFor(() => expect(s.cached()?.tasks[0].status).toBe("DONE"));
    const p2 = s.mutate({ taskId: "b1", direction: "complete" });
    await vi.waitFor(() => expect(s.cached()?.tasks[2].status).toBe("DONE"));
    expect(goalProgress(s.cached())).toBe(0.5);

    first.reject(new Error("boom"));
    await p1;
    // a1 is rolled back, b1's optimistic change survives, no refetch yet.
    expect(s.cached()?.tasks.map((t) => t.status)).toEqual(["TODO", "TODO", "DONE"]);
    expect(goalProgress(s.cached())).toBe(0.25);
    expect(s.refetch).not.toHaveBeenCalled();

    second.reject(new Error("boom"));
    await p2;
    expect(s.cached()).toEqual(day());
  });
});

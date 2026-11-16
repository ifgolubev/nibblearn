import { waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
import type { ModuleState } from "@nibblearn/core";

/** The latest snapshot passed to an `onStateChange` mock (snapshots are sent in a microtask). */
export async function latestState(onStateChange: Mock): Promise<ModuleState> {
  await waitFor(() => expect(onStateChange).toHaveBeenCalled());
  // Let any pending microtask flush the final snapshot.
  await new Promise((r) => setTimeout(r, 0));
  const state = onStateChange.mock.calls.at(-1)![0] as ModuleState;
  // Snapshots must survive a JSON round trip (they are stored as JSON).
  return JSON.parse(JSON.stringify(state)) as ModuleState;
}

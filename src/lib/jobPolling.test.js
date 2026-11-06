import { waitForJob, STALL_MS } from "./jobPolling";
import { authFetch } from "./api";

jest.mock("./api", () => ({ authFetch: jest.fn() }));

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
const job = (status, progress, ageMs = 0) => json(200, { status, progress, updated_at: new Date(Date.now() - ageMs).toISOString() });

beforeEach(() => authFetch.mockReset());

test("reports progress and resolves on completion", async () => {
  authFetch.mockResolvedValueOnce(job("pending", 0)).mockResolvedValueOnce(job("running", 42)).mockResolvedValueOnce(job("completed", 100));
  const seen = [];
  await expect(waitForJob("j", { interval: 1, onProgress: p => seen.push(p) })).resolves.toBe("completed");
  expect(seen).toEqual([42]);
});

test("survives a few failed checks", async () => {
  authFetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(json(503, {})).mockResolvedValueOnce(job("failed", 0));
  await expect(waitForJob("j", { interval: 1 })).resolves.toBe("failed");
});

test("gives up after five failed checks in a row", async () => {
  authFetch.mockResolvedValue(json(502, {}));
  await expect(waitForJob("j", { interval: 1 })).rejects.toThrow(/Lost contact/);
});

test("a stalled job is retired and reported", async () => {
  authFetch.mockResolvedValueOnce(job("running", 10, STALL_MS + 1000)).mockResolvedValueOnce(json(200, {}));
  await expect(waitForJob("j", { interval: 1 })).rejects.toThrow(/stopped responding/);
  const [url, opts] = authFetch.mock.calls[1];
  expect(url).toMatch(/\/jobs\/update\/j$/);
  expect(JSON.parse(opts.body)).toEqual({ status: "failed", deprecated: true });
});

test("a missing job stops at once", async () => {
  authFetch.mockResolvedValue(json(404, {}));
  await expect(waitForJob("j", { interval: 1 })).rejects.toThrow(/no longer exists/);
  expect(authFetch).toHaveBeenCalledTimes(1);
});

test("stops when cancelled", async () => {
  let gone = false;
  authFetch.mockImplementation(async () => { gone = true; return job("running", 5); });
  await expect(waitForJob("j", { interval: 1, isCancelled: () => gone })).resolves.toBe("cancelled");
});

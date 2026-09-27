import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDevice } from "../features/settings/profile/device";

test("sessions are described by system and browser", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0";
  assert.deepEqual(describeDevice(mac), { label: "Mac · Chrome", mobile: false });
  assert.deepEqual(describeDevice(iphone), { label: "iPhone · Safari", mobile: true });
  assert.equal(describeDevice(edge).label, "Windows · Edge");
  assert.equal(describeDevice("curl/8.0").label, "Unknown device");
  assert.equal(describeDevice(null).label, "Unknown device");
});

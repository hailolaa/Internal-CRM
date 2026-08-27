import assert from "node:assert/strict";
import test from "node:test";
import { validationResult } from "express-validator";
import { startProposalDiscoverySessionValidator } from "../modules/proposals/proposal-discovery.validators.js";

async function validate(body: Record<string, unknown>) {
  const request = { body, params: {}, query: {} } as any;
  for (const validator of startProposalDiscoverySessionValidator) {
    await validator.run(request);
  }
  return validationResult(request);
}

test("proposal discovery session creation requires an explicit boolean confirmation", async () => {
  for (const body of [{}, { confirmStart: false }, { confirmStart: "true" }]) {
    const result = await validate(body);
    assert.equal(result.isEmpty(), false);
    assert.match(result.array()[0]?.msg || "", /explicit confirmation/i);
  }

  const confirmed = await validate({ confirmStart: true });
  assert.equal(confirmed.isEmpty(), true);
});

import assert from "node:assert/strict";

import {
  inspectReceiptExecution,
  matchStateChanged,
} from "../../src/transaction-reconciliation";

function testConsensusChainReceipt(): void {
  assert.deepEqual(
    inspectReceiptExecution({txExecutionResultName: "FINISHED_WITH_RETURN"}),
    {outcome: "success"},
  );
  assert.equal(
    inspectReceiptExecution({txExecutionResultName: "FINISHED_WITH_ERROR"}).outcome,
    "failure",
  );
}

function testStudionetLeaderReceipt(): void {
  const receipt = {
    status_name: "FINALIZED",
    consensus_data: {
      leader_receipt: [{
        mode: "leader",
        execution_result: "SUCCESS",
        genvm_result: {stderr: ""},
      }],
      // Validators canceled after quorum are normal and must not turn a
      // successful leader receipt into a client-side failure.
      validators: [{
        mode: "validator",
        execution_result: "ERROR",
        genvm_result: {stderr: "Validator execution cancelled after quorum"},
      }],
    },
  };

  assert.deepEqual(inspectReceiptExecution(receipt), {outcome: "success"});
}

function testStudionetExecutionFailure(): void {
  assert.deepEqual(
    inspectReceiptExecution({
      consensus_data: {
        leader_receipt: [{
          execution_result: "ERROR",
          genvm_result: {error_description: "spell_not_in_hand"},
        }],
      },
    }),
    {outcome: "failure", detail: "spell_not_in_hand"},
  );
  assert.deepEqual(inspectReceiptExecution({status_name: "FINALIZED"}), {
    outcome: "unknown",
  });
}

function testFinalizedMatchStateDetection(): void {
  assert.equal(matchStateChanged(null, {matchId: "aos-1", revision: 1}), true);
  assert.equal(
    matchStateChanged(
      {matchId: "aos-1", revision: 4},
      {matchId: "aos-1", revision: 5},
    ),
    true,
  );
  assert.equal(
    matchStateChanged(
      {matchId: "aos-1", revision: 4},
      {matchId: "aos-2", revision: 1},
    ),
    true,
  );
  assert.equal(
    matchStateChanged(
      {matchId: "aos-1", revision: 4},
      {matchId: "aos-1", revision: 4},
    ),
    false,
  );
  assert.equal(matchStateChanged(undefined, {matchId: "aos-1", revision: 1}), false);
  assert.equal(matchStateChanged({matchId: "aos-1", revision: 4}, null), false);
}

testConsensusChainReceipt();
testStudionetLeaderReceipt();
testStudionetExecutionFailure();
testFinalizedMatchStateDetection();
console.log("Studionet transaction reconciliation tests passed");

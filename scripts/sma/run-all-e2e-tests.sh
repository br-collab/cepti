#!/bin/bash

# scripts/sma/run-all-e2e-tests.sh
#
# Phase 2.6: E2E Test Runner
#
# Runs all E2E tests in sequence and generates a summary report.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RESULTS_DIR="/tmp/sma-e2e-tests"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════════"
echo "Phase 2.6: E2E Integration Test Suite"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Verify environment
echo "Checking environment..."
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
  echo -e "${RED}✗ .env.local not found${NC}"
  exit 1
fi

if ! command -v npx &> /dev/null; then
  echo -e "${RED}✗ npx not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Environment ready${NC}"
echo ""

# Test list
declare -a TESTS=(
  "happy-path"
  "scheduling"
  "denial"
  "errors"
  "performance"
  "audit-trail"
  "db-integrity"
)

declare -a RESULTS
declare -a DURATIONS

TOTAL_START=$(date +%s)
PASSED=0
FAILED=0

# Run each test
for TEST in "${TESTS[@]}"; do
  TEST_FILE="$SCRIPT_DIR/e2e-test-${TEST}.ts"

  if [ ! -f "$TEST_FILE" ]; then
    echo -e "${YELLOW}⚠ Skipping ${TEST}: file not found${NC}"
    RESULTS+=("SKIP")
    continue
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Running: ${TEST}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  TEST_START=$(date +%s)
  LOG_FILE="$RESULTS_DIR/${TEST}.log"

  if npx tsx "$TEST_FILE" > "$LOG_FILE" 2>&1; then
    RESULTS+=("PASS")
    ((PASSED++))
    STATUS="${GREEN}✓ PASS${NC}"
  else
    RESULTS+=("FAIL")
    ((FAILED++))
    STATUS="${RED}✗ FAIL${NC}"
  fi

  TEST_END=$(date +%s)
  DURATION=$((TEST_END - TEST_START))
  DURATIONS+=("${DURATION}s")

  echo -e "$STATUS (${DURATION}ms)"
  echo "Log: $LOG_FILE"
  echo ""
done

# Summary report
TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

echo "═══════════════════════════════════════════════════════════════"
echo "Test Summary"
echo "═══════════════════════════════════════════════════════════════"
echo ""

for i in "${!TESTS[@]}"; do
  TEST="${TESTS[$i]}"
  RESULT="${RESULTS[$i]}"
  DURATION="${DURATIONS[$i]:-0s}"

  if [ "$RESULT" = "PASS" ]; then
    STATUS="${GREEN}✓${NC}"
  elif [ "$RESULT" = "FAIL" ]; then
    STATUS="${RED}✗${NC}"
  else
    STATUS="${YELLOW}⚠${NC}"
  fi

  printf "%s %-20s %s (%s)\n" "$STATUS" "$TEST" "$RESULT" "$DURATION"
done

echo ""
echo "Total: ${PASSED} passed, ${FAILED} failed"
echo "Duration: ${TOTAL_DURATION}s"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}All tests PASSED!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  exit 0
else
  echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}Some tests FAILED. Review logs in $RESULTS_DIR${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
  exit 1
fi

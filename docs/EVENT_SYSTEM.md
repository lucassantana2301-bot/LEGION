# LEGION Event System Specification

## Overview
LEGION uses a strongly typed, deterministic Event Bus (`src/lib/events/bus.ts`) as the single source of truth for telemetry, agent communication, and user interface rendering.

## Event Hierarchy
- `MISSION_*`: Lifecycle state transitions (`MISSION_STARTED`, `MISSION_PAUSED`, `MISSION_COMPLETED`, etc.)
- `AGENT_*`: Agent state transitions and inter-agent communication packets (`AGENT_WORKING`, `AGENT_COMMUNICATION`, `AGENT_COMPLETED`)
- `TASK_*`: Task lifecycle updates (`TASK_ASSIGNED`, `TASK_REVIEW`, `TASK_COMPLETED`, etc.)
- `FILE_*`: Sandbox filesystem operations (`FILE_CREATED`, `FILE_MODIFIED`, `FILE_DELETED`)
- `TEST_*`: Test runner results (`TEST_STARTED`, `TEST_PASSED`, `TEST_FAILED`)
- `ISSUE_*`: Defect tracking lifecycle (`ISSUE_CREATED`, `ISSUE_ASSIGNED`, `ISSUE_RESOLVED`)
- `BUILD_*`: Build pipeline state (`BUILD_STARTED`, `BUILD_COMPLETED`, `BUILD_FAILED`)
- `APPROVAL_*`: Human-in-the-loop decisions (`APPROVAL_REQUIRED`, `APPROVAL_GRANTED`, `APPROVAL_REJECTED`)
- `TERMINAL_OUTPUT`: Sandbox log lines tagged with stream categories (`COMMAND`, `STDOUT`, `STDERR`, `SYSTEM`, `SUCCESS`, `WARNING`)

---
name: handover
description: Hand the work of one agent over to a fresh instance of the same role when its context is filling up, and start that successor from the handover note. Use when an agent is running out of room mid-task, or when the architect needs to continue briefed work that a previous instance left unfinished.
user-invocable: true
---

# Handover between instances of one role

An agent owns its own context. When that context fills, the work does not move to a different role
and it does not restart from zero: the running instance writes down what it knows and a fresh
instance of the **same** role picks it up. This skill is that procedure, for both sides.

## The rules this enforces

- **One role, one instance at a time.** A slice has at most one developer, one tester, one
  researcher, one git operator running. Two instances of a role must never write the same files.
- **An agent never spawns its own role.** Only the architect delegates, and it never delegates to
  another architect. Of the five roles only `architect` has the `Agent` tool, which is deliberate.
- **Continue before you re-create.** More work for a role that is already running goes to that
  instance as a message, so its context stays intact. A new `Agent` call starts from nothing and
  loses everything the first instance learned.
- **Each role writes only its own kind of file**, as its definition states. Nothing enforces this:
  an agent definition has no file permissions of its own, so the boundary holds through the brief
  and the architect's review of the diff. A handover note therefore repeats the boundary.
- **A handover is written before the context runs out, not after.** An agent that stops mid-task
  without a handover note has lost its work, whatever it says in its report.

## Side A — you are the agent running out of room

Start this while you still have room to write, roughly when two thirds of your context is gone, or
before any step you expect to be long (a full verification run, a wide search, a big file read).

Start early, because the room never comes back: a subagent's context is not compacted the way the
main session's is. When it fills, the run is prompted to continue and eventually ends, so a note
written late is a note never written.

1. Finish or abandon the edit in your hands. Never hand over a half-written file: either complete
   the change so the tree is consistent, or revert it and say so in the note.
2. Write the note to the session scratchpad as `handover-<role>-<slice>.md`. The scratchpad path is
   given in your environment; it is shared with the architect and it is not part of the repository.
3. Use exactly these sections:

   - **Brief** — the task as you received it, restated in your own words, with the files you were
     allowed to touch and the ones your role must not touch.
   - **Done** — every file you changed, one line each on what the change does.
   - **Decisions** — what you chose and why, especially where the brief left room. The successor
     must not reopen these.
   - **Verification** — which commands you ran, their result, and which you never ran.
   - **Remaining** — what is left, in the order you would do it.
   - **Traps** — what cost you time: a failing command and its fix, a misleading file, a rule that
     is easy to break here.

4. Stop working. Report to the architect in the normal format and make the last line
   `Handover: <absolute path to the note>`. Do not try to finish "just one more thing" after this.

## Side B — you are the architect starting the successor

1. Read the handover note yourself before delegating. If it is missing a section, the work is not
   ready to continue; ask the finishing instance for it while it is still alive.
2. Spawn the successor with the **same role and the same model** as the instance that stopped.
3. Make the first line of the brief `Read this handover note first and continue from it: <path>`,
   then repeat the original scope, constraints and verification commands. The note explains the
   state; the brief still carries the authority.
4. Record nothing about the handover in the repository. It is an implementation detail of one
   session, not project history. What belongs in the repository is the finished work and the usual
   updates to `docs/feature-graph.json` and `docs/STATE.md`.

## If the successor also fills up

The same procedure runs again, and the new note supersedes the old one rather than appending to it.
Two handovers in one slice means the slice is too large: say so in the report, and the architect
splits what remains before delegating again.

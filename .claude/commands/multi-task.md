**GENERAL MULTI-TASK PARALLEL AGENT ORCHESTRATOR**

Think deeply about orchestrating multiple parallel agents to work on independent tasks using isolated git worktrees. This command provides a flexible framework for distributing any number of tasks to autonomous agents.

**⚠️ CRITICAL ISOLATION REQUIREMENTS ⚠️**
=====================================
- Main project directory: $MAIN_PROJECT_DIR (NEVER MODIFIED BY AGENTS)
- Worktrees base: $MAIN_PROJECT_DIR-worktrees (ALL AGENT WORK HAPPENS HERE)
- Each agent works EXCLUSIVELY in their assigned worktree
- Agents must NEVER navigate to or modify the main project directory

🚨 PERMISSION HANDLING 🚨
- If you encounter permission errors creating $MAIN_PROJECT_DIR-worktrees:
  1. DO NOT create worktrees elsewhere
  2. DO NOT use sudo without explicit paths
  3. Instead run: mkdir -p "$MAIN_PROJECT_DIR-worktrees" && chmod 755 "$MAIN_PROJECT_DIR-worktrees"
  4. If still failing: chmod 755 "$MAIN_PROJECT_DIR/.." to ensure parent has permissions
  5. NEVER create worktrees in /tmp, /var, or other system directories

FORBIDDEN PATHS FOR SUB-AGENTS:
- $MAIN_PROJECT_DIR/* (main repository - READ ONLY)
- Any path outside their assigned worktree
- System directories (/tmp, /var, /etc)
=====================================

**Variables:**
task_files: $ARGUMENTS
worktree_base_dir: $MAIN_PROJECT_DIR-worktrees
main_project_dir: $MAIN_PROJECT_DIR
timestamp: $(date +%Y%m%d-%H%M%S)

**PHASE 1: TASK FILE PARSING & ANALYSIS**

Parse the arguments to extract task file paths:
1. Support individual files: `task1.md task2.md task3.md`
2. Support wildcards: `tasks/*.md`
3. Support mixed: `urgent-task.md features/*.md`

For each task file:
- Verify the file exists and is readable
- Extract task name from filename (without .md extension)
- Read and analyze the task content
- Determine if task requires subdivision

**PHASE 2: INTELLIGENT TASK ANALYSIS**

Analyze each task file to determine optimal agent distribution:

**Single Agent Indicators:**
- Single cohesive feature or module
- Clear bounded context
- No mention of multiple similar entities
- Straightforward implementation path

**Multi-Agent Indicators:**
- Multiple similar entities (e.g., "CRUD for products, categories, and suppliers")
- Explicitly mentioned parallel workflows
- Multiple independent sub-features
- Tasks containing phrases like "for each", "multiple", "various types"

**Task Subdivision Logic:**
```
For each task file:
  1. Parse task content for entity lists, parallel operations
  2. If multiple similar operations detected:
     - Extract entity/operation list
     - Create sub-task for each entity/operation
     - Assign descriptive names to sub-tasks
  3. Otherwise:
     - Treat as single agent task
```

**PHASE 3: WORKTREE ORCHESTRATION**

Create isolated environments for each agent/sub-agent:

```bash
# CRITICAL: Handle permissions properly
# Ensure worktrees base directory exists with proper permissions
if ! mkdir -p "$worktree_base_dir" 2>/dev/null; then
    echo "Permission denied creating $worktree_base_dir, fixing permissions..."
    # Try to fix permissions on parent directory
    parent_dir=$(dirname "$worktree_base_dir")
    if [ -w "$parent_dir" ]; then
        mkdir -p "$worktree_base_dir"
        chmod 755 "$worktree_base_dir"
    else
        echo "ERROR: Cannot create worktrees directory. Manual intervention required."
        echo "Run: sudo mkdir -p $worktree_base_dir && sudo chown $USER:$USER $worktree_base_dir"
        exit 1
    fi
fi

# Verify worktrees directory is writable
if [ ! -w "$worktree_base_dir" ]; then
    echo "Fixing permissions on $worktree_base_dir..."
    chmod 755 "$worktree_base_dir" || {
        echo "ERROR: Cannot write to worktrees directory"
        exit 1
    }
fi

# For each task/sub-task:
TASK_NAME="[extracted-task-name]"
WORKTREE_DIR="$worktree_base_dir/$TASK_NAME-$timestamp"

# IMPORTANT: Only create worktrees from the main project directory
if [ "$PWD" != "$main_project_dir" ]; then
    cd "$main_project_dir" || {
        echo "ERROR: Cannot access main project directory"
        exit 1
    }
fi

# Create git worktree (MUST be created from main project dir)
git worktree add "$WORKTREE_DIR" -b "task-$TASK_NAME-$timestamp" || {
    echo "ERROR: Failed to create worktree. Checking git status..."
    git worktree list
    exit 1
}

# CRITICAL: Remove git remotes to prevent accidental pushes
cd "$WORKTREE_DIR"
git remote remove origin 2>/dev/null || true
git remote remove upstream 2>/dev/null || true

# Create git hook to prevent push attempts
mkdir -p .git/hooks
cat > .git/hooks/pre-push << 'EOF'
#!/bin/sh
echo "❌ ERROR: Git push is DISABLED in worktrees!"
echo "This is an isolated worktree for task: $TASK_NAME"
echo "Changes should be reviewed and merged from the main repository"
exit 1
EOF
chmod +x .git/hooks/pre-push

# Create task documentation
cat > "$WORKTREE_DIR/TASK.md" << EOF
# Task: $TASK_NAME
Started: $(date)
Source: [original-task-file]
Type: [full-task|sub-task]
Worktree: $WORKTREE_DIR
Branch: task-$TASK_NAME-$timestamp

⚠️ GIT REMOTES DISABLED - This worktree cannot push to remotes
EOF

# Create warning file for agents
cat > "$WORKTREE_DIR/WORKTREE_RULES.md" << EOF
# ⚠️ WORKTREE ISOLATION RULES ⚠️

YOU ARE IN AN ISOLATED GIT WORKTREE
=====================================
- Current Directory: $WORKTREE_DIR
- Branch: task-$TASK_NAME-$timestamp
- Git Push: DISABLED (pre-push hook installed)
- Git Remotes: REMOVED

ALLOWED OPERATIONS:
✅ git add, git commit (local only)
✅ git status, git diff, git log
✅ Create/edit files within this directory

FORBIDDEN OPERATIONS:
❌ git push (blocked by hook)
❌ git checkout (would break worktree)
❌ cd to main project directory
❌ Modify files outside this worktree
EOF

# Log worktree creation
echo "Created isolated worktree: $WORKTREE_DIR"
```

**PHASE 4: PARALLEL AGENT DEPLOYMENT**

Deploy agents with clear, isolated task assignments:

**Agent Task Template:**
```
TASK: Implement [TASK_NAME]

You are implementing a specific task with complete autonomy within your isolated environment.

🚨 CRITICAL WORKING DIRECTORY & GIT RULES 🚨
=====================================
YOUR ASSIGNED DIRECTORY: [WORKTREE_PATH]
Example: /path/to/project-worktrees/feature-auth-20250115-143000

MANDATORY RULES - VIOLATION MEANS TASK FAILURE:
1. You MUST work EXCLUSIVELY within: [WORKTREE_PATH]
2. DO NOT navigate to the main project directory
3. DO NOT create files outside of [WORKTREE_PATH]
4. Your directory is a git worktree - treat it as your project root
5. All paths should be relative to [WORKTREE_PATH]
6. First action: cd [WORKTREE_PATH] && pwd to confirm location

GIT OPERATION RESTRICTIONS:
- NEVER use 'git push' to any remote
- NEVER use 'git checkout' to switch branches
- NEVER use 'git worktree' commands
- NEVER modify .git directory or configuration
- ALLOWED: git add, git commit (local only)
- ALLOWED: git status, git diff, git log
- Your branch: task-[TASK_NAME]-[timestamp] (already created)

VERIFICATION CHECKLIST (DO THIS FIRST):
1. Run: cd [WORKTREE_PATH]
2. Run: pwd (MUST show [WORKTREE_PATH])
3. Run: git status (confirm you're on correct branch)
4. Run: git remote -v (should show no remotes or original remotes)
5. If ANY check fails, STOP and report error

DIRECTORY VERIFICATION THROUGHOUT TASK:
- Before EVERY file operation, verify you're in [WORKTREE_PATH]
- Use absolute paths starting with [WORKTREE_PATH]
- NEVER use paths containing the main project directory

MAIN REPOSITORY PROTECTION:
- The main repository at [MAIN_PROJECT_DIR] is READ-ONLY
- You may read files from it using Read tool if needed for reference
- You MUST NEVER use Edit, Write, or MultiEdit on main repo files
- If you need to modify a file from main repo:
  1. First copy it to your worktree: cp [MAIN_PROJECT_DIR]/file [WORKTREE_PATH]/file
  2. Then edit the copy in your worktree
- NEVER cd into [MAIN_PROJECT_DIR]
- NEVER run any modifying commands in [MAIN_PROJECT_DIR]

PATH VALIDATION FOR EVERY OPERATION:
Before using Edit/Write/MultiEdit, verify:
1. The target path starts with [WORKTREE_PATH]
2. The target path does NOT contain [MAIN_PROJECT_DIR]
3. Run: pwd to confirm you're in [WORKTREE_PATH]
If any check fails, STOP immediately
=====================================

TASK SPECIFICATION:
[Full content of the task markdown file]

IMPLEMENTATION REQUIREMENTS:
1. Navigate to your worktree: cd [WORKTREE_PATH]
2. Implement all requirements from the specification
3. Create appropriate project structure
4. Write clean, maintainable code
5. Include relevant tests
6. Document your implementation decisions

DELIVERABLES (all within [WORKTREE_PATH]):
- Complete implementation of the specified task
- README.md with setup and usage instructions
- IMPLEMENTATION_NOTES.md documenting key decisions
- Any task-specific requirements from the specification

COMPLETION:
When finished, create COMPLETED.md with:
- Summary of what was implemented
- Any deviations from the specification
- Known limitations or future improvements
- Quick start instructions
```

**Sub-Task Agent Template (for subdivided tasks):**
```
[Same as above, plus:]

PARENT TASK: [original-task-name]
SUB-TASK FOCUS: [specific-entity-or-operation]

You are implementing one part of a larger task. Focus specifically on:
[Detailed description of the sub-task scope]

Ensure your implementation can work independently but follows patterns that would allow integration with sibling sub-tasks.
```

**PHASE 5: AGENT COORDINATION & MONITORING**

Launch all agents simultaneously:

```python
# Pseudo-code for parallel execution
agents = []
for task in all_tasks:
    agent_prompt = generate_agent_prompt(task)
    agent = launch_agent(
        task=agent_prompt,
        working_directory=task.worktree_path,
        type="general-purpose"
    )
    agents.append(agent)

# Wait for all agents to complete
wait_for_all(agents)
```

**PHASE 6: TASK PATTERN DETECTION**

**Common Patterns to Detect:**

**CRUD Operations Pattern:**
```
If task contains:
- "CRUD for [entity1], [entity2], [entity3]"
- "endpoints for managing [list of entities]"
- "implement create, read, update, delete for [entities]"

Then create sub-agents:
- One agent per entity
- Each handles full CRUD for their entity
- Shared patterns documented in parent task
```

**Feature Set Pattern:**
```
If task contains:
- "implement the following features:"
- Numbered or bulleted list of independent features
- "the system should support:"

Then create sub-agents:
- One agent per major feature
- Each implements their feature completely
- Integration notes in parent documentation
```

**Microservice Pattern:**
```
If task contains:
- "separate services for"
- "independent modules"
- "loosely coupled components"

Then create sub-agents:
- One agent per service/module
- Each creates standalone implementation
- API contracts documented
```

**PHASE 7: RESULTS AGGREGATION**

After all agents complete:

1. **Individual Summaries**: Each worktree contains its own summary
2. **Consolidated Report**: Create overview in main worktrees directory

```bash
# Create summary report
SUMMARY_FILE="$worktree_base_dir/EXECUTION_SUMMARY_$timestamp.md"

cat > "$SUMMARY_FILE" << EOF
# Multi-Task Execution Summary
Executed: $(date)
Total Tasks: [count]
Total Agents: [count]

## Task Overview
EOF

# Add each task status
for worktree in $worktree_base_dir/*; do
    if [ -f "$worktree/COMPLETED.md" ]; then
        echo "✅ $(basename $worktree)" >> "$SUMMARY_FILE"
    else
        echo "⏳ $(basename $worktree)" >> "$SUMMARY_FILE"
    fi
done

# Add quick access links
echo -e "\n## Worktree Locations" >> "$SUMMARY_FILE"
for worktree in $worktree_base_dir/*; do
    echo "- $(basename $worktree): $worktree" >> "$SUMMARY_FILE"
done
```

**PHASE 8: EXECUTION GUIDELINES**

**Task Independence:**
- Each task must be completely self-contained
- No shared state between parallel tasks
- Each worktree is a complete project

**Error Handling:**
- If a task file doesn't exist, skip with warning
- If worktree creation fails, abort that task
- Continue with remaining tasks

**Resource Management:**
- Limit concurrent agents based on task count
- For >10 tasks, consider batching
- Monitor system resources

**ULTRA-THINKING REQUIREMENTS:**

Before orchestrating, think deeply about:

**Task Understanding:**
- What is the core objective of each task?
- Are there hidden dependencies between tasks?
- Which tasks benefit from subdivision?

**Agent Optimization:**
- How many agents provide optimal parallelism?
- Which tasks are most complex and need more resources?
- How to ensure consistent quality across all agents?

**Isolation Integrity:**
- How to guarantee agents never interfere?
- What shared resources need careful handling?
- How to make results easy to review and integrate?

**SAFETY VALIDATION CHECKLIST:**

Before launching agents, validate:
1. ✓ All worktrees created under $MAIN_PROJECT_DIR-worktrees
2. ✓ No worktrees in system directories (/tmp, /var, etc)
3. ✓ Each worktree has git remotes removed
4. ✓ Each worktree has pre-push hook installed
5. ✓ Each worktree has WORKTREE_RULES.md file
6. ✓ Main repository is untouched

**ORCHESTRATOR SELF-RESTRICTIONS:**
As the orchestrating agent, you MUST:
- NEVER attempt to create worktrees outside $MAIN_PROJECT_DIR-worktrees
- NEVER use sudo to bypass permissions - fix them properly
- NEVER modify files in $MAIN_PROJECT_DIR
- ALWAYS verify worktree creation succeeded before launching agents

**EXECUTION COMMAND:**
Begin by parsing all provided task files, analyzing their content for optimal agent distribution, creating isolated worktrees with proper permission handling, validating all safety measures, and orchestrating parallel implementation of all tasks while maintaining complete isolation between the main repository and agent work.
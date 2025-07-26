**GENERAL MULTI-TASK PARALLEL AGENT ORCHESTRATOR**

Think deeply about orchestrating multiple parallel agents to work on independent tasks using isolated git worktrees. This command provides a flexible framework for distributing any number of tasks to autonomous agents.

**⚠️ CRITICAL ISOLATION REQUIREMENTS ⚠️**
=====================================
- Main project directory: $MAIN_PROJECT_DIR (NEVER MODIFIED BY AGENTS)
- Worktrees base: $MAIN_PROJECT_DIR-worktrees (ALL AGENT WORK HAPPENS HERE)
- Each agent works EXCLUSIVELY in their assigned worktree
- Agents must NEVER navigate to or modify the main project directory
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
# Ensure worktrees base directory exists
mkdir -p "$worktree_base_dir"

# For each task/sub-task:
TASK_NAME="[extracted-task-name]"
WORKTREE_DIR="$worktree_base_dir/$TASK_NAME-$timestamp"

# Create git worktree
cd "$main_project_dir"
git worktree add "$WORKTREE_DIR" -b "task-$TASK_NAME-$timestamp"

# Create task documentation
cat > "$WORKTREE_DIR/TASK.md" << EOF
# Task: $TASK_NAME
Started: $(date)
Source: [original-task-file]
Type: [full-task|sub-task]
EOF

# Log worktree creation
echo "Created worktree: $WORKTREE_DIR"
```

**PHASE 4: PARALLEL AGENT DEPLOYMENT**

Deploy agents with clear, isolated task assignments:

**Agent Task Template:**
```
TASK: Implement [TASK_NAME]

You are implementing a specific task with complete autonomy within your isolated environment.

CRITICAL WORKING DIRECTORY RULES:
=====================================
YOUR ASSIGNED DIRECTORY: [WORKTREE_PATH]
Example: /path/to/project-worktrees/feature-auth-20250115-143000

MANDATORY RULES:
1. You MUST work EXCLUSIVELY within: [WORKTREE_PATH]
2. DO NOT navigate to the main project directory
3. DO NOT create files outside of [WORKTREE_PATH]
4. Your directory is a git worktree - treat it as your project root
5. All paths should be relative to [WORKTREE_PATH]
6. First action: cd [WORKTREE_PATH] && pwd to confirm location

VERIFY YOUR LOCATION:
- Run: cd [WORKTREE_PATH]
- Run: pwd (should show [WORKTREE_PATH])
- If not in correct directory, stop and correct
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

**EXECUTION COMMAND:**
Begin by parsing all provided task files, analyzing their content for optimal agent distribution, creating isolated worktrees, and orchestrating parallel implementation of all tasks while maintaining complete isolation and producing clear, reviewable results.
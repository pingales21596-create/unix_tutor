import { useState, useEffect, useRef, useCallback } from "react";

// ─── COMMAND FAMILY DEFINITIONS ──────────────────────────────────────────────
// Maps every canonical command to its accepted aliases/variants.
// If an alias is used instead of the canonical, we PASS the task but explain why
// the real command is preferred.
const COMMAND_FAMILIES = {
  ls:     { aliases: ["ll","l","la","dir"], note: "`ll` and `l` are shell aliases for `ls -la`. They're handy shortcuts, but `ls` is the actual Unix command — available on every system without configuration." },
  pwd:    { aliases: ["cwd"], note: "`cwd` is not a standard Unix command. `pwd` (print working directory) is the correct portable command." },
  cd:     { aliases: [], note: "" },
  mkdir:  { aliases: ["md"], note: "`md` is a Windows/DOS command. On Unix/Linux use `mkdir`." },
  touch:  { aliases: [], note: "" },
  cat:    { aliases: ["type","more","less"], note: "`more`/`less` are pagers — they show files page by page. `cat` prints the entire file at once, which is what's expected here." },
  cp:     { aliases: ["copy"], note: "`copy` is a Windows command. On Unix use `cp`." },
  mv:     { aliases: ["move","rename"], note: "`move`/`rename` are Windows commands. On Unix use `mv` for both moving and renaming." },
  rm:     { aliases: ["del","delete","erase"], note: "`del`/`delete` are Windows commands. On Unix use `rm` — and be careful, there's no recycle bin!" },
  echo:   { aliases: ["print","say"], note: "`print`/`say` are not standard Unix commands. `echo` is the correct way to print text in shell scripts." },
  grep:   { aliases: ["findstr","search"], note: "`findstr` is a Windows command. On Unix/Linux `grep` is the standard and far more powerful text search tool." },
  find:   { aliases: ["locate","where","whereis"], note: "`locate` searches a pre-built index (faster but stale). `find` searches the live filesystem — more accurate and always available." },
  wc:     { aliases: ["count"], note: "`count` is not a Unix command. `wc` (word count) is the standard tool for counting lines, words, and characters." },
  sort:   { aliases: [], note: "" },
  uniq:   { aliases: ["unique","distinct"], note: "`unique`/`distinct` are not Unix commands. `uniq` is the standard tool — always pair it with `sort` first." },
  chmod:  { aliases: ["attrib","icacls"], note: "`attrib`/`icacls` are Windows commands. On Unix use `chmod` to control file permissions." },
  ps:     { aliases: ["tasklist","top"], note: "`tasklist` is a Windows command. `top` shows a live process monitor. `ps aux` gives a clean snapshot — which is what's expected here." },
  kill:   { aliases: ["taskkill","pkill","killall"], note: "`pkill`/`killall` kill by name, `kill` kills by PID. The task asks for `kill` with a specific PID, so `kill -9 PID` is the right approach." },
  env:    { aliases: ["set","printenv"], note: "`set` is a shell built-in that shows more than just env vars. `printenv` works too, but `env` is the most portable standard command." },
  sudo:   { aliases: ["runas","su"], note: "`runas` is Windows, `su` switches user entirely. `sudo` runs a single command with elevated privileges — safer and more common in modern Linux." },
  sort:   { aliases: ["gsort"], note: "" },
  head:   { aliases: [], note: "" },
  tail:   { aliases: [], note: "" },
  man:    { aliases: ["help","/?"], note: "`help` and `/?` are Windows conventions. On Unix use `man command` to read the manual page." },
  clear:  { aliases: ["cls","reset"], note: "`cls` is a Windows command. On Unix use `clear` to clear the terminal screen." },
  diff:   { aliases: ["fc","comp"], note: "`fc`/`comp` are Windows commands. On Unix use `diff` to compare files line by line." },
  tar:    { aliases: ["zip","unzip","compress"], note: "`zip`/`unzip` are separate tools. `tar` is the standard Unix archiver — combine with `gzip` for `.tar.gz` files." },
  curl:   { aliases: ["wget"], note: "`wget` works too! Both are valid downloaders. `curl` is more versatile for API calls, `wget` is simpler for direct downloads." },
  ssh:    { aliases: ["putty","telnet"], note: "`putty` is a Windows GUI client, `telnet` is unencrypted. Always use `ssh` for secure remote connections." },
  ping:   { aliases: ["tracert","traceroute"], note: "`tracert` is Windows, `traceroute` is the Unix equivalent. `ping` tests basic connectivity." },
  df:     { aliases: ["diskspace","du"], note: "`du` measures directory sizes, `df` shows overall disk usage. They complement each other." },
  history:{ aliases: ["h"], note: "`h` is sometimes aliased to `history`, but `history` is the actual command available on all Unix systems." },
  whoami: { aliases: ["id","who"], note: "`id` shows more details (UID/GID), `who` shows logged-in users. `whoami` is the simplest way to print just your username." },
};

// All canonical commands (flat list for quick lookup)
const ALL_VALID_COMMANDS = Object.keys(COMMAND_FAMILIES);

// Check if input is a valid unix command (canonical or alias)
const isValidUnixCommand = (input) => {
  const cmd = input.trim().split(" ")[0].toLowerCase();
  if (ALL_VALID_COMMANDS.includes(cmd)) return true;
  return Object.values(COMMAND_FAMILIES).some(f => f.aliases.includes(cmd));
};

// Given input, check if it satisfies the expected canonical command family.
// Returns: { pass: bool, isAlias: bool, aliasUsed: string, canonicalCmd: string, note: string }
const matchCommandFamily = (input, expectedCanonical) => {
  const cmd = input.trim().split(" ")[0].toLowerCase();
  const family = COMMAND_FAMILIES[expectedCanonical];
  if (!family) return { pass: false, isAlias: false };

  // Exact canonical match (with any flags/args)
  if (cmd === expectedCanonical) return { pass: true, isAlias: false };

  // Alias match
  if (family.aliases.includes(cmd)) {
    return { pass: true, isAlias: true, aliasUsed: cmd, canonicalCmd: expectedCanonical, note: family.note };
  }
  return { pass: false, isAlias: false };
};

// ─── LEVELS & LESSONS ────────────────────────────────────────────────────────
const LEVELS = [
  {
    id: "beginner",
    title: "Beginner",
    subtitle: "Navigation & Basics",
    icon: "◈",
    color: "#00ff9d",
    prereqs: [],
    xpReward: 100,
    lessons: [
      {
        id: "pwd", command: "pwd", title: "Where am I?",
        description: "Print Working Directory — shows your current location.",
        explanation: "Every time you open a terminal, you're 'inside' a directory. `pwd` tells you exactly where you are — think of it as GPS for your terminal.",
        syntax: "pwd",
        examples: [{ cmd: "pwd", out: "/home/user" }],
        mission: "The system just booted. Find out where you are.",
        missionTask: "Type `pwd` to reveal your current location.",
        validate: (input) => input.trim() === "pwd",
        simulatedOutput: "/home/quest_user",
        hint: "Just type the command name — no arguments needed!",
        xp: 20,
      },
      {
        id: "ls", command: "ls", title: "List the Room",
        description: "List directory contents — see what files and folders exist here.",
        explanation: "`ls` lists everything in the current directory. Add `-la` to see hidden files and details. It's the most used command in Unix.",
        syntax: "ls [options] [directory]",
        examples: [
          { cmd: "ls", out: "Documents  Downloads  Pictures  notes.txt" },
          { cmd: "ls -la", out: "drwxr-xr-x  Documents\n-rw-r--r--  notes.txt" },
        ],
        mission: "You're in an unknown directory. What's inside?",
        missionTask: "Use `ls` to list all files and folders here.",
        validate: (input) => matchCommandFamily(input, "ls").pass,
        simulatedOutput: "missions/  logs/  config.txt  README.md  .secret_key",
        hint: "Type ls — optionally add -la to see hidden files too",
        xp: 20,
      },
      {
        id: "cd", command: "cd", title: "Move Around",
        description: "Change Directory — navigate the filesystem tree.",
        explanation: "`cd` moves you into another directory. Use `cd ..` to go up, `cd ~` to go home. You can also run `pwd` before or after to confirm your location.",
        syntax: "cd [directory]",
        examples: [
          { cmd: "cd Documents", out: "(moved into Documents)" },
          { cmd: "cd ..", out: "(moved up one level)" },
          { cmd: "pwd", out: "/home/user  ← works here too!" },
        ],
        mission: "The mission files are in the `missions/` folder.",
        missionTask: "Navigate into the `missions` directory.",
        validate: (input) => input.trim() === "cd missions" || input.trim() === "cd missions/",
        simulatedOutput: "/home/quest_user/missions",
        hint: "Type: cd missions",
        xp: 20,
      },
      {
        id: "mkdir", command: "mkdir", title: "Create a Folder",
        description: "Make Directory — create new directories.",
        explanation: "`mkdir` creates a new folder. Use `mkdir -p` to create nested directories all at once.",
        syntax: "mkdir [options] directory_name",
        examples: [
          { cmd: "mkdir projects", out: "(created projects/)" },
          { cmd: "mkdir -p a/b/c", out: "(created nested dirs a/b/c/)" },
        ],
        mission: "You need a secure folder to store collected data.",
        missionTask: "Create a directory called `secure_data`.",
        validate: (input) => input.trim() === "mkdir secure_data",
        simulatedOutput: "(directory 'secure_data' created)",
        hint: "mkdir followed by the directory name",
        xp: 20,
      },
      {
        id: "touch", command: "touch", title: "Create a File",
        description: "Create empty files or update timestamps.",
        explanation: "`touch` creates an empty file if it doesn't exist. Great for scaffolding file structures.",
        syntax: "touch filename",
        examples: [{ cmd: "touch report.txt", out: "(empty file report.txt created)" }],
        mission: "You need an empty log file to record your activities.",
        missionTask: "Create a file called `activity.log`.",
        validate: (input) => input.trim() === "touch activity.log",
        simulatedOutput: "(file 'activity.log' created)",
        hint: "touch followed by the filename",
        xp: 20,
      },
    ],
  },
  {
    id: "explorer",
    title: "Explorer",
    subtitle: "Files & Text",
    icon: "◉",
    color: "#00c8ff",
    prereqs: ["beginner"],
    xpReward: 150,
    lessons: [
      {
        id: "cat", command: "cat", title: "Read a File",
        description: "Concatenate and display file contents.",
        explanation: "`cat` prints the full content of a file. Perfect for reading short files quickly.",
        syntax: "cat [file...]",
        examples: [{ cmd: "cat notes.txt", out: "Meeting at 9am\nBring coffee" }],
        mission: "Intel says there's a README.md with critical info.",
        missionTask: "Read the contents of `README.md`.",
        validate: (input) => input.trim() === "cat README.md",
        simulatedOutput: "# Mission Dossier\nTarget: Retrieve the encrypted key.\nLocation: /var/secure/\nWarning: Logs are monitored.",
        hint: "cat followed by the filename",
        xp: 25,
      },
      {
        id: "cp", command: "cp", title: "Copy Files",
        description: "Copy files or directories.",
        explanation: "`cp source destination` copies a file. Use `cp -r` for directories.",
        syntax: "cp [options] source destination",
        examples: [{ cmd: "cp file.txt backup.txt", out: "(file.txt copied to backup.txt)" }],
        mission: "Back up the config before modifying it.",
        missionTask: "Copy `config.txt` to `config.bak`.",
        validate: (input) => input.trim() === "cp config.txt config.bak",
        simulatedOutput: "(config.txt -> config.bak copied successfully)",
        hint: "cp source destination",
        xp: 25,
      },
      {
        id: "mv", command: "mv", title: "Move & Rename",
        description: "Move or rename files and directories.",
        explanation: "`mv` moves files to a new location OR renames them. No copy is made.",
        syntax: "mv source destination",
        examples: [{ cmd: "mv old.txt new.txt", out: "(renamed old.txt to new.txt)" }],
        mission: "The log file needs to be archived.",
        missionTask: "Move `activity.log` into the `logs/` directory.",
        validate: (input) => input.trim() === "mv activity.log logs/" || input.trim() === "mv activity.log logs",
        simulatedOutput: "(activity.log moved to logs/)",
        hint: "mv source destination_directory/",
        xp: 25,
      },
      {
        id: "rm", command: "rm", title: "Delete Files",
        description: "Remove files or directories — permanently.",
        explanation: "`rm` deletes files with NO recycle bin. Use `-r` for directories, `-f` to force.",
        syntax: "rm [options] file",
        examples: [{ cmd: "rm temp.txt", out: "(temp.txt deleted)" }],
        mission: "Clear the temp file before the system audit.",
        missionTask: "Delete the file `temp_cache.tmp`.",
        validate: (input) => input.trim() === "rm temp_cache.tmp",
        simulatedOutput: "(temp_cache.tmp permanently deleted)",
        hint: "rm filename — no undo!",
        xp: 25,
      },
      {
        id: "echo", command: "echo", title: "Print Text",
        description: "Display text or variable values in the terminal.",
        explanation: "`echo` prints text to the terminal. Great for testing and scripting.",
        syntax: 'echo "text"',
        examples: [{ cmd: 'echo "Hello World"', out: "Hello World" }],
        mission: "Leave a status message for other operators.",
        missionTask: 'Type: echo "Mission in progress"',
        validate: (input) => input.includes("echo") && input.includes("Mission in progress"),
        simulatedOutput: "Mission in progress",
        hint: 'echo "Mission in progress"',
        xp: 25,
      },
    ],
  },
  {
    id: "apprentice",
    title: "Apprentice",
    subtitle: "Searching & Filtering",
    icon: "◎",
    color: "#ffd700",
    prereqs: ["beginner", "explorer"],
    xpReward: 200,
    lessons: [
      {
        id: "grep", command: "grep", title: "Search Text",
        description: "Search for patterns in files.",
        explanation: "`grep pattern file` finds lines matching a pattern. Use `-i` for case-insensitive, `-r` recursive, `-n` for line numbers.",
        syntax: "grep [options] pattern file",
        examples: [{ cmd: "grep 'error' system.log", out: "line 42: error: disk full" }],
        mission: "Find the error in the system logs.",
        missionTask: 'Search for "ERROR" in `system.log`.',
        validate: (input) => input.includes("grep") && input.includes("ERROR") && input.includes("system.log"),
        simulatedOutput: "line 127: [ERROR] Authentication failed\nline 203: [ERROR] Connection refused",
        hint: "grep 'ERROR' system.log",
        xp: 30,
      },
      {
        id: "find", command: "find", title: "Find Files",
        description: "Search for files and directories in the filesystem.",
        explanation: "`find` searches by name, type, size, or date. More powerful than ls for recursive searches.",
        syntax: "find [path] [options]",
        examples: [{ cmd: "find . -name '*.log'", out: "./logs/system.log\n./logs/error.log" }],
        mission: "A config file is hidden somewhere in the system.",
        missionTask: 'Find all files named "*.conf" from current directory.',
        validate: (input) => input.includes("find") && input.includes("*.conf"),
        simulatedOutput: "./etc/network.conf\n./etc/ssh/sshd.conf\n./usr/local/app.conf",
        hint: "find . -name '*.conf'",
        xp: 30,
      },
      {
        id: "wc", command: "wc", title: "Count Words & Lines",
        description: "Word count — count lines, words, and characters.",
        explanation: "`wc -l` counts lines, `-w` counts words, `-c` counts characters.",
        syntax: "wc [options] file",
        examples: [{ cmd: "wc -l access.log", out: "1024 access.log" }],
        mission: "How many entries are in the access log?",
        missionTask: "Count the number of lines in `access.log`.",
        validate: (input) => input.includes("wc") && input.includes("-l") && input.includes("access.log"),
        simulatedOutput: "   4821 access.log",
        hint: "wc -l access.log",
        xp: 30,
      },
      {
        id: "sort", command: "sort", title: "Sort Output",
        description: "Sort lines of text files.",
        explanation: "`sort` arranges lines alphabetically. Use `-n` for numeric, `-r` for reverse.",
        syntax: "sort [options] file",
        examples: [{ cmd: "sort names.txt", out: "Alice\nBob\nCharlie" }],
        mission: "Organize the IP addresses from the log file.",
        missionTask: "Sort the contents of `ip_list.txt`.",
        validate: (input) => input.includes("sort") && input.includes("ip_list.txt"),
        simulatedOutput: "10.0.0.1\n10.0.0.14\n192.168.1.1\n255.255.255.0",
        hint: "sort ip_list.txt",
        xp: 30,
      },
      {
        id: "uniq", command: "uniq", title: "Remove Duplicates",
        description: "Filter out adjacent duplicate lines.",
        explanation: "`uniq` removes consecutive duplicates. Always sort first! Use `-c` to count.",
        syntax: "sort file | uniq [options]",
        examples: [{ cmd: "sort log.txt | uniq -c", out: "  42 error\n 103 info" }],
        mission: "Find unique visitors in the access log.",
        missionTask: "Sort `visitors.txt` and pipe to uniq.",
        validate: (input) => input.includes("sort") && input.includes("uniq") && input.includes("visitors.txt"),
        simulatedOutput: "alice@corp.com\nbob@startup.io\ncharlie@dev.net",
        hint: "sort visitors.txt | uniq",
        xp: 30,
      },
    ],
  },
  {
    id: "hacker",
    title: "Hacker",
    subtitle: "Pipes & Redirection",
    icon: "◍",
    color: "#ff6b35",
    prereqs: ["beginner", "explorer", "apprentice"],
    xpReward: 300,
    lessons: [
      {
        id: "pipe", command: "|", title: "The Pipe",
        description: "Chain commands — send output of one as input to another.",
        explanation: "The pipe `|` connects commands. Output of one flows into the next. Foundation of Unix philosophy.",
        syntax: "command1 | command2 | command3",
        examples: [{ cmd: "cat log.txt | grep ERROR | wc -l", out: "42" }],
        mission: "Count how many error lines are in the system log.",
        missionTask: "Pipe grep ERROR from system.log into wc -l",
        validate: (input) => input.includes("|") && input.includes("grep") && input.includes("wc"),
        simulatedOutput: "      17",
        hint: "cat system.log | grep ERROR | wc -l",
        xp: 40,
      },
      {
        id: "redirect-out", command: ">", title: "Redirect Output",
        description: "Send command output to a file.",
        explanation: "`>` redirects stdout to a file (overwrites). `>>` appends. Essential for logging.",
        syntax: "command > file",
        examples: [{ cmd: "ls > filelist.txt", out: "(output saved to filelist.txt)" }],
        mission: "Save the current directory listing to a file.",
        missionTask: "Redirect `ls -la` output into `snapshot.txt`.",
        validate: (input) => input.includes("ls") && input.includes(">") && input.includes("snapshot.txt"),
        simulatedOutput: "(directory listing saved to snapshot.txt)",
        hint: "ls -la > snapshot.txt",
        xp: 40,
      },
      {
        id: "redirect-in", command: "<", title: "Redirect Input",
        description: "Feed a file as input to a command.",
        explanation: "`<` redirects a file as stdin. The command reads from the file instead of keyboard.",
        syntax: "command < file",
        examples: [{ cmd: "sort < unsorted.txt", out: "apple\nbanana\ncherry" }],
        mission: "Sort the IP list by feeding it directly into sort.",
        missionTask: "Use sort with input redirection on `ip_list.txt`.",
        validate: (input) => input.includes("sort") && input.includes("<") && input.includes("ip_list.txt"),
        simulatedOutput: "10.0.0.1\n172.16.0.1\n192.168.1.1",
        hint: "sort < ip_list.txt",
        xp: 40,
      },
      {
        id: "xargs", command: "xargs", title: "Build Commands",
        description: "Build and execute commands from standard input.",
        explanation: "`xargs` takes stdin and passes it as arguments to another command. Powerful with `find`.",
        syntax: "command | xargs another_command",
        examples: [{ cmd: "find . -name '*.tmp' | xargs rm", out: "(all .tmp files deleted)" }],
        mission: "Delete all .tmp files found by the system.",
        missionTask: "Pipe `find . -name '*.tmp'` into xargs rm.",
        validate: (input) => input.includes("find") && input.includes("xargs") && input.includes("rm"),
        simulatedOutput: "(removed: cache.tmp, session.tmp, upload_3829.tmp)",
        hint: "find . -name '*.tmp' | xargs rm",
        xp: 40,
      },
    ],
  },
  {
    id: "expert",
    title: "Expert",
    subtitle: "Processes & Permissions",
    icon: "◆",
    color: "#ff2d55",
    prereqs: ["beginner", "explorer", "apprentice", "hacker"],
    xpReward: 500,
    lessons: [
      {
        id: "chmod", command: "chmod", title: "File Permissions",
        description: "Change file mode bits — control who can read, write, execute.",
        explanation: "Unix permissions: owner, group, others. Each has read(4), write(2), execute(1). `chmod 755` = rwxr-xr-x. Crucial for security.",
        syntax: "chmod [permissions] file",
        examples: [{ cmd: "chmod 755 script.sh", out: "(script.sh: rwxr-xr-x)" }],
        mission: "Make the deployment script executable.",
        missionTask: "Give `deploy.sh` execute permissions with chmod +x.",
        validate: (input) => input.includes("chmod") && input.includes("+x") && input.includes("deploy.sh"),
        simulatedOutput: "(deploy.sh permissions: -rwxr-xr-x)",
        hint: "chmod +x deploy.sh",
        xp: 60,
      },
      {
        id: "ps", command: "ps", title: "View Processes",
        description: "Snapshot of currently running processes.",
        explanation: "`ps aux` shows all processes with PID, CPU/memory usage, and command name.",
        syntax: "ps [options]",
        examples: [{ cmd: "ps aux", out: "USER  PID  %CPU  COMMAND\nroot  1    0.0   /sbin/init" }],
        mission: "Something is consuming too much CPU. Identify it.",
        missionTask: "List all running processes with `ps aux`.",
        validate: (input) => input.trim() === "ps aux" || input.trim() === "ps -aux",
        simulatedOutput: "USER     PID  %CPU COMMAND\nroot       1   0.0 /sbin/init\nwww-data 892  87.3 /usr/bin/python3 miner.py\nuser    1042   0.2 bash",
        hint: "ps aux",
        xp: 60,
      },
      {
        id: "kill", command: "kill", title: "Stop Processes",
        description: "Send signals to processes — typically to terminate them.",
        explanation: "`kill PID` sends SIGTERM. `kill -9 PID` force kills. Use `ps` first to find the PID.",
        syntax: "kill [signal] PID",
        examples: [{ cmd: "kill -9 5678", out: "(SIGKILL: process force terminated)" }],
        mission: "The rogue miner process (PID 892) must be stopped.",
        missionTask: "Force kill process 892 with kill -9.",
        validate: (input) => input.includes("kill") && input.includes("-9") && input.includes("892"),
        simulatedOutput: "(PID 892 terminated — CPU usage dropped to 0.1%)",
        hint: "kill -9 892",
        xp: 60,
      },
      {
        id: "env", command: "env", title: "Environment Variables",
        description: "Display or set environment variables.",
        explanation: "Environment variables store config values. `env` lists them. `export VAR=value` sets one.",
        syntax: "env | export VAR=value",
        examples: [{ cmd: "env", out: "PATH=/usr/bin\nHOME=/home/user\nUSER=quest_user" }],
        mission: "Check what environment variables are configured.",
        missionTask: "Run `env` to display all environment variables.",
        validate: (input) => input.trim() === "env",
        simulatedOutput: "PATH=/usr/local/bin:/usr/bin\nHOME=/home/quest_user\nUSER=quest_user\nSECRET_KEY=xK9#mP2",
        hint: "Just type env",
        xp: 60,
      },
      {
        id: "sudo", command: "sudo", title: "Superuser Power",
        description: "Execute commands with elevated (root) privileges.",
        explanation: "`sudo` runs as root. With great power comes great responsibility — always know what you're running.",
        syntax: "sudo command",
        examples: [{ cmd: "sudo chmod 600 /etc/ssh/sshd_config", out: "(permissions set, root only)" }],
        mission: "Secure the SSH config — only root should read it.",
        missionTask: "Use sudo to chmod 600 on `/etc/ssh/sshd_config`.",
        validate: (input) => input.includes("sudo") && input.includes("chmod") && input.includes("600") && input.includes("sshd_config"),
        simulatedOutput: "(sudo) /etc/ssh/sshd_config permissions set to 600 (rw-------)",
        hint: "sudo chmod 600 /etc/ssh/sshd_config",
        xp: 60,
      },
    ],
  },
];

// ─── GAME MISSION SCENARIOS ───────────────────────────────────────────────────
// Each scenario is a COMPLETE, self-consistent bundle.
// Every filename, logfile, process name, and directory reference is shared
// across all steps — so what step 2 shows, step 3 references correctly.

const GM1_SCENARIOS = [
  {
    // Scenario A
    dir: "/home/agent_zero",
    lsOutput: "logs/  .hidden_proc  suspects.txt  README.md",
    briefingFile: "README.md",
    briefingContent: "CLASSIFIED\nTarget process: ghost_daemon\nLog file: logs/ghost.log\nTerminate on sight.",
    logFile: "logs/ghost.log",
    processName: "ghost_daemon",
    grepOutput: "[ERROR] ghost_daemon: unauthorized access from 192.168.1.99\n[ERROR] ghost_daemon: exfiltrating data to remote...",
    errorCount: "      42",
  },
  {
    // Scenario B
    dir: "/var/ops/staging",
    lsOutput: "ops/  .shadow  intel.txt  BRIEFING.md",
    briefingFile: "BRIEFING.md",
    briefingContent: "TOP SECRET\nTarget process: shadow_proc\nLog file: ops/shadow.log\nDisconnect and wipe.",
    logFile: "ops/shadow.log",
    processName: "shadow_proc",
    grepOutput: "[ERROR] shadow_proc: port scan detected from 10.0.0.44\n[ERROR] shadow_proc: privilege escalation attempt...",
    errorCount: "      17",
  },
  {
    // Scenario C
    dir: "/srv/recon",
    lsOutput: "data/  .keystore  targets.txt  MISSION.md",
    briefingFile: "MISSION.md",
    briefingContent: "EYES ONLY\nTarget process: keylogger_daemon\nLog file: data/keylog.log\nTerminate and report.",
    logFile: "data/keylog.log",
    processName: "keylogger_daemon",
    grepOutput: "[ERROR] keylogger_daemon: keystrokes captured, 3842 bytes\n[ERROR] keylogger_daemon: data sent to 185.220.101.5",
    errorCount: "      83",
  },
];

const GM2_SCENARIOS = [
  {
    // Scenario A
    evidenceFiles: "./case1/fingerprint.evidence\n./case2/dna.evidence\n./archive/records.evidence",
    firstEvidenceFile: "case1/fingerprint.evidence",
    evidenceContent: "Subject: Unknown\nMatch: 87% — John_D\nTime: 02:34 AM\nLocation: Server Room B",
    suspectsFile: "suspects.txt",
    suspectsSorted: "Agent_X\nJohn_D\nMystery_User\nShadow_99",
    suspectsDeduped: "Agent_X\nJohn_D\nMystery_User\nShadow_99\n(3 duplicates removed)",
    reportFile: "final_report.txt",
    reportDoneMsg: "(final_report.txt saved — 4 unique suspects logged)",
  },
  {
    // Scenario B
    evidenceFiles: "./crime1/photo.evidence\n./crime2/audio.evidence\n./vault/ledger.evidence",
    firstEvidenceFile: "crime1/photo.evidence",
    evidenceContent: "Subject: Unknown\nAudio match: 94% — Agent_X\nTime: 11:58 PM\nLocation: Parking Garage C",
    suspectsFile: "suspects.txt",
    suspectsSorted: "Delta_V\nFoxhound\nNightOwl\nViper_Z",
    suspectsDeduped: "Delta_V\nFoxhound\nNightOwl\nViper_Z\n(5 duplicates removed)",
    reportFile: "output.txt",
    reportDoneMsg: "(output.txt saved — 4 suspects archived)",
  },
  {
    // Scenario C
    evidenceFiles: "./raid1/weapon.evidence\n./raid2/cash.evidence\n./lockup/witness.evidence",
    firstEvidenceFile: "raid1/weapon.evidence",
    evidenceContent: "Subject: Unknown\nWeapon serial: matches Shadow_99\nTime: 03:15 AM\nLocation: Data Center 7",
    suspectsFile: "suspects.txt",
    suspectsSorted: "Black_Ice\nCipher\nGhost\nZeroDay",
    suspectsDeduped: "Black_Ice\nCipher\nGhost\nZeroDay\n(2 duplicates removed)",
    reportFile: "results.txt",
    reportDoneMsg: "(results.txt saved — investigation complete)",
  },
];

const GM3_SCENARIOS = [
  {
    // Scenario A
    psOutput: "USER     PID  %CPU COMMAND\nroot       1   0.0 /sbin/init\nwww-data 892  94.2 python3 crypto_miner.py\nuser    1042   0.1 bash",
    roguePid: "892",
    rogueProcess: "crypto_miner.py",
    killConfirm: "(PID 892 terminated — CPU dropped from 94.2% to 0.1%)",
    chmodConfirm: "(sshd_config: permissions set to rw------- — root access only)",
    envOutput: "PATH=/usr/bin:/usr/local/bin\nUSER=root\nAWS_SECRET_KEY=EXPOSED_ak47x9\nDB_PASS=admin123 <- ROTATE THIS!",
    auditFile: "security_audit.txt",
    auditConfirm: "(security_audit.txt created — 892 incident logged)",
  },
  {
    // Scenario B
    psOutput: "USER     PID  %CPU COMMAND\nroot       1   0.0 /sbin/init\ndaemon  1337  91.7 node botnet_agent.js\nuser    2048   0.2 bash",
    roguePid: "1337",
    rogueProcess: "botnet_agent.js",
    killConfirm: "(PID 1337 terminated — botnet agent disconnected)",
    chmodConfirm: "(sshd_config: locked down — only root can read it now)",
    envOutput: "PATH=/usr/bin:/usr/local/bin\nUSER=root\nSTRIPE_KEY=sk_live_EXPOSED_9x2\nREDIS_URL=redis://:password@localhost <- CHANGE!",
    auditFile: "audit.log",
    auditConfirm: "(audit.log saved — 1337 incident documented for forensics)",
  },
  {
    // Scenario C
    psOutput: "USER     PID  %CPU COMMAND\nroot       1   0.0 /sbin/init\nwww-data 456  88.5 perl spam_relay.pl\nuser     789   0.1 bash",
    roguePid: "456",
    rogueProcess: "spam_relay.pl",
    killConfirm: "(PID 456 terminated — spam relay halted, outbound traffic dropped)",
    chmodConfirm: "(sshd_config: hardened — permissions 600 applied successfully)",
    envOutput: "PATH=/usr/bin:/usr/local/bin\nUSER=root\nGITHUB_TOKEN=ghp_EXPOSED_abc123\nDB_URL=postgres://admin:1234@db <- INSECURE!",
    auditFile: "env_snapshot.txt",
    auditConfirm: "(env_snapshot.txt written — incident report ready for review)",
  },
];

// Build one complete mission from a scenario, all steps fully consistent
const buildMission = (id, scenarioIndex) => {
  const templates = {
    gm1: { title: "Operation: Ghost Login", difficulty: "Easy", diffColor: "#00ff9d", xpReward: 150,
      story: "A suspicious process is running on the server. Locate the briefing file, read your orders, then track down the errors in the log." },
    gm2: { title: "Operation: Data Heist", difficulty: "Medium", diffColor: "#ffd700", xpReward: 250,
      story: "Evidence files have been scattered across the filesystem. Recover them, examine the first one, deduplicate the suspect list, and file your report." },
    gm3: { title: "Operation: Root Access", difficulty: "Hard", diffColor: "#ff2d55", xpReward: 400,
      story: "Production is under attack. Find the rogue process, terminate it, lock down SSH, check for exposed secrets, and save the audit trail." },
  };

  if (id === "gm1") {
    const s = GM1_SCENARIOS[scenarioIndex % GM1_SCENARIOS.length];
    return {
      id, ...templates.gm1, steps: [
        {
          instruction: `Check your current location on the server.`,
          canonicalCmd: "pwd",
          expectedOutput: s.dir,
          validate: (i) => matchCommandFamily(i, "pwd").pass,
          hint: "pwd",
        },
        {
          instruction: `List all files — look for anything suspicious.`,
          canonicalCmd: "ls",
          expectedOutput: s.lsOutput,
          validate: (i) => matchCommandFamily(i, "ls").pass,
          hint: "ls -la",
        },
        {
          instruction: `Read the briefing file \`${s.briefingFile}\` to get your orders.`,
          canonicalCmd: "cat",
          expectedOutput: s.briefingContent,
          validate: (i) => i.includes("cat") && i.includes(s.briefingFile.replace(".md","").replace(".txt","")),
          hint: `cat ${s.briefingFile}`,
        },
        {
          instruction: `Search \`${s.logFile}\` for ERROR entries.`,
          canonicalCmd: "grep",
          expectedOutput: s.grepOutput,
          validate: (i) => i.includes("grep") && i.includes("ERROR") && i.includes(s.logFile.split("/").pop().replace(".log","")),
          hint: `grep ERROR ${s.logFile}`,
        },
        {
          instruction: `Count exactly how many errors are in \`${s.logFile}\`.`,
          canonicalCmd: "grep",
          expectedOutput: s.errorCount,
          validate: (i) => i.includes("grep") && i.includes("ERROR") && i.includes("wc"),
          hint: `grep ERROR ${s.logFile} | wc -l`,
        },
      ],
    };
  }

  if (id === "gm2") {
    const s = GM2_SCENARIOS[scenarioIndex % GM2_SCENARIOS.length];
    return {
      id, ...templates.gm2, steps: [
        {
          instruction: `Find all .evidence files scattered in the directory tree.`,
          canonicalCmd: "find",
          expectedOutput: s.evidenceFiles,
          validate: (i) => i.includes("find") && i.includes(".evidence"),
          hint: "find . -name '*.evidence'",
        },
        {
          instruction: `Read the first evidence file: \`${s.firstEvidenceFile}\`.`,
          canonicalCmd: "cat",
          expectedOutput: s.evidenceContent,
          validate: (i) => i.includes("cat") && i.includes(s.firstEvidenceFile.split("/").pop().replace(".evidence","")),
          hint: `cat ${s.firstEvidenceFile}`,
        },
        {
          instruction: `Sort \`${s.suspectsFile}\` alphabetically to organize the data.`,
          canonicalCmd: "sort",
          expectedOutput: s.suspectsSorted,
          validate: (i) => i.includes("sort") && i.includes("suspects"),
          hint: `sort ${s.suspectsFile}`,
        },
        {
          instruction: `Remove duplicate entries from \`${s.suspectsFile}\` — intel may have repeats.`,
          canonicalCmd: "sort",
          expectedOutput: s.suspectsDeduped,
          validate: (i) => i.includes("sort") && i.includes("uniq"),
          hint: `sort ${s.suspectsFile} | uniq`,
        },
        {
          instruction: `Save the clean deduplicated list to \`${s.reportFile}\` using redirection.`,
          canonicalCmd: "sort",
          expectedOutput: s.reportDoneMsg,
          validate: (i) => i.includes("sort") && i.includes(">") && i.includes(s.reportFile.replace(".txt","")),
          hint: `sort ${s.suspectsFile} | uniq > ${s.reportFile}`,
        },
      ],
    };
  }

  if (id === "gm3") {
    const s = GM3_SCENARIOS[scenarioIndex % GM3_SCENARIOS.length];
    return {
      id, ...templates.gm3, steps: [
        {
          instruction: `List ALL running processes — identify the rogue one.`,
          canonicalCmd: "ps",
          expectedOutput: s.psOutput,
          validate: (i) => i.includes("ps") && (i.includes("aux") || i.includes("-aux") || i.includes("-ef")),
          hint: "ps aux",
        },
        {
          instruction: `Force kill the rogue \`${s.rogueProcess}\` process (PID ${s.roguePid}).`,
          canonicalCmd: "kill",
          expectedOutput: s.killConfirm,
          validate: (i) => i.includes("kill") && i.includes("-9") && i.includes(s.roguePid),
          hint: `kill -9 ${s.roguePid}`,
        },
        {
          instruction: `Lock down the SSH config so only root can read it (chmod 600).`,
          canonicalCmd: "chmod",
          expectedOutput: s.chmodConfirm,
          validate: (i) => i.includes("chmod") && i.includes("600") && i.includes("ssh"),
          hint: "sudo chmod 600 /etc/ssh/sshd_config",
        },
        {
          instruction: `Audit environment variables — check for any exposed secrets.`,
          canonicalCmd: "env",
          expectedOutput: s.envOutput,
          validate: (i) => i.trim() === "env" || i.trim() === "printenv",
          hint: "env",
        },
        {
          instruction: `Save the environment audit to \`${s.auditFile}\` using output redirection.`,
          canonicalCmd: "env",
          expectedOutput: s.auditConfirm,
          validate: (i) => i.includes("env") && i.includes(">") && i.includes(s.auditFile.replace(".txt","").replace(".log","")),
          hint: `env > ${s.auditFile}`,
        },
      ],
    };
  }

  return null;
};

// Generate missions — pick scenario index from time-based seed (rotates every 30 min)
const generateMissions = () => {
  const idx = Math.floor(Date.now() / (1000 * 60 * 30)) % 3;
  // Each mission gets a different scenario so they don't all pick the same variant
  return [
    buildMission("gm1", idx),
    buildMission("gm2", (idx + 1) % 3),
    buildMission("gm3", (idx + 2) % 3),
  ];
};

// ─── BADGES ───────────────────────────────────────────────────────────────────
const BADGES = [
  { id: "first_command", label: "First Command", icon: "⚡", desc: "Typed your first Unix command" },
  { id: "beginner_done", label: "Navigator", icon: "🧭", desc: "Completed Beginner level" },
  { id: "explorer_done", label: "File Wrangler", icon: "📁", desc: "Completed Explorer level" },
  { id: "apprentice_done", label: "Search Wizard", icon: "🔍", desc: "Completed Apprentice level" },
  { id: "hacker_done", label: "Pipe Master", icon: "⚙️", desc: "Completed Hacker level" },
  { id: "expert_done", label: "Root Access", icon: "👑", desc: "Completed Expert level" },
  { id: "streak_3", label: "On Fire", icon: "🔥", desc: "Completed 3 lessons in a row" },
  { id: "no_hints", label: "No Hints", icon: "🎯", desc: "Completed a lesson without hints" },
  { id: "game_complete", label: "Field Agent", icon: "🕵️", desc: "Completed a Game Mission" },
];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "terminalquest_v2";
const defaultState = () => ({
  xp: 0, completedLessons: [], completedLevels: [],
  completedMissions: [], badges: [], lastVisit: null,
  streak: 0, hintsUsed: {},
});
const loadState = () => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...defaultState(), ...JSON.parse(s) } : defaultState();
  } catch { return defaultState(); }
};
const saveState = (s) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
};

// ─── GENERIC COMMAND OUTPUTS ──────────────────────────────────────────────────
const GENERIC_OUTPUTS = {
  pwd: "/home/quest_user",
  ls: "missions/  logs/  config.txt  README.md  .secret_key",
  whoami: "quest_user",
  date: "Tue Mar 10 12:00:00 UTC 2026",
  uname: "Linux quest-terminal 5.15.0 x86_64 GNU/Linux",
  history: "  1  pwd\n  2  ls -la\n  3  cd missions\n  4  cat README.md",
  clear: "",
  env: "PATH=/usr/local/bin:/usr/bin\nHOME=/home/quest_user\nUSER=quest_user",
};

// ─── TERMINAL ─────────────────────────────────────────────────────────────────
function Terminal({ onSubmit, output, currentKey }) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [output]);
  useEffect(() => { inputRef.current?.focus(); setInput(""); }, [currentKey]);

  const submit = (cmd) => {
    setHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    onSubmit(cmd);
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && input.trim()) {
      submit(input.trim());
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const ni = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(ni);
      setInput(history[history.length - 1 - ni] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = Math.max(histIdx - 1, -1);
      setHistIdx(ni);
      setInput(ni === -1 ? "" : history[history.length - 1 - ni] || "");
    }
  };

  return (
    <div style={{
      background: "#060610", border: "1px solid #1a2a1a", borderRadius: 8,
      fontFamily: "'Courier New', monospace", boxShadow: "0 0 20px #00ff9d08",
    }}>
      <div style={{
        background: "#0c0c18", padding: "7px 14px", borderBottom: "1px solid #151525",
        display: "flex", alignItems: "center", gap: 7,
      }}>
        {["#ff2d55", "#ffd700", "#00ff9d"].map((c, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.75 }} />
        ))}
        <span style={{ color: "#2a3a2a", fontSize: 10, marginLeft: 6 }}>quest_user@terminal-quest ~</span>
      </div>
      <div style={{ minHeight: 130, maxHeight: 210, overflowY: "auto", padding: "10px 14px" }}>
        {output.map((line, i) => (
          <div key={i} style={{
            color: line.type === "cmd" ? "#00ff9d"
              : line.type === "success" ? "#00c8ff"
              : line.type === "error" ? "#ff4466"
              : line.type === "system" ? "#ffd700"
              : line.type === "warn" ? "#ff9955"
              : "#6a8090",
            fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {line.type === "cmd" ? `$ ${line.text}` : line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid #0f1520", padding: "9px 14px", gap: 8 }}>
        <span style={{ color: "#00ff9d", fontSize: 12 }}>$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="type your command and press Enter..."
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#ccddcc", fontFamily: "inherit", fontSize: 12, caretColor: "#00ff9d",
          }}
          autoComplete="off" autoCapitalize="off" spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── LESSON CARD ──────────────────────────────────────────────────────────────
function LessonCard({ lesson, levelColor, onComplete, isCompleted, onHint, hintsUsed }) {
  const [output, setOutput] = useState([
    { type: "system", text: `📋 ${lesson.mission}` },
    { type: "warn", text: `👉 ${lesson.missionTask}` },
  ]);
  const [done, setDone] = useState(isCompleted);
  const [showLearn, setShowLearn] = useState(false);
  const [hintCount, setHintCount] = useState(hintsUsed || 0);

  const handleSubmit = useCallback((cmd) => {
    setOutput((o) => [...o, { type: "cmd", text: cmd }]);
    const aliasCheck = lesson.command ? matchCommandFamily(cmd, lesson.command) : { pass: false, isAlias: false };

    if (lesson.validate(cmd) || aliasCheck.pass) {
      if (aliasCheck.isAlias) {
        setOutput((o) => [
          ...o,
          { type: "warn", text: `📚 FYI: "${aliasCheck.aliasUsed}" is an alias for "${aliasCheck.canonicalCmd}".` },
          { type: "warn", text: `   ${aliasCheck.note}` },
          { type: "warn", text: `   ✅ Task accepted — but learn "${aliasCheck.canonicalCmd}" for portability!` },
        ]);
      }
      setOutput((o) => [
        ...o,
        { type: "info", text: lesson.simulatedOutput },
        { type: "success", text: `✅ Correct! +${lesson.xp} XP earned` },
      ]);
      setDone(true);
      onComplete(lesson.id, hintCount === 0);
    } else if (isValidUnixCommand(cmd)) {
      const baseCmd = cmd.trim().split(" ")[0];
      const genericOut = GENERIC_OUTPUTS[baseCmd];
      if (genericOut) setOutput((o) => [...o, { type: "info", text: genericOut }]);
      setOutput((o) => [
        ...o,
        { type: "warn", text: `⚠️ That's a valid command, but not what this task needs.` },
        { type: "warn", text: `👉 ${lesson.missionTask}` },
      ]);
    } else {
      setOutput((o) => [
        ...o,
        { type: "error", text: `❌ "${cmd.trim().split(" ")[0]}" not recognised. Check the spelling and try again.` },
      ]);
    }
  }, [lesson, hintCount, onComplete]);

  const handleHint = () => {
    const nc = hintCount + 1;
    setHintCount(nc);
    onHint(lesson.id);
    setOutput((o) => [...o, { type: "system", text: `💡 Hint: ${lesson.hint}` }]);
  };

  return (
    <div style={{
      background: "white", borderRadius: 16, overflow: "hidden", marginBottom: 16,
      boxShadow: done ? `0 4px 20px ${levelColor}18` : "0 2px 12px rgba(0,0,0,0.06)",
      border: `1px solid ${done ? levelColor + "33" : "#e5e7eb"}`,
      transition: "all 0.3s",
    }}>
      {/* Card header */}
      <div style={{
        padding: "14px 18px",
        background: done ? `linear-gradient(135deg, ${levelColor}08, transparent)` : "#fafafa",
        borderBottom: `1px solid ${done ? levelColor + "18" : "#f3f4f6"}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <code style={{
              background: levelColor + "14", color: levelColor,
              padding: "3px 10px", borderRadius: 6, fontSize: 13, fontWeight: 800,
              border: `1px solid ${levelColor}25`, fontFamily: "'Courier New', monospace",
            }}>{lesson.command}</code>
            <span style={{ color: "#1e1b4b", fontSize: 15, fontWeight: 700 }}>{lesson.title}</span>
            {done && (
              <span style={{
                background: "#dcfce7", color: "#16a34a",
                fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10,
              }}>✓ Complete</span>
            )}
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>{lesson.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowLearn(!showLearn)} style={{
            background: showLearn ? levelColor + "14" : "white",
            border: `1px solid ${showLearn ? levelColor + "44" : "#e5e7eb"}`,
            color: showLearn ? levelColor : "#6b7280",
            padding: "6px 13px", borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontFamily: "inherit", fontWeight: 600, transition: "all 0.15s",
          }}>{showLearn ? "📖 Hide" : "📖 Learn"}</button>
          {!done && (
            <button onClick={handleHint} style={{
              background: "white", border: "1px solid #fde68a",
              color: "#b45309", padding: "6px 13px", borderRadius: 8,
              cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
            }}>💡 {hintCount > 0 ? `Hint (${hintCount})` : "Hint"}</button>
          )}
        </div>
      </div>

      {/* Learn panel */}
      {showLearn && (
        <div style={{
          padding: "16px 18px", background: "#f8f9ff",
          borderBottom: "1px solid #e5e7eb",
        }}>
          <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.8, margin: "0 0 12px" }}>{lesson.explanation}</p>
          <div style={{
            background: "#1e1b4b", borderRadius: 8, padding: "10px 14px",
            marginBottom: 10, fontFamily: "'Courier New', monospace",
          }}>
            <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Syntax</div>
            <code style={{ color: levelColor, fontSize: 13 }}>{lesson.syntax}</code>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lesson.examples.map((ex, i) => (
              <div key={i} style={{ background: "#1e1b4b", borderRadius: 7, padding: "8px 12px" }}>
                <code style={{ color: "#86efac", fontSize: 12, display: "block" }}>$ {ex.cmd}</code>
                <div style={{ color: "#6b7280", fontSize: 11, paddingLeft: 2, marginTop: 2 }}>{ex.out}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminal or done state */}
      <div style={{ padding: "14px 16px", background: done ? `${levelColor}04` : "white" }}>
        {done ? (
          <div style={{
            textAlign: "center", padding: "18px",
            background: "#f0fdf4", border: "1px solid #86efac",
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
            <div style={{ color: "#16a34a", fontSize: 14, fontWeight: 700 }}>Lesson complete! +{lesson.xp} XP earned</div>
          </div>
        ) : (
          <Terminal onSubmit={handleSubmit} output={output} currentKey={lesson.id} />
        )}
      </div>
    </div>
  );
}

// ─── GAME MODE ────────────────────────────────────────────────────────────────
function GameMode({ userState, onMissionComplete }) {
  const [missions] = useState(() => generateMissions());
  const [activeMission, setActiveMission] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [output, setOutput] = useState([]);
  const [missionDone, setMissionDone] = useState(false);
  const [stepsDone, setStepsDone] = useState([]);

  const startMission = (mission) => {
    setActiveMission(mission);
    setCurrentStep(0);
    setStepsDone([]);
    setMissionDone(false);
    setOutput([
      { type: "system", text: "======================================" },
      { type: "system", text: `  MISSION: ${mission.title.toUpperCase()}` },
      { type: "system", text: "======================================" },
      { type: "info", text: mission.story },
      { type: "system", text: "" },
      { type: "warn", text: `[STEP 1/${mission.steps.length}] ${mission.steps[0].instruction}` },
    ]);
  };

  const handleSubmit = useCallback((cmd) => {
    if (!activeMission || missionDone) return;
    const step = activeMission.steps[currentStep];
    setOutput((o) => [...o, { type: "cmd", text: cmd }]);

    // Alias check for educational feedback
    const aliasCheck = step.canonicalCmd ? matchCommandFamily(cmd, step.canonicalCmd) : { pass: false, isAlias: false };

    if (step.validate(cmd)) {
      if (aliasCheck.isAlias && aliasCheck.note) {
        setOutput((o) => [
          ...o,
          { type: "warn", text: `📚 FYI: \`${aliasCheck.aliasUsed}\` is an alias for \`${aliasCheck.canonicalCmd}\`.` },
          { type: "warn", text: `   ${aliasCheck.note}` },
          { type: "warn", text: `   Task passed — but use \`${aliasCheck.canonicalCmd}\` on unfamiliar systems.` },
        ]);
      }
      const newDone = [...stepsDone, currentStep];
      setStepsDone(newDone);
      setOutput((o) => [
        ...o,
        { type: "info", text: step.expectedOutput },
        { type: "success", text: `✓ Step ${currentStep + 1} complete!` },
      ]);
      const next = currentStep + 1;
      if (next >= activeMission.steps.length) {
        setMissionDone(true);
        setOutput((o) => [
          ...o,
          { type: "system", text: "" },
          { type: "success", text: `MISSION COMPLETE: ${activeMission.title}` },
          { type: "success", text: `+${activeMission.xpReward} XP earned!` },
        ]);
        onMissionComplete(activeMission.id, activeMission.xpReward);
      } else {
        setCurrentStep(next);
        setOutput((o) => [
          ...o,
          { type: "system", text: "" },
          { type: "warn", text: `[STEP ${next + 1}/${activeMission.steps.length}] ${activeMission.steps[next].instruction}` },
        ]);
      }
    } else if (isValidUnixCommand(cmd)) {
      const baseCmd = cmd.trim().split(" ")[0];
      const genericOut = GENERIC_OUTPUTS[baseCmd];
      if (genericOut) setOutput((o) => [...o, { type: "info", text: genericOut }]);
      setOutput((o) => [...o, { type: "warn", text: `-> [STEP ${currentStep + 1}] ${step.instruction}` }]);
    } else {
      setOutput((o) => [...o, { type: "error", text: `bash: ${cmd.trim().split(" ")[0]}: command not found` }]);
    }
  }, [activeMission, currentStep, missionDone, stepsDone, onMissionComplete]);

  const handleHint = () => {
    if (!activeMission) return;
    setOutput((o) => [...o, { type: "system", text: `HINT: ${activeMission.steps[currentStep].hint}` }]);
  };

  if (!activeMission) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "#ffd700", fontSize: 18, fontWeight: 900, marginBottom: 6 }}>🎮 Game Mode — Field Missions</div>
          <p style={{ color: "#445566", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            Multi-step narrative missions. Use real Unix commands to complete objectives.
            Missions rotate every 30 minutes — different outputs, scenarios, and file names every time.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {missions.filter(Boolean).map((mission) => {
            const isCompleted = userState.completedMissions?.includes(mission.id);
            return (
              <div key={mission.id} style={{
                background: "#0b0b18",
                border: `1px solid ${isCompleted ? mission.diffColor + "44" : "#141428"}`,
                borderRadius: 12, overflow: "hidden", cursor: "pointer", transition: "border-color 0.2s",
              }}
                onClick={() => startMission(mission)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = mission.diffColor + "55"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = isCompleted ? mission.diffColor + "44" : "#141428"; }}
              >
                <div style={{
                  background: `linear-gradient(135deg, ${mission.diffColor}0e, transparent)`,
                  padding: "14px 16px", borderBottom: `1px solid ${mission.diffColor}0e`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{
                      color: mission.diffColor, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: 1.5, border: `1px solid ${mission.diffColor}33`, padding: "2px 8px", borderRadius: 4,
                    }}>{mission.difficulty}</span>
                    {isCompleted && <span style={{ color: mission.diffColor, fontSize: 11 }}>✓ played · replay?</span>}
                  </div>
                  <div style={{ color: "#ccd", fontSize: 15, fontWeight: 700 }}>{mission.title}</div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <p style={{ color: "#445566", fontSize: 11, lineHeight: 1.6, margin: "0 0 10px" }}>{mission.story}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ color: "#2a3a3a", fontSize: 10 }}>{mission.steps.length} steps</span>
                    <span style={{ color: "#ffd700", fontSize: 11 }}>⚡ +{mission.xpReward} XP</span>
                  </div>
                  <button style={{
                    width: "100%", background: `${mission.diffColor}10`, border: `1px solid ${mission.diffColor}33`,
                    color: mission.diffColor, padding: "7px", borderRadius: 6, cursor: "pointer",
                    fontSize: 11, fontWeight: 700, fontFamily: "'Courier New', monospace",
                  }}>▶ {isCompleted ? "Replay Mission" : "Start Mission"}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setActiveMission(null)} style={{
          background: "transparent", border: "1px solid #1a2030", color: "#445566",
          padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
        }}>← Missions</button>
        <div>
          <div style={{ color: "#ccd", fontWeight: 700, fontSize: 14 }}>{activeMission.title}</div>
          <div style={{ color: "#334455", fontSize: 11 }}>Step {Math.min(currentStep + 1, activeMission.steps.length)}/{activeMission.steps.length}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {activeMission.steps.map((_, i) => (
            <div key={i} style={{
              width: 26, height: 4, borderRadius: 2,
              background: stepsDone.includes(i) ? activeMission.diffColor : i === currentStep ? activeMission.diffColor + "55" : "#141428",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      </div>
      <Terminal onSubmit={handleSubmit} output={output} currentKey={`${activeMission.id}-${currentStep}`} />
      {!missionDone && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleHint} style={{
            background: "transparent", border: "1px solid #221f10", color: "#665533",
            padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
          }}>💡 Hint</button>
        </div>
      )}
      {missionDone && (
        <div style={{
          marginTop: 14, padding: 20, textAlign: "center",
          border: `1px solid ${activeMission.diffColor}2a`, borderRadius: 10, background: `${activeMission.diffColor}06`,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ color: activeMission.diffColor, fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Mission Complete!</div>
          <div style={{ color: "#ffd700", fontSize: 13, marginBottom: 16 }}>+{activeMission.xpReward} XP earned</div>
          <button onClick={() => setActiveMission(null)} style={{
            background: `${activeMission.diffColor}18`, border: `1px solid ${activeMission.diffColor}44`,
            color: activeMission.diffColor, padding: "9px 24px", borderRadius: 7, cursor: "pointer",
            fontWeight: 700, fontFamily: "'Courier New', monospace", fontSize: 12,
          }}>← Choose Next Mission</button>
        </div>
      )}
    </div>
  );
}


// ─── THEORY CONTENT ───────────────────────────────────────────────────────────
const THEORY_CHAPTERS = [
  {
    id: "what-is-linux",
    emoji: "🐧",
    title: "What is Linux?",
    color: "#6c63ff",
    sections: [
      {
        heading: "Linux is an operating system — just like Windows or macOS",
        body: "When you turn on a computer, you need software to manage everything — your files, apps, screen, keyboard. That software is called an Operating System (OS). Windows and macOS are the most familiar ones. Linux is another OS, and it powers most of the world's servers, smartphones (Android is built on Linux), smart TVs, and even space stations.",
      },
      {
        heading: "Why should I learn Linux?",
        body: "Nearly every website, app, and cloud service you use runs on a Linux server. If you want to work in tech — as a developer, data analyst, DevOps engineer, or security researcher — Linux is unavoidable. Even for everyday power users, knowing Linux gives you more control over your computer than any GUI ever could.",
      },
      {
        heading: "Linux is free and open source",
        body: "Unlike Windows (which costs money) or macOS (which only runs on Apple hardware), Linux is completely free. Anyone can download it, modify it, and distribute it. This is why there are hundreds of \"flavors\" of Linux — called distributions or distros — like Ubuntu, Fedora, Debian, and Arch.",
      },
      {
        heading: "The Terminal: Linux's superpower",
        body: "Most people are used to clicking icons and buttons. Linux also has graphical interfaces, but its real power lies in the terminal — a text-based way to communicate with the computer. Instead of clicking, you type commands. It sounds scary at first, but it's actually faster, more precise, and more powerful than any GUI once you get the hang of it.",
      },
    ],
  },
  {
    id: "filesystem",
    emoji: "📁",
    title: "The Linux Filesystem",
    color: "#00c8ff",
    sections: [
      {
        heading: "Everything is a file",
        body: "In Linux, almost everything is treated as a file — your documents, your music, your keyboard, your hard drive, even running programs. This unified design makes Linux extremely consistent and programmable.",
      },
      {
        heading: "The directory tree",
        body: "Linux organizes files in a tree structure. At the very top is the root directory, written as /. Everything on your system lives somewhere inside /. For example: /home/alice is Alice's personal folder. /etc holds system configuration files. /var/log holds system logs. /usr/bin holds programs you can run.",
      },
      {
        heading: "Your home directory",
        body: "Every user has a home directory — a personal space to store files. If your username is alice, your home is /home/alice. You can always refer to it with the shortcut ~. So cd ~ takes you home instantly, no matter where you are in the filesystem.",
      },
      {
        heading: "Absolute vs relative paths",
        body: "An absolute path starts from root: /home/alice/documents/report.txt — this always works no matter where you are. A relative path is relative to your current location: if you're already in /home/alice, you can just type documents/report.txt. Think of it like giving directions — absolute is like a full address, relative is like saying 'turn left at the corner'.",
      },
      {
        heading: "Hidden files",
        body: "Files whose names start with a dot (.) are hidden by default — for example .bashrc or .ssh. They're usually configuration files. To see them, use ls -la (the -a flag shows all files, including hidden ones).",
      },
    ],
  },
  {
    id: "terminal-basics",
    emoji: "⌨️",
    title: "Using the Terminal",
    color: "#00ff9d",
    sections: [
      {
        heading: "What is a shell?",
        body: "The terminal is the window. The shell is the program running inside it that reads your commands. The most common shell is Bash (Bourne Again Shell). When you type a command and press Enter, Bash interprets it and tells the OS what to do.",
      },
      {
        heading: "The command prompt",
        body: "When the terminal is ready for input, you'll see a prompt — usually something like: alice@mycomputer:~$. This tells you: your username (alice), your computer name (mycomputer), your current directory (~, which means home), and $ means you're a regular user (# means root/admin).",
      },
      {
        heading: "Anatomy of a command",
        body: "Most commands follow this pattern: command [options] [arguments]. For example: ls -la /home/alice. Here ls is the command, -la is the option (flags that change behavior), and /home/alice is the argument (what to act on). Options usually start with - for short form (-l) or -- for long form (--all).",
      },
      {
        heading: "Case sensitivity",
        body: "Linux is case-sensitive. This means File.txt, file.txt, and FILE.TXT are three completely different files. Commands are also case-sensitive — ls works but LS will give an error. Always pay attention to capitalization.",
      },
      {
        heading: "Keyboard shortcuts that save time",
        body: "Tab: auto-complete a command or filename. Up/Down arrows: navigate through your command history. Ctrl+C: cancel a running command. Ctrl+L: clear the terminal screen (same as typing clear). Ctrl+A: jump to the beginning of the line. Ctrl+E: jump to the end. These shortcuts will make you much faster.",
      },
      {
        heading: "Getting help",
        body: "Every command has a manual. Type man ls to read the full manual for the ls command. It can be long and technical, but the SYNOPSIS and DESCRIPTION sections are usually enough. You can also try ls --help for a shorter summary. Press Q to exit the manual.",
      },
    ],
  },
  {
    id: "users-permissions",
    emoji: "🔐",
    title: "Users & Permissions",
    color: "#ffd700",
    sections: [
      {
        heading: "Linux is a multi-user system",
        body: "Linux was designed from the ground up to support multiple users on the same machine simultaneously. Each user has their own files, settings, and permissions. This is why Linux is so widely used on servers — many people can connect and work at the same time without interfering.",
      },
      {
        heading: "The root user",
        body: "The root user is the superuser — the all-powerful administrator account. Root can read, write, and delete any file, install software, and change system settings. You should never work as root unless necessary. Instead, use sudo (super user do) to run a single command with root privileges: sudo apt update.",
      },
      {
        heading: "Understanding file permissions",
        body: "Every file has three permission sets: owner (the person who created it), group (a group of users), and others (everyone else). Each set has three permissions: r = read (view the file), w = write (modify it), x = execute (run it as a program). You can see permissions with ls -la — you'll see something like -rwxr-xr-- which is read left to right: file type, owner permissions, group permissions, others permissions.",
      },
      {
        heading: "chmod in plain English",
        body: "chmod changes who can do what with a file. chmod 755 script.sh means: owner can read+write+execute (7), group can read+execute (5), others can read+execute (5). The numbers come from adding: 4=read, 2=write, 1=execute. So 7 = 4+2+1 = full access. chmod +x file.sh simply adds the execute bit — making a script runnable.",
      },
    ],
  },
  {
    id: "processes",
    emoji: "⚙️",
    title: "Processes & Programs",
    color: "#ff6b35",
    sections: [
      {
        heading: "What is a process?",
        body: "Every time you run a program, Linux creates a process — a running instance of that program. Each process gets a unique ID called a PID (Process ID). Your browser, your text editor, your terminal — they're all processes running simultaneously.",
      },
      {
        heading: "Foreground vs background",
        body: "A foreground process occupies your terminal — you have to wait for it to finish before you can type another command. A background process runs independently — you can keep using the terminal. Add & at the end of a command to run it in the background: python server.py &. Use fg to bring it back to the foreground.",
      },
      {
        heading: "Viewing and killing processes",
        body: "ps aux shows all running processes with their PID, how much CPU and memory they're using, and what command started them. If a process is frozen or consuming too many resources, you can terminate it: kill PID sends a polite stop signal. kill -9 PID forces it to stop immediately — use this as a last resort.",
      },
      {
        heading: "Environment variables",
        body: "Environment variables are named values that processes can read — like settings passed to programs automatically. PATH is the most important one: it tells the shell where to look for programs when you type a command. Other common ones: HOME (your home directory), USER (your username), EDITOR (your preferred text editor). Type env to see them all.",
      },
    ],
  },
  {
    id: "pipes-redirection",
    emoji: "🔗",
    title: "Pipes & Redirection",
    color: "#ff2d55",
    sections: [
      {
        heading: "The Unix philosophy",
        body: "Unix was built around one elegant idea: build small tools that do one thing well, then combine them. The pipe | lets you chain commands together so the output of one becomes the input of the next. This philosophy means you can build powerful data pipelines from simple pieces.",
      },
      {
        heading: "Pipes in practice",
        body: "Example: cat server.log | grep ERROR | wc -l. This reads the log file (cat), filters only lines containing ERROR (grep), then counts those lines (wc -l). Three simple commands chained into a powerful query. You can chain as many as you need.",
      },
      {
        heading: "Output redirection",
        body: "> redirects a command's output to a file instead of the screen. ls > filelist.txt saves the directory listing to a file. >> appends to an existing file instead of overwriting: echo 'done' >> log.txt. This is how you create logs, save reports, or build configuration files from scripts.",
      },
      {
        heading: "Input redirection",
        body: "< feeds a file as input to a command. sort < names.txt is equivalent to cat names.txt | sort but slightly more efficient. This is useful when a program expects to read from the keyboard but you want it to read from a file instead.",
      },
      {
        heading: "Standard streams",
        body: "Every Linux program has three standard streams: stdin (standard input — where it reads from, usually keyboard), stdout (standard output — where it writes results, usually screen), stderr (standard error — where it writes errors). Redirection and pipes work by connecting these streams. 2> redirects errors: command 2> errors.txt.",
      },
    ],
  },
];

// ─── THEORY PAGE ─────────────────────────────────────────────────────────────
function TheoryPage({ onComplete }) {
  const [activeChapter, setActiveChapter] = useState(0);
  const [readChapters, setReadChapters] = useState(new Set([0]));
  const topRef = useRef(null);

  const chapter = THEORY_CHAPTERS[activeChapter];
  const isLast = activeChapter === THEORY_CHAPTERS.length - 1;

  const goToChapter = (idx) => {
    setActiveChapter(idx);
    setReadChapters(prev => new Set([...prev, idx]));
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const goNext = () => {
    if (!isLast) goToChapter(activeChapter + 1);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9ff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
        @keyframes pulse2 { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 70% { box-shadow: 0 0 0 10px rgba(99,102,241,0); } }
        .theory-section { animation: fadeUp 0.35s ease both; }
        .chapter-tab:hover { background: rgba(255,255,255,0.12) !important; }
        .nav-item:hover { transform: translateY(-1px); }
      `}</style>

      {/* Top nav */}
      <div ref={topRef} style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", height: 64, gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🐧</div>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Terminal Quest</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 0.5 }}>Linux Learning Path</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: "4px 14px", color: "rgba(255,255,255,0.5)", fontSize: 11,
          }}>
            {readChapters.size} / {THEORY_CHAPTERS.length} chapters read
          </div>
          <button onClick={onComplete} style={{
            background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)",
            color: "#a5b4fc", padding: "7px 16px", borderRadius: 8,
            cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
          }}>Skip to Practice →</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        padding: "40px 24px 60px",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 20, padding: "6px 16px", marginBottom: 20,
          }}>
            <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 600 }}>📚 Theory First — Practice Second</span>
          </div>
          <h1 style={{ color: "white", fontSize: 38, fontWeight: 900, margin: "0 0 14px", lineHeight: 1.15 }}>
            Understand Linux<br />
            <span style={{ background: "linear-gradient(90deg, #6366f1, #a78bfa, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Before You Touch the Terminal
            </span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, margin: "0 auto", maxWidth: 540, lineHeight: 1.7 }}>
            Don't worry — no experience needed. These short chapters explain everything in plain English. Finish all {THEORY_CHAPTERS.length} to unlock the hands-on practice.
          </p>

          {/* Chapter pill tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 32 }}>
            {THEORY_CHAPTERS.map((ch, i) => (
              <button key={ch.id} className="chapter-tab" onClick={() => goToChapter(i)} style={{
                background: activeChapter === i
                  ? `linear-gradient(135deg, ${ch.color}, ${ch.color}bb)`
                  : "rgba(255,255,255,0.07)",
                border: `1px solid ${activeChapter === i ? ch.color : "rgba(255,255,255,0.1)"}`,
                color: activeChapter === i ? "white" : "rgba(255,255,255,0.55)",
                padding: "8px 18px", borderRadius: 24, cursor: "pointer",
                fontSize: 13, fontFamily: "inherit", fontWeight: activeChapter === i ? 700 : 400,
                transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
              }}>
                {ch.emoji} {ch.title}
                {readChapters.has(i) && activeChapter !== i && (
                  <span style={{
                    background: "#10b981", color: "white", borderRadius: "50%",
                    width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900,
                  }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px 60px", display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* Chapter content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Chapter card */}
          <div style={{
            background: "white", borderRadius: "0 0 20px 20px",
            padding: "28px 32px 24px", marginBottom: 20,
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            borderTop: `5px solid ${chapter.color}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, fontSize: 30,
                background: chapter.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{chapter.emoji}</div>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5,
                  color: chapter.color, marginBottom: 4,
                }}>Chapter {activeChapter + 1} of {THEORY_CHAPTERS.length}</div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#1e1b4b" }}>{chapter.title}</h2>
              </div>
            </div>
          </div>

          {/* Sections */}
          {chapter.sections.map((sec, i) => (
            <div key={i} className="theory-section" style={{
              background: "white", borderRadius: 16, padding: "24px 28px",
              marginBottom: 14, boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
              borderLeft: `4px solid ${chapter.color}`,
              animationDelay: `${i * 0.07}s`,
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: chapter.color + "18",
                  color: chapter.color, fontSize: 12, fontWeight: 900, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
                }}>{i + 1}</div>
                <div>
                  <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800, color: "#1e1b4b" }}>
                    {sec.heading}
                  </h3>
                  <p style={{ margin: 0, fontSize: 15, color: "#4b5563", lineHeight: 1.85 }}>
                    {sec.body}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
            <button
              onClick={() => activeChapter > 0 && goToChapter(activeChapter - 1)}
              disabled={activeChapter === 0}
              style={{
                background: activeChapter === 0 ? "#f3f4f6" : "white",
                border: "2px solid #e5e7eb",
                color: activeChapter === 0 ? "#9ca3af" : "#374151",
                padding: "12px 24px", borderRadius: 12, cursor: activeChapter === 0 ? "default" : "pointer",
                fontSize: 14, fontWeight: 600, fontFamily: "inherit",
              }}
            >← Previous</button>

            {isLast ? (
              <button onClick={onComplete} style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", color: "white",
                padding: "14px 36px", borderRadius: 14, cursor: "pointer",
                fontSize: 16, fontWeight: 800, fontFamily: "inherit",
                boxShadow: "0 6px 24px rgba(99,102,241,0.45)",
                animation: "pulse2 2s infinite",
              }}>🚀 I'm Ready — Start Practising!</button>
            ) : (
              <button onClick={goNext} style={{
                background: `linear-gradient(135deg, ${chapter.color}, ${chapter.color}bb)`,
                border: "none", color: "white",
                padding: "12px 28px", borderRadius: 12, cursor: "pointer",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                boxShadow: `0 4px 16px ${chapter.color}44`,
              }}>Next Chapter →</button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 230, flexShrink: 0, position: "sticky", top: 84 }}>
          <div style={{
            background: "white", borderRadius: 16, padding: "18px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.07)", marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 14 }}>📖 Chapters</div>
            {THEORY_CHAPTERS.map((ch, i) => (
              <div key={ch.id} onClick={() => goToChapter(i)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                borderRadius: 10, marginBottom: 4, cursor: "pointer",
                background: activeChapter === i ? ch.color + "14" : "transparent",
                border: `1px solid ${activeChapter === i ? ch.color + "30" : "transparent"}`,
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 16 }}>{ch.emoji}</span>
                <span style={{
                  flex: 1, fontSize: 12, lineHeight: 1.3,
                  color: activeChapter === i ? "#1e1b4b" : "#6b7280",
                  fontWeight: activeChapter === i ? 700 : 400,
                }}>{ch.title}</span>
                {readChapters.has(i)
                  ? <span style={{ color: "#10b981", fontSize: 14 }}>✓</span>
                  : <span style={{ color: "#d1d5db", fontSize: 11 }}>○</span>}
              </div>
            ))}

            {readChapters.size >= THEORY_CHAPTERS.length && (
              <button onClick={onComplete} style={{
                marginTop: 12, width: "100%",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", color: "white", padding: "11px",
                borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              }}>🚀 Start Practising!</button>
            )}
          </div>

          <div style={{
            background: "linear-gradient(135deg, #1e1b4b, #312e81)",
            borderRadius: 16, padding: "18px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 10 }}>💡 Did you know?</div>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.75 }}>
              Over 96% of the world's top web servers run Linux. Learning it puts you in the same league as engineers who built the internet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LEVEL CARD ──────────────────────────────────────────────────────────────
function LevelCard({ level, userState, onSelect, isActive }) {
  const done = level.lessons.filter((l) => userState.completedLessons.includes(l.id)).length;
  const isCompleted = userState.completedLevels.includes(level.id);
  const hasWarning = level.prereqs.some((p) => !userState.completedLevels.includes(p));
  const pct = Math.round((done / level.lessons.length) * 100);

  return (
    <div onClick={() => onSelect(level.id)} style={{
      background: isActive ? "white" : "#f9fafb",
      border: `2px solid ${isActive ? level.color : "#e5e7eb"}`,
      borderRadius: 12, padding: "12px 14px", cursor: "pointer",
      transition: "all 0.15s", boxShadow: isActive ? `0 4px 16px ${level.color}22` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, fontSize: 14,
          background: level.color + "18", display: "flex", alignItems: "center", justifyContent: "center",
          color: level.color, flexShrink: 0,
        }}>{level.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: isActive ? "#1e1b4b" : "#374151", fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{level.title}</div>
          <div style={{ color: "#9ca3af", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{level.subtitle}</div>
        </div>
        {isCompleted && (
          <div style={{
            background: "#dcfce7", color: "#16a34a",
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
          }}>Done</div>
        )}
      </div>
      <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, marginBottom: 5 }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: level.color,
          borderRadius: 2, transition: "width 0.4s",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#9ca3af", fontSize: 10 }}>{done}/{level.lessons.length} lessons</span>
        <span style={{ color: level.color, fontSize: 10, fontWeight: 700 }}>{pct}%</span>
      </div>
      {hasWarning && !isCompleted && (
        <div style={{
          marginTop: 6, fontSize: 9, color: "#b45309", fontWeight: 600,
          padding: "2px 7px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6,
        }}>⚠ Complete earlier levels first</div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [userState, setUserState] = useState(loadState);
  const [activeLevel, setActiveLevel] = useState("beginner");
  const [view, setView] = useState("learn");
  const [appSection, setAppSection] = useState("theory");
  const [notification, setNotification] = useState(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  useEffect(() => { saveState(userState); }, [userState]);

  useEffect(() => {
    const last = userState.lastVisit;
    if (last) {
      const diff = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
      if (diff > 1) setShowWelcomeBack(true);
    }
    setUserState((s) => ({ ...s, lastVisit: new Date().toISOString() }));
  }, []);

  const showNotif = useCallback((msg, color = "#6366f1") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const awardBadge = useCallback((id) => {
    setUserState((s) => {
      if (s.badges.includes(id)) return s;
      const badge = BADGES.find((b) => b.id === id);
      if (badge) showNotif(`🏆 Badge unlocked: ${badge.label}`, "#f59e0b");
      return { ...s, badges: [...s.badges, id] };
    });
  }, [showNotif]);

  const handleLessonComplete = useCallback((lessonId, noHints) => {
    setUserState((prev) => {
      if (prev.completedLessons.includes(lessonId)) return prev;
      const lesson = LEVELS.flatMap((l) => l.lessons).find((l) => l.id === lessonId);
      const newCompleted = [...prev.completedLessons, lessonId];
      const newStreak = prev.streak + 1;
      let newLevels = [...prev.completedLevels];
      let bonus = 0;
      LEVELS.forEach((lvl) => {
        if (!newLevels.includes(lvl.id) && lvl.lessons.every((l) => newCompleted.includes(l.id))) {
          newLevels.push(lvl.id);
          bonus += lvl.xpReward;
          showNotif(`🎉 Level complete: ${lvl.title}!`, lvl.color);
          setTimeout(() => awardBadge(`${lvl.id}_done`), 500);
        }
      });
      showNotif(`+${lesson?.xp} XP earned!`);
      if (newCompleted.length === 1) setTimeout(() => awardBadge("first_command"), 300);
      if (newStreak >= 3) setTimeout(() => awardBadge("streak_3"), 600);
      if (noHints) setTimeout(() => awardBadge("no_hints"), 400);
      return { ...prev, xp: prev.xp + (lesson?.xp || 0) + bonus, completedLessons: newCompleted, completedLevels: newLevels, streak: newStreak };
    });
  }, [showNotif, awardBadge]);

  const handleHint = useCallback((lessonId) => {
    setUserState((s) => ({ ...s, hintsUsed: { ...s.hintsUsed, [lessonId]: (s.hintsUsed[lessonId] || 0) + 1 } }));
  }, []);

  const handleMissionComplete = useCallback((missionId, xpReward) => {
    setUserState((prev) => {
      if (prev.completedMissions?.includes(missionId)) return prev;
      showNotif(`🕵️ Mission complete! +${xpReward} XP`, "#f59e0b");
      setTimeout(() => awardBadge("game_complete"), 500);
      return { ...prev, xp: prev.xp + xpReward, completedMissions: [...(prev.completedMissions || []), missionId] };
    });
  }, [showNotif, awardBadge]);

  const currentLevel = LEVELS.find((l) => l.id === activeLevel);
  const totalLessons = LEVELS.reduce((a, l) => a + l.lessons.length, 0);
  const progressPct = Math.round((userState.completedLessons.length / totalLessons) * 100);

  if (appSection === "theory") {
    return <TheoryPage onComplete={() => setAppSection("practice")} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9ff", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1e1b4b" }}>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>

      {/* Toast */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 10000,
          background: "white", border: `2px solid ${notification.color}`,
          color: notification.color, padding: "11px 22px", borderRadius: 14,
          fontSize: 14, fontWeight: 700,
          boxShadow: `0 8px 32px ${notification.color}33`,
          animation: "slideIn 0.25s ease",
        }}>{notification.msg}</div>
      )}

      {/* Welcome back modal */}
      {showWelcomeBack && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15,12,41,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          animation: "fadeIn 0.3s ease",
        }}>
          <div style={{
            background: "white", borderRadius: 24, padding: "36px 40px",
            maxWidth: 420, width: "100%", textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>👋</div>
            <h2 style={{ margin: "0 0 8px", color: "#1e1b4b", fontSize: 24, fontWeight: 900 }}>Welcome back!</h2>
            <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}>
              Pick up right where you left off.
            </p>
            <div style={{ background: "#f8f9ff", borderRadius: 14, padding: "16px 20px", marginBottom: 16, textAlign: "left" }}>
              {[
                { icon: "⚡", label: "Total XP", value: `${userState.xp} XP`, color: "#f59e0b" },
                { icon: "✅", label: "Lessons done", value: userState.completedLessons.length, color: "#10b981" },
                { icon: "🏆", label: "Badges earned", value: userState.badges.length, color: "#6366f1" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                  <span style={{ color: "#6b7280", fontSize: 14 }}>{s.icon} {s.label}</span>
                  <span style={{ color: s.color, fontWeight: 800, fontSize: 15 }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div style={{
              background: "#fefce8", border: "1px solid #fde047",
              borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#713f12", marginBottom: 22, textAlign: "left",
            }}>
              💡 <strong>Tip:</strong> Try a warmup command before jumping into new lessons!
            </div>
            <button onClick={() => setShowWelcomeBack(false)} style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", color: "white", padding: "13px 36px",
              borderRadius: 12, cursor: "pointer", fontWeight: 800,
              fontSize: 15, fontFamily: "inherit", width: "100%",
              boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
            }}>Let's Continue! →</button>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <header style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
      }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", height: 64, gap: 16 }}>
          {/* Logo */}
          <div onClick={() => setAppSection("theory")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🐧</div>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Terminal Quest</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Linux Learning</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 280 }}>
            <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>⚡ {userState.xp} XP</span>
            <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>
              <div style={{
                height: "100%", width: `${Math.min(progressPct, 100)}%`,
                background: "linear-gradient(90deg, #6366f1, #a78bfa, #38bdf8)",
                borderRadius: 3, transition: "width 0.6s",
              }} />
            </div>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, whiteSpace: "nowrap" }}>{progressPct}%</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Nav */}
          <nav style={{ display: "flex", gap: 4 }}>
            {[
              { id: "learn", label: "📚 Learn", },
              { id: "game", label: "🎮 Missions", },
              { id: "dashboard", label: "🏆 Progress", },
            ].map((n) => (
              <button key={n.id} onClick={() => setView(n.id)} style={{
                background: view === n.id ? "rgba(255,255,255,0.15)" : "transparent",
                border: `1px solid ${view === n.id ? "rgba(255,255,255,0.25)" : "transparent"}`,
                color: view === n.id ? "white" : "rgba(255,255,255,0.5)",
                padding: "7px 16px", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontFamily: "inherit", fontWeight: view === n.id ? 700 : 400,
                transition: "all 0.15s",
              }}>{n.label}</button>
            ))}
          </nav>

          <button onClick={() => setAppSection("theory")} style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.55)", padding: "6px 13px", borderRadius: 8,
            cursor: "pointer", fontSize: 12, fontFamily: "inherit",
          }}>📖 Theory</button>
        </div>
      </header>

      {/* ─── MAIN ─── */}
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── LEARN MODE ── */}
        {view === "learn" && (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* Sidebar */}
            <div style={{ width: 210, flexShrink: 0 }}>
              <div style={{
                background: "white", borderRadius: 16, padding: "16px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
                  color: "#9ca3af", marginBottom: 12, paddingBottom: 10,
                  borderBottom: "1px solid #f3f4f6",
                }}>Select Level</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {LEVELS.map((lvl) => (
                    <LevelCard key={lvl.id} level={lvl} userState={userState} onSelect={setActiveLevel} isActive={activeLevel === lvl.id} />
                  ))}
                </div>
              </div>
            </div>

            {/* Lessons panel */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {currentLevel ? (
                <>
                  {/* Level header */}
                  <div style={{
                    background: "white", borderRadius: 16, padding: "20px 24px", marginBottom: 20,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                    borderTop: `4px solid ${currentLevel.color}`,
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, fontSize: 24,
                      background: currentLevel.color + "18",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{currentLevel.icon}</div>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ margin: "0 0 3px", fontSize: 20, fontWeight: 900, color: "#1e1b4b" }}>
                        {currentLevel.title}
                      </h2>
                      <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{currentLevel.subtitle}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: currentLevel.color, fontSize: 22, fontWeight: 900 }}>
                        {currentLevel.lessons.filter((l) => userState.completedLessons.includes(l.id)).length}
                        <span style={{ color: "#d1d5db", fontSize: 16 }}>/{currentLevel.lessons.length}</span>
                      </div>
                      <div style={{ color: "#9ca3af", fontSize: 11 }}>lessons done</div>
                    </div>
                  </div>

                  {currentLevel.lessons.map((lesson) => (
                    <LessonCard
                      key={lesson.id} lesson={lesson} levelColor={currentLevel.color}
                      onComplete={handleLessonComplete}
                      isCompleted={userState.completedLessons.includes(lesson.id)}
                      onHint={handleHint} hintsUsed={userState.hintsUsed[lesson.id] || 0}
                    />
                  ))}
                </>
              ) : (
                <div style={{
                  background: "white", borderRadius: 16, padding: 48, textAlign: "center",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
                  <p style={{ color: "#6b7280", fontSize: 15 }}>Select a level from the sidebar to begin.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GAME MODE ── */}
        {view === "game" && (
          <div style={{
            background: "white", borderRadius: 20, padding: "28px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          }}>
            <GameMode userState={userState} onMissionComplete={handleMissionComplete} />
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {view === "dashboard" && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total XP", value: userState.xp, color: "#f59e0b", icon: "⚡", bg: "#fef3c7" },
                { label: "Lessons Done", value: userState.completedLessons.length, color: "#10b981", icon: "✅", bg: "#dcfce7" },
                { label: "Badges Earned", value: userState.badges.length, color: "#6366f1", icon: "🏆", bg: "#ede9fe" },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "white", border: `1px solid ${s.color}22`,
                  borderRadius: 16, padding: "20px", textAlign: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: s.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, margin: "0 auto 12px",
                  }}>{s.icon}</div>
                  <div style={{ color: s.color, fontSize: 28, fontWeight: 900 }}>{s.value}</div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Level progress */}
            <div style={{
              background: "white", borderRadius: 16, padding: "24px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.05)", marginBottom: 20,
            }}>
              <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: "#1e1b4b" }}>📈 Level Progress</h3>
              {LEVELS.map((lvl) => {
                const done = lvl.lessons.filter((l) => userState.completedLessons.includes(l.id)).length;
                const pct = Math.round((done / lvl.lessons.length) * 100);
                return (
                  <div key={lvl.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{lvl.icon} {lvl.title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>{done}/{lvl.lessons.length} lessons</span>
                        {userState.completedLevels.includes(lvl.id) && (
                          <span style={{
                            background: "#dcfce7", color: "#16a34a",
                            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                          }}>Complete!</span>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4 }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, background: lvl.color,
                        borderRadius: 4, transition: "width 0.5s",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Badges */}
            <div style={{
              background: "white", borderRadius: 16, padding: "24px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.05)", marginBottom: 20,
            }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#1e1b4b" }}>🏆 Badges</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {BADGES.map((b) => {
                  const earned = userState.badges.includes(b.id);
                  return (
                    <div key={b.id} title={b.desc} style={{
                      padding: "7px 14px", borderRadius: 24, fontSize: 12, fontWeight: 600,
                      background: earned ? "#ede9fe" : "#f9fafb",
                      border: `1px solid ${earned ? "#a78bfa" : "#e5e7eb"}`,
                      color: earned ? "#6d28d9" : "#9ca3af",
                      transition: "all 0.2s",
                    }}>{b.icon} {b.label}</div>
                  );
                })}
              </div>
            </div>

            {/* Reset */}
            <div style={{ textAlign: "center" }}>
              <button onClick={() => {
                if (window.confirm("Reset all progress? This cannot be undone.")) {
                  const f = defaultState();
                  setUserState(f);
                  saveState(f);
                  setView("learn");
                  showNotif("Progress reset.", "#ef4444");
                }
              }} style={{
                background: "transparent", border: "1px solid #fca5a5",
                color: "#ef4444", padding: "8px 18px", borderRadius: 8,
                cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
              }}>⚠ Reset All Progress</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
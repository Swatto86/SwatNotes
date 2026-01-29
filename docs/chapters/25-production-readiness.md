# Chapter 25: Production Readiness

*Logging, monitoring, and long-term maintenance strategies*

Think of launching a desktop application like opening a restaurant. The grand opening isn't the finish line—it's the starting line. Your restaurant needs health inspectors (logging), customer feedback systems (error monitoring), maintenance schedules (graceful degradation), and contingency plans (disaster recovery). This chapter covers everything that happens *after* you ship version 1.0.

Production readiness isn't about writing more features—it's about ensuring the features you've built remain reliable, debuggable, and maintainable over months and years. SwatNotes has been running in production for real users, and every pattern in this chapter comes from actual production incidents, user support requests, and long-term maintenance needs.

## The Observability Stack: Seeing What Users See

Your application is a black box from the user's perspective. When something goes wrong ("SwatNotes froze", "my search doesn't work", "reminder didn't fire"), you need visibility into what happened. This is observability: logging, metrics, and error tracking working together to illuminate the black box.

### The Three Pillars of Observability

```
Logs:     What happened, when, and why (narrative timeline)
Metrics:  How much, how fast, how often (quantitative data)
Traces:   Request flow through the system (distributed debugging)
```

SwatNotes uses **logs** (Rust tracing + TypeScript logger) and **metrics** (performance measurements). Distributed tracing isn't necessary for a desktop app (no network microservices), but understanding the pattern helps if you extend to cloud sync.

## Structured Logging with Tracing

SwatNotes uses Rust's `tracing` crate for structured, high-performance logging. Unlike `println!` debugging, tracing provides:

1. **Log levels**: Filter by severity (ERROR, WARN, INFO, DEBUG, TRACE)
2. **Structured data**: Attach fields to events (`user_id = "123"`)
3. **Spans**: Group related events (e.g., "database query" span)
4. **Performance**: Zero-cost when level is disabled

### Initialization: Setting Up the Subscriber

```rust
// From src-tauri/src/main.rs
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "swatnotes=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting SwatNotes application");

    // ... rest of app initialization
}
```

**What this does:**

1. **EnvFilter**: Read `RUST_LOG` environment variable for dynamic filtering
2. **Default filter**: `"swatnotes=debug,info"` means:
   - SwatNotes code logs DEBUG and above
   - Third-party crates log INFO and above (less noise)
3. **fmt::layer**: Pretty-print logs to stdout (console)
4. **registry**: Combine filters and formatters into subscriber

**Running with different log levels:**

```powershell
# Development: see everything
$env:RUST_LOG = "swatnotes=debug"
cargo run

# Production: only warnings and errors
$env:RUST_LOG = "warn"
./swatnotes.exe

# Debugging specific module
$env:RUST_LOG = "swatnotes::services::reminders=trace"
cargo run
```

### Log Levels: When to Use Each

| Level | Use Case | Example | Production? |
|-------|----------|---------|-------------|
| **ERROR** | Unrecoverable failures, data loss | `tracing::error!("Failed to save note {}: {}", id, e)` | ✅ Always visible |
| **WARN** | Recoverable issues, degraded functionality | `tracing::warn!("FTS rebuild failed, search may be slow")` | ✅ Always visible |
| **INFO** | Important state changes, lifecycle events | `tracing::info!("Backup scheduler started")` | ✅ Default in prod |
| **DEBUG** | Detailed execution flow, intermediate values | `tracing::debug!("Read blob: {} ({} bytes)", hash, len)` | ❌ Dev/troubleshooting only |
| **TRACE** | Extremely verbose, low-level operations | `tracing::trace!("Acquired mutex lock")` | ❌ Dev only |

**Mental model:**

- **ERROR**: "I couldn't do what the user asked, and this needs human intervention."
- **WARN**: "Something unexpected happened, but I worked around it."
- **INFO**: "Here's what I'm doing right now" (normal operation updates).
- **DEBUG**: "Here's why I did that" (context for developers).
- **TRACE**: "Here's every tiny step I took" (forensic detail).

### Structured Logging: Adding Context

```rust
// From src-tauri/src/services/notes.rs
pub async fn delete_note(&self, id: &str) -> Result<()> {
    // Log with context
    tracing::info!("Deleting note: {}", id);

    // Soft delete the note
    self.repo.soft_delete_note(id).await?;

    // Delete associated reminders
    if let Err(e) = self.repo.delete_reminders_for_note(id).await {
        // WARN level: reminders failed to delete but note is deleted
        tracing::warn!("Failed to delete reminders for note {}: {}", id, e);
    }

    // Delete from FTS index
    if let Err(e) = self.repo.delete_note_fts(id).await {
        // WARN level: FTS failed but note is still deleted
        tracing::warn!("Failed to delete note from FTS index: {}", e);
        // Don't fail the whole operation if FTS fails
    }

    tracing::info!("Note deleted successfully: {}", id);

    Ok(())
}
```

**Logging strategy breakdown:**

1. **INFO at start**: "Starting to delete note-123" (operation begins)
2. **WARN for failures**: Reminders/FTS deletion fails (graceful degradation)
3. **INFO at success**: "Note deleted successfully" (operation complete)

**Why two INFO logs?** Because when reading logs, you want to see both start and completion. If the second log is missing, you know something crashed between them.

### Logging in Async Contexts

Async tasks need special consideration:

```rust
// From src-tauri/src/app.rs
let app_handle = app.handle().clone();
tauri::async_runtime::spawn(async move {
    tracing::info!("Spawned background task for update check");
    
    match check_for_update_on_startup(app_handle).await {
        Ok(update_info) => {
            if update_info.available {
                tracing::warn!("Update available: {} -> {}", 
                    update_info.current_version, 
                    update_info.version
                );
            } else {
                tracing::info!("Application is up to date");
            }
        }
        Err(e) => {
            // WARN not ERROR: update check failing is not critical
            tracing::warn!(
                "Failed to check for updates: {}. Continuing without update check.",
                e
            );
        }
    }
});
```

**Pattern: Log task boundaries**

- Log when spawning task ("background task started")
- Log completion/failure ("task finished" or "task failed")
- Use context fields to track which task you're in

### Frontend Logging: TypeScript Logger

```typescript
// From src/utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN,
  timestamps: import.meta.env.DEV,
  enabled: true,
};

function formatMessage(level: string, context: string, message: string): string {
  const parts: string[] = [];

  if (config.timestamps) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  parts.push(`[${level}]`);

  if (context) {
    parts.push(`[${context}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

export const logger = {
  debug(message: string, context = '', data?: unknown) {
    if (!config.enabled || config.level > LogLevel.DEBUG) return;
    console.debug(formatMessage('DEBUG', context, message), data ?? '');
  },

  info(message: string, context = '', data?: unknown) {
    if (!config.enabled || config.level > LogLevel.INFO) return;
    console.info(formatMessage('INFO', context, message), data ?? '');
  },

  warn(message: string, context = '', data?: unknown) {
    if (!config.enabled || config.level > LogLevel.WARN) return;
    console.warn(formatMessage('WARN', context, message), data ?? '');
  },

  error(message: string, context = '', data?: unknown) {
    if (!config.enabled || config.level > LogLevel.ERROR) return;
    console.error(formatMessage('ERROR', context, message), data ?? '');
  },
};
```

**Usage in components:**

```typescript
// From src/components/noteEditor.ts
const LOG_CONTEXT = 'NoteEditor';

export async function createNoteEditor(noteId: string): Promise<NoteEditorInstance> {
  logger.debug(`Creating editor for note: ${noteId}`, LOG_CONTEXT);

  try {
    const note = await getNote(noteId);
    logger.info(`Loaded note: ${note.title}`, LOG_CONTEXT);

    // ... create Quill instance
    
    logger.debug(`Editor created successfully`, LOG_CONTEXT);
    return editor;
  } catch (error) {
    logger.error(`Failed to create editor`, LOG_CONTEXT, error);
    throw error;
  }
}
```

**Output in development console:**

```
[2026-01-29T14:23:45.123Z] [DEBUG] [NoteEditor] Creating editor for note: note-123
[2026-01-29T14:23:45.234Z] [INFO] [NoteEditor] Loaded note: My Budget
[2026-01-29T14:23:45.345Z] [DEBUG] [NoteEditor] Editor created successfully
```

**Production mode:** Only WARN and ERROR appear, no timestamps (cleaner).

### Log File Rotation: Preventing Disk Bloat

SwatNotes currently logs to stdout/stderr, which Tauri captures. For production apps with long uptimes, you need log rotation:

```rust
// Not currently in SwatNotes, but recommended for production
use tracing_subscriber::fmt::writer::MakeWriterExt;
use tracing_appender::rolling::{RollingFileAppender, Rotation};

fn main() {
    // Create rotating log files: swatnotes.log, swatnotes.log.1, etc.
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,  // Rotate every day
        app_data_dir.join("logs"),
        "swatnotes.log",
    );

    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env()
            .add_directive("swatnotes=info".parse().unwrap()))
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(file_appender.and(std::io::stdout))  // Both file and console
        )
        .init();
}
```

**Rotation strategies:**

- **DAILY**: New file each day (good for apps that run 24/7)
- **HOURLY**: New file each hour (high-volume logging)
- **SIZE**: New file when current exceeds size (e.g., 10 MB)

**Retention policy:** Delete logs older than 30 days to prevent unbounded disk usage.

## Graceful Degradation: When Features Fail

The mark of a production-ready application is not that nothing fails—it's that failures don't cascade. Graceful degradation means continuing with reduced functionality when non-critical components fail.

### Pattern 1: Optional Features

```rust
// From src-tauri/src/app.rs
let scheduler_service = match SchedulerService::new(backup_service.clone()).await {
    Ok(scheduler) => {
        tracing::info!("Scheduler service initialized successfully");
        Some(Arc::new(scheduler))
    }
    Err(e) => {
        tracing::error!("Failed to initialize scheduler service: {}", e);
        None  // App continues without automatic backups
    }
};

// Later, when using scheduler
if let Some(scheduler) = state.scheduler_service.as_ref() {
    scheduler.schedule_backup(frequency).await?;
} else {
    tracing::warn!("Scheduler not available, skipping backup schedule");
}
```

**Why this works:**

- Automatic backups are **nice to have**, not **must have**
- User can still create manual backups
- App doesn't crash on startup if scheduler fails to initialize

### Pattern 2: FTS Rebuild as Non-Critical

```rust
// From src-tauri/src/app.rs
// Rebuild FTS index to ensure all notes are properly indexed
if let Err(e) = db.rebuild_fts_index().await {
    tracing::warn!("Failed to rebuild FTS index: {}", e);
    // Don't fail startup if FTS rebuild fails
}
```

**Reasoning:**

1. FTS rebuild is expensive (can take seconds for 10k notes)
2. If it fails (e.g., corrupt note JSON), search still works (just missing some results)
3. Better to have a working app with degraded search than a crashed app

### Pattern 3: Update Check Failure

```rust
// From src-tauri/src/app.rs
Err(e) => {
    // If update check fails (no internet, etc.), show the main window and continue
    tracing::warn!(
        "Failed to check for updates: {}. Continuing without update check.",
        e
    );
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
}
```

**User experience:**

- No internet? App still opens (doesn't block on network)
- GitHub API down? App still opens
- Update server unreachable? App still opens

**Only block on critical failures:**
- Database corruption (can't store notes)
- Missing WebView2 (can't render UI)
- Invalid configuration (security risk)

### Pattern 4: Attachment Search Fallback

```rust
// From src-tauri/src/services/notes.rs
match self.repo.search_notes_by_attachment(query).await {
    Ok(attachment_note_ids) => {
        // Process attachment search results
    }
    Err(e) => {
        tracing::warn!("Failed to search attachments: {}", e);
        // Continue with FTS results even if attachment search fails
    }
}
```

**Two-phase search:** FTS search succeeds, attachment search fails → user gets partial results instead of error.

### Graceful Degradation Checklist

For each feature, ask:

- ✅ Can the app function without this feature?
- ✅ Is there a fallback (e.g., skip FTS, use basic search)?
- ✅ Do I log the degradation (warn user/developer)?
- ✅ Can the user manually retry later?

**Critical features (must work):**
- Database operations (creating/reading notes)
- Window rendering
- IPC communication

**Non-critical features (graceful failure):**
- Full-text search (fallback to basic filtering)
- Automatic backups (user can still manual backup)
- Update checks (user can manually check)
- System tray (window still accessible via taskbar)

## Error Monitoring: Learning from Failures

Logging tells you what happened. Error monitoring tells you *what keeps happening*. In production, you need to know:

1. **Most common errors**: Which errors affect the most users?
2. **Error frequency**: Is this a one-off or recurring issue?
3. **Error context**: What were users doing when it failed?

### Frontend Error Tracking

```typescript
// From src/utils/modal.ts
export async function showAlert(
  message: string,
  options: AlertOptions = {}
): Promise<void> {
  const { title = 'Alert', type = 'info' } = options;

  logger.info(`Showing ${type} alert: ${title} - ${message}`, 'Modal');

  // ... show modal UI
}
```

**Every user-facing error is logged:**

```typescript
// From src/main.ts
try {
  const note = await createNote(title, content);
  logger.info(`Created note: ${note.id}`, 'Main');
} catch (error) {
  logger.error('Failed to create note', 'Main', error);
  showAlert('Failed to create note. Please try again.', {
    title: 'Error',
    type: 'error',
  });
}
```

**Log output:**

```
[ERROR] [Main] Failed to create note {
  name: 'Error',
  message: 'Database is locked',
  stack: '...'
}
```

### Aggregating Errors for Analysis

In production, you'd send errors to a service like:

- **Sentry**: Error tracking with stack traces, breadcrumbs, user context
- **LogRocket**: Session replay showing what user did before error
- **Application Insights**: Azure-hosted error/performance monitoring

**Integration example (not in SwatNotes, but pattern to follow):**

```typescript
// Hypothetical error reporting
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: 'https://your-sentry-dsn',
  environment: import.meta.env.MODE,  // 'development' or 'production'
  beforeSend(event) {
    // Filter out sensitive data
    if (event.user) {
      delete event.user.ip_address;
    }
    return event;
  },
});

// In error handlers
try {
  await createNote(title, content);
} catch (error) {
  Sentry.captureException(error, {
    contexts: {
      note: {
        title_length: title.length,
        content_length: content.length,
      },
    },
  });
  logger.error('Failed to create note', 'Main', error);
  showAlert('Failed to create note.');
}
```

**What Sentry provides:**

- **Error grouping**: "Database locked" errors grouped together
- **Frequency**: How many users hit this error
- **Context**: What OS, app version, time of day
- **Stack traces**: Exact line where error originated

### Backend Error Tracking

```rust
// From src-tauri/src/services/scheduler.rs
match backup_service.create_backup(password).await {
    Ok(backup_path) => {
        tracing::info!("Automatic backup created: {:?}", backup_path);
        // Send success notification
    }
    Err(e) => {
        tracing::error!("Automatic backup failed: {}", e);
        // Send failure notification
        
        // Hypothetical: report to error tracking service
        // sentry::capture_error(&e);
    }
}
```

**For desktop apps, error reporting is tricky:**

- Users may not have internet (can't send errors)
- Privacy concerns (what if notes contain PII?)
- Crash reports need user consent

**Best practice:** Store errors locally, ask user to opt-in to sending crash reports.

## Health Checks: Proactive Monitoring

Health checks verify the application is functioning correctly, even when no errors are logged.

### Database Health Check

```rust
// Not in SwatNotes, but recommended pattern
pub async fn health_check(&self) -> Result<HealthStatus> {
    let mut status = HealthStatus {
        database: false,
        fts_index: false,
        blob_store: false,
    };

    // Check database connection
    match sqlx::query("SELECT 1")
        .execute(&self.pool)
        .await
    {
        Ok(_) => status.database = true,
        Err(e) => {
            tracing::error!("Database health check failed: {}", e);
        }
    }

    // Check FTS index
    match sqlx::query("SELECT count(*) FROM notes_fts")
        .execute(&self.pool)
        .await
    {
        Ok(_) => status.fts_index = true,
        Err(e) => {
            tracing::warn!("FTS health check failed: {}", e);
        }
    }

    // Check blob store
    if std::fs::metadata(&self.blob_store.root).is_ok() {
        status.blob_store = true;
    }

    Ok(status)
}
```

**When to run health checks:**

- **On startup**: Verify critical systems before showing UI
- **Periodically**: Every 5 minutes in background task
- **On user request**: "Check for issues" button in settings

**What to check:**

| Component | Health Indicator | Fix if Unhealthy |
|-----------|------------------|------------------|
| Database | `SELECT 1` succeeds | Recreate connection pool |
| FTS Index | Query doesn't error | Rebuild index |
| Blob Store | Directory exists and is writable | Create directory |
| Scheduler | Job count > 0 | Restart scheduler |
| Network | Ping update server | Show offline mode |

### Performance Metrics as Health Indicators

```rust
// Hypothetical performance tracking
pub async fn create_note_with_metrics(&self, title: String, content: String) -> Result<Note> {
    let start = std::time::Instant::now();
    
    let note = self.create_note(title, content).await?;
    
    let duration = start.elapsed();
    
    if duration > std::time::Duration::from_millis(100) {
        tracing::warn!(
            "Slow note creation: {} took {}ms",
            note.id,
            duration.as_millis()
        );
    }
    
    // Record metric
    metrics::histogram!("note_creation_duration_ms", duration.as_millis() as f64);
    
    Ok(note)
}
```

**Alerting thresholds:**

- Note creation >100ms: Database may be slow
- Search >500ms: FTS index may need rebuild
- Memory usage >500 MB: Memory leak suspected

## Version Management and Compatibility

As your app evolves, you need strategies for backward compatibility and migration.

### Database Migrations: Version Tracking

```rust
// From src-tauri/src/database/schema.rs
pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    // Track schema version in database
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        )",
    )
    .execute(pool)
    .await?;

    let current_version: Option<i32> = sqlx::query_scalar(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
    )
    .fetch_optional(pool)
    .await?;

    let current = current_version.unwrap_or(0);
    
    // Run migrations in order
    if current < 1 {
        run_migration_001(pool).await?;
    }
    if current < 2 {
        run_migration_002(pool).await?;
    }
    // ... more migrations

    Ok(())
}
```

**Migration best practices:**

1. **Never modify old migrations**: Create new migration to fix issues
2. **Test on copy of production data**: Catch migration bugs before users hit them
3. **Support rollback**: Have DOWN migrations or backups
4. **Version in filename**: `001_initial_schema.sql`, `002_add_collections.sql`

### Settings Migration: Graceful Updates

```rust
// From src-tauri/src/services/settings.rs
pub async fn load_settings(&self) -> Result<Settings> {
    match std::fs::read_to_string(&self.settings_path) {
        Ok(contents) => {
            let mut settings: Settings = serde_json::from_str(&contents)
                .map_err(|e| {
                    tracing::warn!("Failed to parse settings, using defaults: {}", e);
                    // Fall back to defaults if settings file is corrupt
                })?;

            // Migrate old settings format
            if settings.version < CURRENT_VERSION {
                settings = self.migrate_settings(settings)?;
                self.save_settings(&settings).await?;
            }

            Ok(settings)
        }
        Err(_) => {
            tracing::info!("Settings file not found, creating default settings");
            let settings = Settings::default();
            self.save_settings(&settings).await?;
            Ok(settings)
        }
    }
}

fn migrate_settings(&self, mut settings: Settings) -> Result<Settings> {
    match settings.version {
        1 => {
            // Version 1 → 2: Add new hotkey fields with defaults
            settings.hotkeys.quick_capture = "CommandOrControl+Shift+C".to_string();
            settings.version = 2;
        }
        2 => {
            // Version 2 → 3: Add auto-backup settings
            settings.auto_backup = AutoBackupSettings::default();
            settings.version = 3;
        }
        _ => {}
    }
    Ok(settings)
}
```

**Compatibility strategy:**

- **Add, don't remove**: New fields have `Option<T>` or defaults
- **Deprecate, then remove**: Warn for 2 versions before removing
- **Version number**: Track settings schema version

### Update Compatibility: Minimum Versions

```rust
// From src-tauri/src/commands/updater.rs
pub async fn check_for_update() -> Result<UpdateInfo> {
    let current_version = env!("CARGO_PKG_VERSION");
    
    // Fetch latest release
    let latest = fetch_github_release().await?;
    
    // Check if update is compatible
    if requires_clean_install(&latest) {
        return Err(AppError::Generic(
            "This update requires a clean install. Please download from the website.".into()
        ));
    }
    
    Ok(UpdateInfo {
        available: is_newer_version(current_version, &latest.version),
        version: latest.version,
        // ...
    })
}

fn requires_clean_install(release: &GithubRelease) -> bool {
    // Check release notes for "BREAKING:" tag
    release.body.contains("BREAKING:") || release.body.contains("Clean install required")
}
```

**Breaking change protocol:**

1. Mark release as "breaking" in release notes
2. Show modal: "This update changes the database format. Backup your data first."
3. User confirms, download proceeds
4. On first run, migrate data with progress bar

## User Support: Debugging in Production

When users report bugs, you need diagnostic information without access to their machine.

### Diagnostic Information Export

```rust
// Hypothetical diagnostic export command
#[tauri::command]
pub async fn export_diagnostic_info(state: State<'_, AppState>) -> Result<DiagnosticInfo> {
    Ok(DiagnosticInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        note_count: state.notes_service.count_notes().await?,
        attachment_count: state.attachments_service.count_attachments().await?,
        backup_count: state.backup_service.list_backups().await?.len(),
        database_size: get_file_size(&state.app_data_dir.join("db.sqlite"))?,
        last_error: get_last_error_from_log()?,
    })
}
```

**User flow:**

1. User clicks "Export Diagnostics" in Settings → About
2. App generates JSON file with non-sensitive data
3. User sends file to support email
4. Developer sees OS, version, database size, error logs

**Privacy considerations:**

- ❌ Never include note content/titles
- ❌ Never include full file paths (may contain username)
- ✅ Include app version, OS, error messages
- ✅ Include counts (# notes, # backups)
- ✅ Include anonymized stack traces

### Log Bundling for Support

```rust
#[tauri::command]
pub async fn bundle_logs_for_support(
    app_data_dir: PathBuf
) -> Result<PathBuf> {
    let logs_dir = app_data_dir.join("logs");
    let bundle_path = app_data_dir.join("support_logs.zip");

    // Create ZIP with last 7 days of logs
    let mut zip = ZipWriter::new(File::create(&bundle_path)?);
    
    for entry in std::fs::read_dir(&logs_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        // Only include recent logs
        if let Ok(metadata) = path.metadata() {
            if let Ok(modified) = metadata.modified() {
                let age = SystemTime::now().duration_since(modified)?;
                if age < Duration::from_secs(7 * 24 * 60 * 60) {
                    // Add to ZIP
                    let file = File::open(&path)?;
                    zip.start_file(path.file_name().unwrap().to_str().unwrap(), Default::default())?;
                    std::io::copy(&mut file, &mut zip)?;
                }
            }
        }
    }
    
    zip.finish()?;
    Ok(bundle_path)
}
```

**Support workflow:**

1. User reports: "Backups keep failing"
2. Support asks: "Can you export logs?"
3. User clicks "Export Logs" → support_logs.zip created
4. Developer inspects logs, finds: `ERROR: Failed to acquire mutex lock` (deadlock)
5. Fix released in next version

## Maintenance Strategies: Long-Term Sustainability

Production readiness isn't a one-time checklist—it's an ongoing practice.

### Dependency Updates: Staying Secure

```toml
# From src-tauri/Cargo.toml
[dependencies]
tauri = "2.1.1"
serde = { version = "1.0", features = ["derive"] }
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio-native-tls"] }
```

**Update cadence:**

- **Security patches**: Immediately (within 24 hours)
- **Minor versions**: Monthly (1.0.0 → 1.1.0)
- **Major versions**: Quarterly or when needed (1.x → 2.x)

**Tools for dependency management:**

```powershell
# Check for outdated dependencies
cargo outdated

# Update to latest compatible versions
cargo update

# Check for security vulnerabilities
cargo audit

# Update to latest versions (may break)
cargo upgrade
```

**Before updating:**

1. Read CHANGELOG for breaking changes
2. Run full test suite
3. Test critical user flows manually
4. Create backup of current working version

### Database Maintenance: VACUUM and ANALYZE

SQLite databases fragment over time. Periodic maintenance keeps them fast:

```rust
// Hypothetical maintenance task
pub async fn run_database_maintenance(&self) -> Result<()> {
    tracing::info!("Starting database maintenance");

    // VACUUM: Rebuild database file, reclaim space
    sqlx::query("VACUUM")
        .execute(&self.pool)
        .await?;
    
    // ANALYZE: Update query planner statistics
    sqlx::query("ANALYZE")
        .execute(&self.pool)
        .await?;

    tracing::info!("Database maintenance complete");
    Ok(())
}
```

**When to run:**

- **VACUUM**: Monthly or after deleting many notes (frees disk space)
- **ANALYZE**: Weekly or after schema changes (optimizes queries)

**User experience:** Run during idle time (no user activity for 5 minutes) or show "Optimizing database..." progress bar.

### Blob Store Garbage Collection

SwatNotes doesn't currently garbage collect blobs (files remain even if no attachments reference them). For long-term production:

```rust
pub async fn collect_garbage(&self) -> Result<usize> {
    let mut deleted_count = 0;

    // Get all blob hashes referenced by attachments
    let referenced_hashes: HashSet<String> = self.repo
        .list_all_attachment_hashes()
        .await?
        .into_iter()
        .collect();

    // Walk blob store directory
    for entry in walkdir::WalkDir::new(&self.blob_store.root) {
        let entry = entry?;
        if entry.file_type().is_file() {
            let hash = entry.file_name().to_str().unwrap();
            
            // Delete unreferenced blobs
            if !referenced_hashes.contains(hash) {
                std::fs::remove_file(entry.path())?;
                deleted_count += 1;
                tracing::info!("Deleted orphaned blob: {}", hash);
            }
        }
    }

    tracing::info!("Garbage collection complete: {} blobs deleted", deleted_count);
    Ok(deleted_count)
}
```

**Safety:** Only delete blobs that haven't been accessed in 30+ days (user might be restoring old backup).

### Crash Recovery: Graceful Restarts

When SwatNotes crashes (power loss, system crash), ensure it recovers cleanly:

```rust
// From src-tauri/src/app.rs
pub async fn new(app_data_dir: PathBuf) -> Result<Self> {
    // Check for crash recovery marker
    let crash_marker = app_data_dir.join(".crash_recovery");
    if crash_marker.exists() {
        tracing::warn!("Detected previous crash, running recovery");
        
        // Recover database from WAL file
        let db_path = app_data_dir.join("db.sqlite");
        recover_database_from_wal(&db_path).await?;
        
        // Clear crash marker
        std::fs::remove_file(&crash_marker)?;
    }

    // Create new crash marker (removed on clean shutdown)
    std::fs::write(&crash_marker, "crash")?;

    // ... rest of initialization
}

pub fn on_clean_shutdown(&self) {
    let crash_marker = self.app_data_dir.join(".crash_recovery");
    let _ = std::fs::remove_file(&crash_marker);
}
```

**SQLite WAL recovery:**

SQLite's Write-Ahead Log (WAL) mode automatically recovers from crashes. When you open the database, pending transactions are replayed from the WAL file.

### Feature Flags: Gradual Rollouts

For risky features, use feature flags to enable for subset of users:

```rust
// Hypothetical feature flag system
#[derive(Default)]
pub struct FeatureFlags {
    pub cloud_sync: bool,
    pub ai_tagging: bool,
    pub beta_features: bool,
}

impl FeatureFlags {
    pub fn load() -> Self {
        // Read from settings or environment
        let beta_enabled = std::env::var("SWATNOTES_BETA").is_ok();
        
        Self {
            cloud_sync: false,  // Not ready yet
            ai_tagging: beta_enabled,
            beta_features: beta_enabled,
        }
    }
}

// In commands
#[tauri::command]
pub async fn sync_to_cloud(state: State<'_, AppState>) -> Result<()> {
    if !state.feature_flags.cloud_sync {
        return Err(AppError::Generic("Cloud sync is not enabled".into()));
    }
    
    // ... cloud sync logic
}
```

**Gradual rollout strategy:**

1. **Week 1**: Enable for developers only (`SWATNOTES_BETA=1`)
2. **Week 2**: Enable for opt-in beta testers (checkbox in settings)
3. **Week 3**: Enable for 10% of users (randomized user ID)
4. **Week 4**: Enable for everyone if no critical bugs

## Deployment Checklist: Going to Production

Before releasing to users:

### Pre-Release Testing

- ✅ Run full test suite: `cargo test`, `npm test`, `npm run test:e2e`
- ✅ Manual smoke test: Create note, search, backup, restore, update, delete
- ✅ Test on clean machine: Fresh Windows install, no dev tools
- ✅ Test offline mode: Disable internet, verify graceful degradation
- ✅ Test with large dataset: 10,000 notes, 1,000 attachments
- ✅ Performance profiling: Startup time <1s, search <50ms, memory <300 MB
- ✅ Security audit: No hardcoded secrets, encryption enabled, input validation

### Release Artifacts

- ✅ Installer: `swatnotes_1.0.0_x64-setup.exe` (NSIS or MSI)
- ✅ Portable ZIP: For users without admin rights
- ✅ Code signature: EV or standard certificate (prevents SmartScreen)
- ✅ Checksums: SHA-256 hash for integrity verification
- ✅ Release notes: What's new, bug fixes, breaking changes

### Post-Release Monitoring

- ✅ Monitor error rates: First 24 hours are critical
- ✅ Track download counts: GitHub Releases analytics
- ✅ User feedback channels: Email, GitHub Issues, Discord
- ✅ Crash reports: Opt-in error reporting
- ✅ Performance metrics: Startup time, memory usage trends

### Rollback Plan

If release has critical bug:

1. **Yank release**: Mark GitHub Release as "pre-release" (hides from updater)
2. **Hotfix or revert**: Fix bug in new version or revert to previous
3. **Communicate**: Email users, post on GitHub, Discord announcement
4. **Root cause analysis**: Why didn't tests catch this?

## Production Incident Response

When things go wrong in production, have a playbook.

### Incident Severity Levels

| Level | Definition | Example | Response Time |
|-------|------------|---------|---------------|
| **P0** | Data loss, security breach | Notes deleted, password exposed | Immediate (drop everything) |
| **P1** | App unusable for all users | Crashes on startup | <1 hour |
| **P2** | Major feature broken | Search doesn't work | <4 hours |
| **P3** | Minor feature broken | Reminder sound doesn't play | <24 hours |
| **P4** | Cosmetic issue | Button misaligned | Next release |

### Incident Response Workflow

1. **Acknowledge**: "We're aware of the issue, investigating."
2. **Diagnose**: Collect logs, reproduce locally, identify root cause
3. **Mitigate**: Disable broken feature, rollback release, or hotfix
4. **Communicate**: Update users on progress
5. **Resolve**: Deploy fix, verify resolution
6. **Post-mortem**: What happened, why, how to prevent

**Example incident:**

```
[P1] App crashes when opening notes with more than 1000 characters in title

Timeline:
- 14:00: User reports crash
- 14:05: Reproduced locally (long title → buffer overflow in title_modified check)
- 14:10: Identified fix (truncate title to 255 chars)
- 14:20: Hotfix released as v1.0.1
- 14:30: Verified fix with user
- 15:00: Post-mortem written

Root cause: Missing validation on title length
Prevention: Add title length validation, add test case for long titles
```

## Key Takeaways

**Logging:**
- Use structured logging with levels (ERROR, WARN, INFO, DEBUG)
- Log task boundaries (start/end) for async operations
- Different log levels for dev (DEBUG) and production (INFO)
- Rotate log files to prevent disk bloat

**Graceful Degradation:**
- Non-critical features should fail gracefully (Option<T> pattern)
- Log degradation events (WARN level)
- FTS, update checks, scheduler can fail without crashing app
- User can still use core features (create/edit notes)

**Error Monitoring:**
- Log all user-facing errors with context
- Aggregate errors to identify patterns
- Use error tracking services (Sentry, LogRocket) for production
- Respect user privacy (no PII in error reports)

**Health Checks:**
- Verify critical systems on startup (database, blob store)
- Periodic health checks in background (every 5 minutes)
- Performance metrics as health indicators (slow = unhealthy)

**Version Management:**
- Track schema versions, migrate gracefully
- Settings migration for backward compatibility
- Deprecate before removing (warn for 2 versions)
- Support rollback (backups, DOWN migrations)

**User Support:**
- Export diagnostic info (version, counts, errors)
- Bundle logs for support (last 7 days)
- Privacy-first (no note content, no PII)

**Maintenance:**
- Update dependencies regularly (security patches immediately)
- Database maintenance (VACUUM monthly, ANALYZE weekly)
- Garbage collection (delete orphaned blobs)
- Crash recovery (WAL replay)

**Deployment:**
- Pre-release testing checklist
- Monitor first 24 hours closely
- Have rollback plan ready
- Incident response workflow (P0-P4)

---

**You've completed the book!** From zero knowledge to production-ready desktop app, you've learned:

- Rust fundamentals (ownership, borrowing, async)
- Tauri architecture (IPC, plugins, state management)
- SQLite optimization (FTS5, indexes, batch queries)
- Frontend patterns (vanilla TypeScript, Quill.js, event handling)
- Production features (encryption, backups, auto-updates, reminders)
- Advanced patterns (traits, Arc/Mutex, builders, events)
- **Production readiness (logging, monitoring, maintenance)**

**SwatNotes is now a complete, production-grade desktop application.** You understand not just *how* to build features, but *why* each pattern exists and *when* to reach for it.

**Where to go from here:**

1. **Extend SwatNotes**: Add cloud sync, Markdown export, themes, plugins
2. **Build your own app**: Apply these patterns to your idea
3. **Contribute to Tauri**: Help improve the ecosystem
4. **Share your knowledge**: Write blog posts, give talks, mentor others

The desktop application landscape needs more high-quality, privacy-focused tools. With Rust, Tauri, and the patterns you've learned, you're equipped to build them.

**Go build something amazing.**

---

**Glossary:**

- **Observability**: Ability to understand system behavior from external outputs (logs, metrics, traces)
- **Structured logging**: Logging with key-value pairs, not just strings (e.g., `user_id=123`)
- **Log level**: Severity of log message (ERROR, WARN, INFO, DEBUG, TRACE)
- **Log rotation**: Creating new log files periodically to prevent unbounded disk usage
- **Graceful degradation**: Continuing with reduced functionality when components fail
- **Health check**: Verification that a system component is functioning correctly
- **Diagnostic info**: Non-sensitive app state exported for troubleshooting
- **Feature flag**: Toggle to enable/disable features without code deployment
- **Incident severity**: Classification of production issues by impact (P0-P4)
- **Post-mortem**: Analysis of incident after resolution to prevent recurrence
- **VACUUM**: SQLite command to rebuild database file and reclaim space
- **ANALYZE**: SQLite command to update query planner statistics
- **Garbage collection**: Deletion of unreferenced data (e.g., orphaned blobs)
- **WAL (Write-Ahead Log)**: SQLite journaling mode for crash recovery
- **Crash marker**: File created on startup, deleted on clean shutdown (detects crashes)
- **Rollback**: Reverting to previous version after problematic release
- **Root cause analysis**: Investigation to find fundamental reason for failure
- **Telemetry**: Automated collection of usage/performance data from deployed apps

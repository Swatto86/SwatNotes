/// Scheduler Service
/// Manages automatic backups on a schedule using cron expressions
/// Integrates with CredentialManager for secure password retrieval
use crate::error::{AppError, Result};
use crate::services::{BackupService, CredentialManager};
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

/// Auto-backup frequency options
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackupFrequency {
    Minutes(u32),
    Hours(u32),
    Days(u32),
}

impl BackupFrequency {
    /// Convert frequency to cron expression
    fn to_cron(self) -> String {
        match self {
            BackupFrequency::Minutes(m) => {
                if m == 1 {
                    "0 * * * * *".to_string() // Every minute
                } else {
                    format!("0 */{} * * * *", m) // Every N minutes
                }
            }
            BackupFrequency::Hours(h) => {
                if h == 1 {
                    "0 0 * * * *".to_string() // Every hour
                } else {
                    format!("0 0 */{} * * *", h) // Every N hours
                }
            }
            BackupFrequency::Days(d) => {
                if d == 1 {
                    "0 0 2 * * *".to_string() // Daily at 2 AM
                } else {
                    format!("0 0 2 */{} * *", d) // Every N days at 2 AM
                }
            }
        }
    }
}

impl FromStr for BackupFrequency {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        // Support formats: "5m", "2h", "3d" or legacy "daily", "weekly", "monthly"
        let s = s.trim().to_lowercase();

        // Legacy format support
        match s.as_str() {
            "daily" => return Ok(BackupFrequency::Days(1)),
            "weekly" => return Ok(BackupFrequency::Days(7)),
            "monthly" => return Ok(BackupFrequency::Days(30)),
            _ => {}
        }

        // New format: <number><unit>
        if s.is_empty() {
            return Err("Empty frequency string".to_string());
        }

        let unit = s.chars().last().unwrap();
        let number_part = &s[..s.len() - 1];

        let value: u32 = number_part
            .parse()
            .map_err(|_| format!("Invalid number in frequency: {}", s))?;

        if value == 0 {
            return Err("Frequency value must be greater than 0".to_string());
        }

        match unit {
            'm' => Ok(BackupFrequency::Minutes(value)),
            'h' => Ok(BackupFrequency::Hours(value)),
            'd' => Ok(BackupFrequency::Days(value)),
            _ => Err(format!(
                "Invalid frequency unit '{}'. Use 'm' (minutes), 'h' (hours), or 'd' (days)",
                unit
            )),
        }
    }
}

/// Scheduler service for automatic backups
pub struct SchedulerService {
    scheduler: Arc<RwLock<JobScheduler>>,
    backup_service: Arc<BackupService>,
    current_job_id: Arc<RwLock<Option<Uuid>>>,
}

impl SchedulerService {
    /// Create new scheduler service
    pub async fn new(backup_service: BackupService) -> Result<Self> {
        let scheduler = JobScheduler::new()
            .await
            .map_err(|e| AppError::Backup(format!("Failed to create scheduler: {}", e)))?;

        Ok(Self {
            scheduler: Arc::new(RwLock::new(scheduler)),
            backup_service: Arc::new(backup_service),
            current_job_id: Arc::new(RwLock::new(None)),
        })
    }

    /// Start the scheduler
    pub async fn start(&self) -> Result<()> {
        let scheduler = self.scheduler.read().await;
        scheduler
            .start()
            .await
            .map_err(|e| AppError::Backup(format!("Failed to start scheduler: {}", e)))?;
        tracing::info!("Backup scheduler started");
        Ok(())
    }

    /// Schedule automatic backup
    pub async fn schedule_backup(&self, frequency: BackupFrequency, enabled: bool) -> Result<()> {
        // Remove existing job if any
        self.cancel_backup().await?;

        if !enabled {
            tracing::info!("Automatic backups disabled");
            return Ok(());
        }

        // Verify password exists in credential manager
        if !CredentialManager::has_auto_backup_password() {
            return Err(AppError::Backup(
                "Auto-backup password not set. Please set password in settings.".to_string(),
            ));
        }

        let cron_expr = frequency.to_cron();
        let backup_service = Arc::clone(&self.backup_service);

        // Create backup job
        let job = Job::new_async(cron_expr.clone(), move |_uuid, _l| {
            let backup_service = Arc::clone(&backup_service);
            Box::pin(async move {
                tracing::info!("Running scheduled automatic backup");

                // Retrieve password from credential manager
                let password = match CredentialManager::get_auto_backup_password() {
                    Ok(pwd) => pwd,
                    Err(e) => {
                        tracing::error!("Failed to retrieve auto-backup password: {}", e);
                        // Send notification about failure
                        if let Err(ne) = send_notification(
                            "Automatic Backup Failed",
                            "Could not retrieve backup password from credential manager",
                        ) {
                            tracing::error!("Failed to send notification: {}", ne);
                        }
                        return;
                    }
                };

                // Create backup
                match backup_service.create_backup(&password).await {
                    Ok(path) => {
                        tracing::info!("Automatic backup created: {:?}", path);
                        if let Err(e) = send_notification(
                            "Backup Complete",
                            "Automatic backup created successfully",
                        ) {
                            tracing::error!("Failed to send notification: {}", e);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Automatic backup failed: {}", e);
                        if let Err(ne) =
                            send_notification("Automatic Backup Failed", &format!("{}", e))
                        {
                            tracing::error!("Failed to send notification: {}", ne);
                        }
                    }
                }
            })
        })
        .map_err(|e| AppError::Backup(format!("Failed to create backup job: {}", e)))?;

        let job_id = job.guid();

        // Add job to scheduler
        let scheduler = self.scheduler.write().await;
        scheduler
            .add(job)
            .await
            .map_err(|e| AppError::Backup(format!("Failed to schedule job: {}", e)))?;

        // Store job ID
        let mut current_job = self.current_job_id.write().await;
        *current_job = Some(job_id);

        tracing::info!(
            "Automatic backup scheduled: {:?} ({})",
            frequency,
            cron_expr
        );
        Ok(())
    }

    /// Cancel scheduled backup
    pub async fn cancel_backup(&self) -> Result<()> {
        let mut current_job = self.current_job_id.write().await;

        if let Some(job_id) = *current_job {
            let scheduler = self.scheduler.write().await;
            scheduler
                .remove(&job_id)
                .await
                .map_err(|e| AppError::Backup(format!("Failed to remove job: {}", e)))?;

            *current_job = None;
            tracing::info!("Automatic backup schedule cancelled");
        }

        Ok(())
    }

    /// Shutdown scheduler gracefully
    pub async fn shutdown(&self) -> Result<()> {
        let mut scheduler = self.scheduler.write().await;
        scheduler
            .shutdown()
            .await
            .map_err(|e| AppError::Backup(format!("Failed to shutdown scheduler: {}", e)))?;
        tracing::info!("Backup scheduler shutdown");
        Ok(())
    }
}

/// Helper to send system notifications
fn send_notification(title: &str, body: &str) -> Result<()> {
    // Since we don't have direct access to app handle here, we'll log for now
    // The actual notification will be sent via Tauri commands
    tracing::info!("Notification: {} - {}", title, body);
    Ok(())
}

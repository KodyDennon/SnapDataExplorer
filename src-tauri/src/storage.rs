use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use sysinfo::Disks;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize)]
pub enum StorageError {
    #[error("Failed to get disk info")]
    DiskInfoError,
    #[error("Path does not exist: {0}")]
    PathNotFound(String),
    #[error("Not enough space. Required: {required} bytes, Available: {available} bytes")]
    InsufficientSpace { required: u64, available: u64 },
    #[error("IO Error: {0}")]
    IoError(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskSpaceInfo {
    pub available_bytes: u64,
    pub total_bytes: u64,
    pub mount_point: String,
}

pub struct StorageManager;

impl StorageManager {
    pub fn get_disk_space(path: PathBuf) -> Result<DiskSpaceInfo, StorageError> {
        let disks = Disks::new_with_refreshed_list();

        // Find the disk that contains the given path
        // We look for the longest mount point that is a prefix of our path
        let mut best_disk = None;
        let mut max_len = 0;

        for disk in &disks {
            let mount_point = disk.mount_point();
            if path.starts_with(mount_point) {
                let len = mount_point.as_os_str().len();
                if len >= max_len {
                    max_len = len;
                    best_disk = Some(disk);
                }
            }
        }

        if let Some(disk) = best_disk {
            Ok(DiskSpaceInfo {
                available_bytes: disk.available_space(),
                total_bytes: disk.total_space(),
                mount_point: disk.mount_point().to_string_lossy().to_string(),
            })
        } else {
            Err(StorageError::DiskInfoError)
        }
    }

    pub fn validate_path(path: PathBuf) -> Result<(), StorageError> {
        if !path.exists() {
            return Err(StorageError::PathNotFound(path.to_string_lossy().to_string()));
        }
        if !path.is_dir() {
            return Err(StorageError::IoError("Path is not a directory".to_string()));
        }
        Ok(())
    }
}

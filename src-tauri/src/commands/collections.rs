//! Collection-related commands
//!
//! CRUD operations for collections/folders to organize notes.

use crate::app::AppState;
use crate::database::{Collection, CreateCollectionRequest, UpdateCollectionRequest};
use crate::error::Result;
use tauri::State;

/// Create a new collection
#[tauri::command]
pub async fn create_collection(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Collection> {
    tracing::info!("Creating collection: {}", name);

    let req = CreateCollectionRequest {
        name,
        description,
        color,
        icon,
    };

    let collection = state.db.create_collection(req).await?;

    tracing::info!("Collection created: {}", collection.id);
    Ok(collection)
}

/// Get a collection by ID
#[tauri::command]
pub async fn get_collection(state: State<'_, AppState>, id: String) -> Result<Collection> {
    state.db.get_collection(&id).await
}

/// List all collections
#[tauri::command]
pub async fn list_collections(state: State<'_, AppState>) -> Result<Vec<Collection>> {
    state.db.list_collections().await
}

/// Update a collection
#[tauri::command]
pub async fn update_collection(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    sort_order: Option<i32>,
) -> Result<Collection> {
    tracing::info!("Updating collection: {}", id);

    let req = UpdateCollectionRequest {
        id,
        name,
        description,
        color,
        icon,
        sort_order,
    };

    state.db.update_collection(req).await
}

/// Delete a collection
#[tauri::command]
pub async fn delete_collection(state: State<'_, AppState>, id: String) -> Result<()> {
    tracing::info!("Deleting collection: {}", id);
    state.db.delete_collection(&id).await
}

/// Update a note's collection (move to folder or remove from folder)
#[tauri::command]
pub async fn update_note_collection(
    state: State<'_, AppState>,
    note_id: String,
    collection_id: Option<String>,
) -> Result<crate::database::Note> {
    tracing::info!(
        "Updating note {} collection to {:?}",
        note_id,
        collection_id
    );
    state
        .db
        .update_note_collection(&note_id, collection_id.as_deref())
        .await
}

/// List notes in a specific collection
#[tauri::command]
pub async fn list_notes_in_collection(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Vec<crate::database::Note>> {
    state.db.list_notes_in_collection(&collection_id).await
}

/// List uncategorized notes (notes without a collection)
#[tauri::command]
pub async fn list_uncategorized_notes(
    state: State<'_, AppState>,
) -> Result<Vec<crate::database::Note>> {
    state.db.list_uncategorized_notes().await
}

/// Count notes in a collection
#[tauri::command]
pub async fn count_notes_in_collection(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<i64> {
    state.db.count_notes_in_collection(&collection_id).await
}

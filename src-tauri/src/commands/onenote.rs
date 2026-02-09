/// OneNote Import Module
/// Handles importing notes from Microsoft OneNote  
/// Uses PowerShell COM automation for Windows compatibility
///
/// OneNote COM API documentation:
/// https://docs.microsoft.com/en-us/office/client-developer/onenote/onenote-home
use crate::database::{CreateCollectionRequest, CreateNoteRequest};
use crate::error::{AppError, Result};
use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use tauri::State;
use tracing::{error, info, warn};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct OneNoteSection {
    pub id: String,
    pub name: String,
    pub notebook_name: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct OneNotePage {
    pub id: String,
    pub title: String,
    pub content: String,
    pub section_id: String,
    pub section_name: String,
    pub created_at: String,
    pub modified_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub notes_imported: usize,
    pub collections_created: usize,
    pub sections_mapped: HashMap<String, String>,
    pub errors: Vec<String>,
}

/// Import all notes from OneNote
///
/// Uses PowerShell to interact with OneNote.Application COM object
#[tauri::command]
pub async fn import_from_onenote(state: State<'_, crate::app::AppState>) -> Result<ImportResult> {
    info!("OneNote import requested");

    #[cfg(not(target_os = "windows"))]
    {
        return Err(AppError::Generic(
            "OneNote import is only available on Windows".to_string(),
        ));
    }

    #[cfg(target_os = "windows")]
    {
        import_from_onenote_windows(state).await
    }
}

#[cfg(target_os = "windows")]
async fn import_from_onenote_windows(
    state: State<'_, crate::app::AppState>,
) -> Result<ImportResult> {
    let mut sections_mapped = HashMap::new();
    let mut collections_created = 0;
    let mut notes_imported = 0;
    let mut errors = Vec::new();

    // Get existing collections for matching
    let existing_collections = match state.db.list_collections().await {
        Ok(colls) => colls,
        Err(e) => {
            error!("Failed to list existing collections: {}", e);
            return Err(e);
        }
    };

    let mut collection_map: HashMap<String, String> = HashMap::new();
    for coll in existing_collections {
        collection_map.insert(coll.name.to_lowercase(), coll.id);
    }

    info!("Found {} existing collections", collection_map.len());

    // Get OneNote hierarchy using PowerShell
    let hierarchy_xml = match get_onenote_hierarchy() {
        Ok(xml) => xml,
        Err(e) => {
            error!("Failed to get OneNote hierarchy: {}", e);
            errors.push(format!("Failed to connect to OneNote: {}", e));
            return Ok(ImportResult {
                notes_imported,
                collections_created,
                sections_mapped,
                errors,
            });
        }
    };

    if hierarchy_xml.is_empty() {
        errors.push("OneNote returned empty hierarchy. Make sure OneNote is installed and has notebooks.".to_string());
        return Ok(ImportResult {
            notes_imported,
            collections_created,
            sections_mapped,
            errors,
        });
    }

    info!("Retrieved OneNote hierarchy");

    // Parse sections from hierarchy
    let sections = match parse_sections(&hierarchy_xml) {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to parse OneNote hierarchy: {}", e);
            errors.push(format!("Failed to parse OneNote data: {}", e));
            return Ok(ImportResult {
                notes_imported,
                collections_created,
                sections_mapped,
                errors,
            });
        }
    };

    info!("Found {} sections to import", sections.len());

    // Process each section
    for section in sections {
        info!("Processing section: {}", section.name);

        // Get or create collection for this section
        let collection_id = match get_or_create_collection(
            &state,
            &section,
            &mut collection_map,
            &mut collections_created,
        )
        .await
        {
            Ok(id) => id,
            Err(e) => {
                warn!("Failed to create collection for section {}: {}", section.name, e);
                errors.push(format!(
                    "Failed to create collection for section '{}': {}",
                    section.name, e
                ));
                continue;
            }
        };

        sections_mapped.insert(section.name.clone(), collection_id.clone());

        // Get pages in this section
        let pages = match get_pages_in_section(&section.id) {
            Ok(p) => p,
            Err(e) => {
                warn!("Failed to get pages in section {}: {}", section.name, e);
                errors.push(format!(
                    "Failed to get pages in section '{}': {}",
                    section.name, e
                ));
                continue;
            }
        };

        info!("Found {} pages in section {}", pages.len(), section.name);

        // Import each page
        for page in pages {
            match import_page(&state, &page, &collection_id).await {
                Ok(_) => {
                    notes_imported += 1;
                    if notes_imported % 10 == 0 {
                        info!("Imported {} notes so far...", notes_imported);
                    }
                }
                Err(e) => {
                    warn!("Failed to import page '{}': {}", page.title, e);
                    errors.push(format!("Failed to import page '{}': {}", page.title, e));
                }
            }
        }
    }

    info!(
        "Import complete: {} notes imported, {} collections created, {} errors",
        notes_imported,
        collections_created,
        errors.len()
    );

    Ok(ImportResult {
        notes_imported,
        collections_created,
        sections_mapped,
        errors,
    })
}

#[cfg(target_os = "windows")]
async fn get_or_create_collection(
    state: &State<'_, crate::app::AppState>,
    section: &OneNoteSection,
    collection_map: &mut HashMap<String, String>,
    collections_created: &mut usize,
) -> Result<String> {
    let section_name_lower = section.name.to_lowercase();

    // Check if collection already exists
    if let Some(id) = collection_map.get(&section_name_lower) {
        info!(
            "Using existing collection '{}' for section '{}'",
            section.name, section.name
        );
        return Ok(id.clone());
    }

    // Create new collection
    info!("Creating new collection for section '{}'", section.name);
    let new_coll = state
        .db
        .create_collection(CreateCollectionRequest {
            name: section.name.clone(),
            description: Some(format!("Imported from OneNote: {}", section.notebook_name)),
            color: Some("#3B82F6".to_string()), // Blue color for imported collections
            icon: Some("book".to_string()),
        })
        .await?;

    *collections_created += 1;
    collection_map.insert(section_name_lower, new_coll.id.clone());

    Ok(new_coll.id)
}

#[cfg(target_os = "windows")]
async fn import_page(
    state: &State<'_, crate::app::AppState>,
    page: &OneNotePage,
    collection_id: &str,
) -> Result<()> {
    // Get page content
    let page_xml = get_page_content(&page.id)?;

    // Convert OneNote XML to Quill Delta
    let quill_content = convert_onenote_to_quill(&page_xml)?;

    // Create note
    let note = state
        .db
        .create_note(CreateNoteRequest {
            title: page.title.clone(),
            content_json: quill_content,
        })
        .await?;

    // Assign to collection
    state
        .db
        .update_note_collection(&note.id, Some(collection_id))
        .await?;

    // Update FTS index
    state
        .db
        .insert_note_fts(&note.id, &note.title, &note.content_json)
        .await?;

    Ok(())
}

// PowerShell Helper Functions

#[cfg(target_os = "windows")]
fn get_onenote_hierarchy() -> Result<String> {
    let script = r#"
        try {
            $onenote = New-Object -ComObject OneNote.Application
            [ref]$xml = ""
            $onenote.GetHierarchy("", [Microsoft.Office.Interop.OneNote.HierarchyScope]::hsPages, $xml)
            $xml.Value
        } catch {
            Write-Error $_.Exception.Message
            exit 1
        }
    "#;

    let output = Command::new("powershell")
        .args(&["-NoProfile", "-Command", script])
        .output()
        .map_err(|e| AppError::Generic(format!("Failed to run PowerShell: {}", e)))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Generic(format!(
            "PowerShell script failed: {}",
            error_msg
        )));
    }

    let xml = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(xml)
}

#[cfg(target_os = "windows")]
fn get_pages_in_section(section_id: &str) -> Result<Vec<OneNotePage>> {
    let script = format!(
        r#"
        try {{
            $onenote = New-Object -ComObject OneNote.Application
            [ref]$xml = ""
            $onenote.GetHierarchy("{}", [Microsoft.Office.Interop.OneNote.HierarchyScope]::hsPages, $xml)
            $xml.Value
        }} catch {{
            Write-Error $_.Exception.Message
            exit 1
        }}
    "#,
        section_id.replace('"', "`\"")
    );

    let output = Command::new("powershell")
        .args(&["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| AppError::Generic(format!("Failed to run PowerShell: {}", e)))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Generic(format!(
            "PowerShell script failed: {}",
            error_msg
        )));
    }

    let xml = String::from_utf8_lossy(&output.stdout).to_string();
    parse_pages(&xml)
}

#[cfg(target_os = "windows")]
fn get_page_content(page_id: &str) -> Result<String> {
    let script = format!(
        r#"
        try {{
            $onenote = New-Object -ComObject OneNote.Application
            [ref]$xml = ""
            $onenote.GetPageContent("{}", $xml)
            $xml.Value
        }} catch {{
            Write-Error $_.Exception.Message
            exit 1
        }}
    "#,
        page_id.replace('"', "`\"")
    );

    let output = Command::new("powershell")
        .args(&["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| AppError::Generic(format!("Failed to run PowerShell: {}", e)))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Generic(format!(
            "PowerShell script failed: {}",
            error_msg
        )));
    }

    let xml = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(xml)
}

// XML Parsing Functions

#[cfg(target_os = "windows")]
fn parse_sections(hierarchy_xml: &str) -> Result<Vec<OneNoteSection>> {
    let mut sections = Vec::new();
    let mut reader = Reader::from_str(hierarchy_xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut current_notebook = String::new();
    let mut section_id = String::new();
    let mut section_name = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                match e.name().as_ref() {
                    b"Notebook" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"name" {
                                current_notebook = String::from_utf8_lossy(&attr.value).to_string();
                            }
                        }
                    }
                    b"Section" => {
                        section_id.clear();
                        section_name.clear();

                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"ID" => {
                                    section_id = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                b"name" => {
                                    section_name =
                                        String::from_utf8_lossy(&attr.value).to_string();
                                }
                                _ => {}
                            }
                        }

                        if !section_id.is_empty() && !section_name.is_empty() {
                            sections.push(OneNoteSection {
                                id: section_id.clone(),
                                name: section_name.clone(),
                                notebook_name: current_notebook.clone(),
                            });
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(AppError::Generic(format!("XML parse error: {}", e)));
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(sections)
}

#[cfg(target_os = "windows")]
fn parse_pages(hierarchy_xml: &str) -> Result<Vec<OneNotePage>> {
    let mut pages = Vec::new();
    let mut reader = Reader::from_str(hierarchy_xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut section_name = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                match e.name().as_ref() {
                    b"Section" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"name" {
                                section_name = String::from_utf8_lossy(&attr.value).to_string();
                            }
                        }
                    }
                    b"Page" => {
                        let mut page_id = String::new();
                        let mut page_title = String::new();

                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"ID" => {
                                    page_id = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                b"name" => {
                                    page_title = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                _ => {}
                            }
                        }

                        if !page_id.is_empty() {
                            pages.push(OneNotePage {
                                id: page_id,
                                title: if page_title.is_empty() {
                                    "Untitled Page".to_string()
                                } else {
                                    page_title
                                },
                                content: String::new(),
                                section_id: String::new(),
                                section_name: section_name.clone(),
                                created_at: String::new(),
                                modified_at: String::new(),
                            });
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(AppError::Generic(format!("XML parse error: {}", e)));
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(pages)
}

#[cfg(target_os = "windows")]
fn convert_onenote_to_quill(page_xml: &str) -> Result<String> {
    use serde_json::json;

    let mut reader = Reader::from_str(page_xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut ops = Vec::new();
    let mut current_text = String::new();
    let mut in_text_element = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"T" {
                    in_text_element = true;
                }
            }
            Ok(Event::Text(e)) => {
                if in_text_element {
                    if let Ok(text) = e.unescape() {
                        current_text.push_str(&text);
                    }
                }
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"T" {
                    if !current_text.is_empty() {
                        ops.push(json!({
                            "insert": current_text.clone()
                        }));
                        current_text.clear();
                    }
                    in_text_element = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                warn!("XML parse error during content conversion: {}", e);
                break;
            }
            _ => {}
        }
        buf.clear();
    }

    // Ensure there's at least a newline
    if ops.is_empty() {
        ops.push(json!({"insert": "\n"}));
    } else {
        // Add final newline if not present
        if let Some(last_op) = ops.last() {
            if let Some(insert) = last_op.get("insert").and_then(|v| v.as_str()) {
                if !insert.ends_with('\n') {
                    ops.push(json!({"insert": "\n"}));
                }
            }
        }
    }

    let delta = json!({ "ops": ops });
    Ok(delta.to_string())
}

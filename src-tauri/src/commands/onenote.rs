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

    // Get full OneNote hierarchy using PowerShell (scope 4 = all content)
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
        errors.push(
            "OneNote returned empty hierarchy. Make sure OneNote is installed and has notebooks."
                .to_string(),
        );
        return Ok(ImportResult {
            notes_imported,
            collections_created,
            sections_mapped,
            errors,
        });
    }

    info!(
        "Retrieved OneNote hierarchy ({} bytes)",
        hierarchy_xml.len()
    );

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

    // Parse all pages from the same hierarchy (avoids extra COM calls per section)
    let all_pages = match parse_all_pages(&hierarchy_xml) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to parse pages from hierarchy: {}", e);
            errors.push(format!("Failed to parse pages: {}", e));
            return Ok(ImportResult {
                notes_imported,
                collections_created,
                sections_mapped,
                errors,
            });
        }
    };

    info!(
        "Found {} total pages across all sections",
        all_pages.values().map(|v| v.len()).sum::<usize>()
    );

    // Process each section
    for section in &sections {
        // Skip recycle bin / deleted pages section
        if section.name == "Deleted Pages" {
            info!("Skipping 'Deleted Pages' section");
            continue;
        }

        info!("Processing section: {}", section.name);

        // Get or create collection for this section
        let collection_id = match get_or_create_collection(
            &state,
            section,
            &mut collection_map,
            &mut collections_created,
        )
        .await
        {
            Ok(id) => id,
            Err(e) => {
                warn!(
                    "Failed to create collection for section {}: {}",
                    section.name, e
                );
                errors.push(format!(
                    "Failed to create collection for section '{}': {}",
                    section.name, e
                ));
                continue;
            }
        };

        sections_mapped.insert(section.name.clone(), collection_id.clone());

        // Get pages for this section from the pre-parsed map
        let pages = match all_pages.get(&section.id) {
            Some(p) => p,
            None => {
                info!("No pages found in section '{}'", section.name);
                continue;
            }
        };

        info!("Found {} pages in section '{}'", pages.len(), section.name);

        // Import each page
        for page in pages {
            match import_page(&state, page, &collection_id).await {
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

    // Cycle through distinct colors for imported collections
    const IMPORT_COLORS: &[&str] = &[
        "#EF4444", // Red
        "#22C55E", // Green
        "#8B5CF6", // Violet
        "#F97316", // Orange
        "#06B6D4", // Cyan
        "#EC4899", // Pink
        "#EAB308", // Yellow
        "#14B8A6", // Teal
        "#6366F1", // Indigo
        "#84CC16", // Lime
        "#D946EF", // Fuchsia
        "#F43F5E", // Rose
        "#0EA5E9", // Sky
        "#10B981", // Emerald
        "#F59E0B", // Amber
    ];
    let color_index = *collections_created % IMPORT_COLORS.len();
    let color = IMPORT_COLORS[color_index].to_string();

    // Create new collection
    info!("Creating new collection for section '{}'", section.name);
    let new_coll = state
        .db
        .create_collection(CreateCollectionRequest {
            name: section.name.clone(),
            description: Some(format!("Imported from OneNote: {}", section.notebook_name)),
            color: Some(color),
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
    // Get page content via COM
    let page_xml = get_page_content(&page.id)?;

    // Convert OneNote XML to Quill Delta
    let quill_content = convert_onenote_to_quill(&page_xml)?;

    // Create note with collection assignment
    let note = state
        .db
        .create_note(CreateNoteRequest {
            title: page.title.clone(),
            content_json: quill_content,
            collection_id: Some(collection_id.to_string()),
        })
        .await?;

    // Update FTS index
    state
        .db
        .insert_note_fts(&note.id, &note.title, &note.content_json)
        .await?;

    Ok(())
}

// PowerShell Helper Functions

/// Get the full OneNote hierarchy XML using COM automation.
/// Uses scope 4 (all content) to retrieve notebooks, section groups, sections, and pages
/// in a single call. Numeric scope values avoid dependency on .NET interop assembly.
#[cfg(target_os = "windows")]
fn get_onenote_hierarchy() -> Result<String> {
    // Scope 4 = hsAll: returns notebooks, section groups, sections, and pages
    let script = r#"
        try {
            $onenote = New-Object -ComObject OneNote.Application
            [ref]$xml = ""
            $onenote.GetHierarchy("", 4, $xml)
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            [Console]::Out.Write($xml.Value)
        } catch {
            Write-Error $_.Exception.Message
            exit 1
        }
    "#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|e| AppError::Generic(format!("Failed to run PowerShell: {}", e)))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Generic(format!(
            "PowerShell script failed: {}",
            error_msg.trim()
        )));
    }

    let xml = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(xml)
}

/// Get page content XML for a specific page ID.
/// Escapes the page ID for safe PowerShell string interpolation.
#[cfg(target_os = "windows")]
fn get_page_content(page_id: &str) -> Result<String> {
    // Escape single quotes in page_id for PowerShell single-quoted string
    let safe_id = page_id.replace('\'', "''");
    let script = format!(
        r#"
        try {{
            $onenote = New-Object -ComObject OneNote.Application
            [ref]$xml = ""
            $onenote.GetPageContent('{}', $xml)
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            [Console]::Out.Write($xml.Value)
        }} catch {{
            Write-Error $_.Exception.Message
            exit 1
        }}
    "#,
        safe_id
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| AppError::Generic(format!("Failed to run PowerShell: {}", e)))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Generic(format!(
            "Failed to get page content: {}",
            error_msg.trim()
        )));
    }

    let xml = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(xml)
}

// XML Parsing Functions
// OneNote hierarchy XML uses the namespace prefix "one:" on all elements
// (e.g., one:Notebook, one:Section, one:Page). We use local_name() to
// match element names without the namespace prefix.

/// Parse sections from the full OneNote hierarchy XML.
/// Tracks the current notebook name to associate with each section.
#[cfg(target_os = "windows")]
fn parse_sections(hierarchy_xml: &str) -> Result<Vec<OneNoteSection>> {
    let mut sections = Vec::new();
    let mut reader = Reader::from_str(hierarchy_xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut current_notebook = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                let local = e.name().local_name();
                match local.as_ref() {
                    b"Notebook" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.local_name().as_ref() == b"name" {
                                current_notebook = String::from_utf8_lossy(&attr.value).to_string();
                            }
                        }
                    }
                    b"Section" => {
                        let mut section_id = String::new();
                        let mut section_name = String::new();
                        let mut is_recycle_bin = false;

                        for attr in e.attributes().flatten() {
                            match attr.key.local_name().as_ref() {
                                b"ID" => {
                                    section_id = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                b"name" => {
                                    section_name = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                b"isInRecycleBin" => {
                                    is_recycle_bin = String::from_utf8_lossy(&attr.value) == "true";
                                }
                                _ => {}
                            }
                        }

                        if !section_id.is_empty() && !section_name.is_empty() && !is_recycle_bin {
                            sections.push(OneNoteSection {
                                id: section_id,
                                name: section_name,
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

/// Parse all pages from the full hierarchy XML, grouped by section ID.
/// Returns a map of section_id -> Vec<OneNotePage>.
/// This avoids needing separate COM calls per section.
#[cfg(target_os = "windows")]
fn parse_all_pages(hierarchy_xml: &str) -> Result<HashMap<String, Vec<OneNotePage>>> {
    let mut pages_by_section: HashMap<String, Vec<OneNotePage>> = HashMap::new();
    let mut reader = Reader::from_str(hierarchy_xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut current_section_id = String::new();
    let mut current_section_name = String::new();
    let mut in_recycle_bin = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                let local = e.name().local_name();
                match local.as_ref() {
                    b"SectionGroup" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.local_name().as_ref() == b"isRecycleBin"
                                && String::from_utf8_lossy(&attr.value) == "true"
                            {
                                in_recycle_bin = true;
                            }
                        }
                    }
                    b"Section" => {
                        if in_recycle_bin {
                            // Skip sections inside recycle bin
                        } else {
                            current_section_id.clear();
                            current_section_name.clear();

                            for attr in e.attributes().flatten() {
                                match attr.key.local_name().as_ref() {
                                    b"ID" => {
                                        current_section_id =
                                            String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    b"name" => {
                                        current_section_name =
                                            String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    b"Page" => {
                        if in_recycle_bin || current_section_id.is_empty() {
                            // Skip pages in recycle bin or without a section
                        } else {
                            let mut page_id = String::new();
                            let mut page_title = String::new();
                            let mut created_at = String::new();
                            let mut modified_at = String::new();
                            let mut is_in_recycle_bin = false;

                            for attr in e.attributes().flatten() {
                                match attr.key.local_name().as_ref() {
                                    b"ID" => {
                                        page_id = String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    b"name" => {
                                        page_title =
                                            String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    b"dateTime" => {
                                        created_at =
                                            String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    b"lastModifiedTime" => {
                                        modified_at =
                                            String::from_utf8_lossy(&attr.value).to_string();
                                    }
                                    b"isInRecycleBin" => {
                                        is_in_recycle_bin =
                                            String::from_utf8_lossy(&attr.value) == "true";
                                    }
                                    _ => {}
                                }
                            }

                            if !page_id.is_empty() && !is_in_recycle_bin {
                                let page = OneNotePage {
                                    id: page_id,
                                    title: if page_title.is_empty() {
                                        "Untitled Page".to_string()
                                    } else {
                                        page_title
                                    },
                                    content: String::new(),
                                    section_id: current_section_id.clone(),
                                    section_name: current_section_name.clone(),
                                    created_at,
                                    modified_at,
                                };
                                pages_by_section
                                    .entry(current_section_id.clone())
                                    .or_default()
                                    .push(page);
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                let local = e.name().local_name();
                if local.as_ref() == b"SectionGroup" {
                    in_recycle_bin = false;
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

    Ok(pages_by_section)
}

/// Convert OneNote page XML to Quill Delta JSON format.
///
/// OneNote page XML structure:
/// - one:Title > one:OE > one:T contains the title (skipped, title is stored separately)
/// - one:Outline > one:OEChildren > one:OE > one:T contains body content
/// - one:T elements contain text, often wrapped in CDATA
/// - Each one:OE (outline element) is roughly a paragraph
#[cfg(target_os = "windows")]
fn convert_onenote_to_quill(page_xml: &str) -> Result<String> {
    use serde_json::json;

    let mut reader = Reader::from_str(page_xml);
    reader.config_mut().trim_text(false); // preserve whitespace in content

    let mut buf = Vec::new();
    let mut ops: Vec<serde_json::Value> = Vec::new();
    let mut current_text = String::new();
    let mut in_text_element = false;
    let mut in_title = false;
    let mut in_outline = false;
    let mut oe_depth: usize = 0; // Track nesting depth of OE elements
    let mut in_list = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let local = e.name().local_name();
                match local.as_ref() {
                    b"Title" => {
                        in_title = true;
                    }
                    b"Outline" => {
                        in_outline = true;
                    }
                    b"OE" => {
                        if in_outline {
                            oe_depth += 1;
                        }
                        // Check for list attributes
                        for attr in e.attributes().flatten() {
                            if attr.key.local_name().as_ref() == b"quickStyleIndex" {
                                // QuickStyle might indicate list items
                            }
                        }
                    }
                    b"OEChildren" => {
                        // Nested content
                    }
                    b"List" => {
                        in_list = true;
                    }
                    b"T" => {
                        if !in_title {
                            in_text_element = true;
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(e)) => {
                if in_text_element {
                    if let Ok(text) = e.unescape() {
                        current_text.push_str(&text);
                    }
                }
            }
            Ok(Event::CData(e)) => {
                if in_text_element {
                    let cdata_text = String::from_utf8_lossy(&e).to_string();
                    // OneNote CDATA may contain HTML-like content with tags like <span>, <br>, etc.
                    let clean_text = strip_html_tags(&cdata_text);
                    current_text.push_str(&clean_text);
                }
            }
            Ok(Event::End(e)) => {
                let local = e.name().local_name();
                match local.as_ref() {
                    b"Title" => {
                        in_title = false;
                    }
                    b"Outline" => {
                        in_outline = false;
                    }
                    b"T" => {
                        if in_text_element && !current_text.is_empty() {
                            ops.push(json!({ "insert": current_text.clone() }));
                            current_text.clear();
                        }
                        in_text_element = false;
                    }
                    b"OE" => {
                        if in_outline {
                            // Each OE is a paragraph — add a newline
                            if in_list {
                                ops.push(json!({
                                    "insert": "\n",
                                    "attributes": { "list": "bullet" }
                                }));
                                in_list = false;
                            } else {
                                ops.push(json!({ "insert": "\n" }));
                            }
                            oe_depth = oe_depth.saturating_sub(1);
                        }
                    }
                    b"List" => {
                        // List element ended but we handle in OE end
                    }
                    _ => {}
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

    // Flush any remaining text
    if !current_text.is_empty() {
        ops.push(json!({ "insert": current_text }));
    }

    // Ensure there's at least a newline (Quill requires trailing newline)
    if ops.is_empty() {
        ops.push(json!({"insert": "\n"}));
    } else {
        // Ensure final newline
        let needs_newline = match ops.last() {
            Some(op) => {
                if let Some(insert) = op.get("insert").and_then(|v| v.as_str()) {
                    !insert.ends_with('\n')
                } else {
                    true
                }
            }
            None => true,
        };
        if needs_newline {
            ops.push(json!({"insert": "\n"}));
        }
    }

    let delta = json!({ "ops": ops });
    Ok(delta.to_string())
}

/// Strip basic HTML tags from OneNote CDATA content, converting
/// structural tags to appropriate text representations.
#[cfg(target_os = "windows")]
fn strip_html_tags(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut tag_name = String::new();
    let mut capturing_tag = false;

    let chars: Vec<char> = html.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let ch = chars[i];
        match ch {
            '<' => {
                in_tag = true;
                capturing_tag = true;
                tag_name.clear();
            }
            '>' => {
                if in_tag {
                    in_tag = false;
                    capturing_tag = false;
                    let tag_lower = tag_name.to_lowercase();
                    // Convert <br> and <br/> to newlines
                    if tag_lower == "br" || tag_lower == "br/" {
                        result.push('\n');
                    }
                }
            }
            _ => {
                if in_tag {
                    if capturing_tag && ch != '/' {
                        if ch == ' ' {
                            capturing_tag = false;
                        } else {
                            tag_name.push(ch);
                        }
                    }
                } else {
                    // Handle HTML entities
                    if ch == '&' {
                        // Look ahead for entity
                        let remaining: String = chars[i..].iter().collect();
                        if remaining.starts_with("&amp;") {
                            result.push('&');
                            i += 4; // skip "amp;"
                        } else if remaining.starts_with("&lt;") {
                            result.push('<');
                            i += 3;
                        } else if remaining.starts_with("&gt;") {
                            result.push('>');
                            i += 3;
                        } else if remaining.starts_with("&quot;") {
                            result.push('"');
                            i += 5;
                        } else if remaining.starts_with("&apos;") {
                            result.push('\'');
                            i += 5;
                        } else if remaining.starts_with("&nbsp;") {
                            result.push(' ');
                            i += 5;
                        } else {
                            result.push(ch);
                        }
                    } else {
                        result.push(ch);
                    }
                }
            }
        }
        i += 1;
    }

    result
}

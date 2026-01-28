# Table of Contents

## Introduction

- [Introduction](README.md)
- [How to Use This Book](README.md#how-this-book-works)

---

## Part 0: The Map

- [Part 0: The Map](chapters/00-the-map.md)
  - What We're Building
  - System Architecture Overview
  - End-to-End Data Flow
  - Technology Stack Deep Dive

---

## Part 1: Foundations

- [Chapter 1: First Principles](chapters/01-first-principles.md)
  - What is Rust and Why?
  - Ownership: The Single Key
  - Borrowing: Visitor Passes
  - Types and Safety
  - Async: Waiting Without Blocking

- Chapter 2: Setting Up Your Environment
  - Installing Rust and Cargo
  - Installing Node.js and npm
  - Platform-Specific Dependencies
  - Creating Your First Tauri Project
  - Understanding the Project Structure

- Chapter 3: Hello Tauri
  - Frontend Meets Backend
  - Your First Tauri Command
  - Invoking from JavaScript
  - Error Handling Basics
  - The Mental Model

- Chapter 4: Understanding the Stack
  - SQLite: Your Local Database
  - SQLx: Compile-Time Safety
  - Tauri v2 Architecture
  - DaisyUI Component Library
  - Build Tools: Vite and Cargo

- Chapter 5: Project Architecture
  - Repository Structure
  - Module Organization
  - AppState Pattern
  - Configuration Management
  - Logging Strategy

---

## Part 2: Core Features

- Chapter 6: Database Foundations
  - Designing the Schema
  - Migrations
  - Repository Pattern
  - Transactions and Atomicity
  - SQLite Pragmas and Performance

- Chapter 7: Creating Notes
  - Note Model
  - Create Note Service
  - Tauri Command
  - Frontend Integration
  - Tracking the Data Journey

- Chapter 8: Rich Text Editing
  - Quill.js Integration
  - Delta Format
  - Autosave Strategy
  - Debouncing Writes
  - Handling Edge Cases

- Chapter 9: Listing and Searching
  - Efficient List Queries
  - Full-Text Search with FTS5
  - Search UX Patterns
  - Pagination Strategies

- Chapter 10: Updating and Deleting
  - Update Operations
  - Soft Delete Pattern
  - Optimistic UI Updates
  - Conflict Resolution

- Chapter 11: State Management
  - AppState Deep Dive
  - Sharing Services
  - Mutation Patterns
  - Event-Driven Updates

- Chapter 12: Frontend Architecture
  - TypeScript Types
  - Component Organization
  - Event Handlers
  - Theme Management

---

## Part 3: Advanced Features

- Chapter 13: File Attachments
  - Content-Addressed Storage
  - SHA-256 Hashing
  - Blob Store Implementation
  - Reference Counting
  - Paste and Drag-Drop

- Chapter 14: Encryption Fundamentals
  - AES-256-GCM
  - Argon2id Key Derivation
  - Nonce Generation
  - Secure Memory Handling

- Chapter 15: Backup System
  - Backup Strategy
  - Creating Manifests
  - ZIP Archive Creation
  - Atomic Operations
  - Retention Policies

- Chapter 16: Restore Operations
  - Decrypt and Verify
  - Checksum Validation
  - Safe Restore Process
  - Rollback on Failure

- Chapter 17: Reminders and Scheduling
  - Reminder Model
  - tokio-cron-scheduler
  - Background Tasks
  - Notification Integration
  - Time Zones and Edge Cases

- Chapter 18: System Integration
  - System Tray Icon
  - Global Hotkeys
  - Window Management
  - Platform Differences

- Chapter 19: Collections and Organization
  - Collection Model
  - Hierarchical Data
  - Sorting and Ordering
  - UI/UX Patterns

- Chapter 20: Auto-Update System
  - Update Checking
  - Download Progress
  - Install Process
  - Version Migration

---

## Part 4: Polish & Deployment

- Chapter 21: Error Handling Patterns
  - Result and Option
  - Custom Error Types
  - Error Propagation
  - User-Friendly Messages
  - Logging Errors

- Chapter 22: Testing Strategies
  - Unit Tests
  - Integration Tests
  - E2E Tests with WebdriverIO
  - Test Database Setup
  - Mocking Tauri APIs

- Chapter 23: Building and Distribution
  - Release Builds
  - Code Signing
  - Creating Installers
  - NSIS Windows Installer (setup.exe)
  - CI/CD Setup

- Chapter 24: Performance Optimization
  - Profiling Rust Code
  - Database Query Optimization
  - Frontend Performance
  - Memory Management
  - Lazy Loading

- Chapter 25: Production Readiness
  - Logging and Monitoring
  - Crash Reporting
  - User Analytics (Privacy-Respecting)
  - Documentation
  - Maintenance Strategy

---

## Appendices

- Appendix A: Rust Quick Reference
- Appendix B: Tauri Command Catalog
- Appendix C: SQL Schema Reference
- Appendix D: Common Patterns and Recipes
- Appendix E: Troubleshooting Guide
- Appendix F: Further Resources

---

## Progress Tracking

- [Progress & Continuation](PROGRESS.md)
  - Chapters Completed
  - Current Status
  - Repository Facts
  - Glossary
  - Next Steps

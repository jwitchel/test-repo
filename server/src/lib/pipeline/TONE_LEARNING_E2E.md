# Tone Learning E2E Guide

This guide explains how to run the end-to-end tone learning system with John's test emails.

## Overview

The tone learning system:
1. Ingests historical emails into Qdrant vector database
2. Learns tone patterns for different relationships (spouse, colleague, friend, investor)
3. Selects relevant examples when generating draft replies
4. Formats prompts using Handlebars templates
5. (Future) Generates drafts using LLM with learned tone

## Prerequisites

Make sure Docker services are running:
```bash
docker compose up -d  # PostgreSQL, Redis, Qdrant
```

## Quick Start

### 1. Run Complete E2E Test
```bash
npm run tone:e2e
```

This will:
- Clear any existing test data
- Load all 900 John's emails
- Run through 4 test scenarios
- Show how the system selects examples for different recipients

### 2. Manual Steps

#### Load Test Data
```bash
# Load John's emails (900 emails across 9 files)
npm run tone:load

# Or specify a custom user ID
npm run tone:load custom-user-id
```

#### Clear Data
```bash
# Clear all data for default test user
npm run tone:clear

# Or clear specific user
npm run tone:clear custom-user-id
```

#### Reset (Clear + Load)
```bash
npm run tone:reset
```

#### Run Demo
```bash
# Run the orchestrator demo
npm run tone:demo
```

## Test Data Structure

John's emails are in `/johns_emails/` directory:
- 9 JSON files (john_emails_part1.json through part9.json)
- 100 emails per file = 900 total emails
- Date range: September 2024 - November 2024
- Recipients: Wife (Lisa), Coworker (Sarah), Friend (Mike), Investor (Jim)

Each email has:
- `recipient_type`: wife/coworker/friend/investor
- `subject`: Email subject (may be empty)
- `body`: Email content
- `tone_profile`: Tone identifier
- `scenario_type`: Context (e.g., logistics, venting, technical_issue)
- `length`: very_short/short/medium/long

## Components

### 1. TestDataLoader (`test-data-loader.ts`)
- Loads John's emails from JSON files
- Converts to ProcessedEmail format
- Maps recipient types to relationships
- Provides CLI interface for load/clear/reset

### 2. ToneLearningOrchestrator (`tone-learning-orchestrator.ts`)
- Coordinates all components
- Handles email ingestion
- Generates draft replies with tone
- Manages feedback processing
- Provides statistics

### 3. E2E Test (`test-e2e-flow.ts`)
- Demonstrates full workflow
- Tests 4 different scenarios:
  - Client performance issue
  - Wife planning weekend
  - Friend fantasy football
  - Investor quarterly update
- Shows example selection for each recipient

## Example Output

When you run `npm run tone:e2e`, you'll see:

```
🚀 Tone Learning E2E Test

Initializing services...
✅ Services initialized

Loading John's email history...
📬 Loading John's Email Test Data
Found 9 email files to process
📧 Loading john_emails_part1.json...
  ✅ Processed 100 emails
...

📊 Loaded Email Statistics:
  Total emails: 900
  Relationships:
    - spouse: 225
    - colleague: 315
    - friend: 180
    - professional: 180

📧 Scenario: Client Performance Issue
From: peterson@client.com
Subject: Urgent: System Performance Degradation

  → Generating reply to: sarah@company.com
    Relationship: colleague (85%)
    Examples used: 5
    Diversity score: 0.42

  → Generating reply to: jim@venturecapital.com
    Relationship: professional (92%)
    Examples used: 5
    Diversity score: 0.38
...
```

## Integration with LLM

The system generates formatted prompts ready for LLM integration. To complete the integration:

1. Add LLM service configuration
2. Update `generateDraft()` in orchestrator to call LLM
3. Implement feedback processing to improve tone learning

## Troubleshooting

### "Failed to initialize Qdrant"
```bash
# Make sure Qdrant is running
npm run qdrant:up
npm run test:qdrant  # Test connection
```

### "User data not found"
```bash
# Load the test data first
npm run tone:load
```

### Performance Issues
- Initial load of 900 emails takes ~30 seconds
- Subsequent queries are fast (<100ms)
- Qdrant indexes are created automatically
# PROMPTS.md

This file records AI-assisted coding prompts used while developing my Cloudflare Agent Project.

## 1. Testing Conversational Flow
**Prompt:**  
"The agent responds awkwardly or repeats itself. How can I make the system prompt more natural and prevent unnecessary tool calls?"  

**Purpose:**  
To improve dialogue coherence and enforce human-like tone.  

**Result:**  
Refined system prompt with clear role definition and behavioral constraints.

## 2. Intent-Based Tool Control
**Prompt:**  
"How can I make the agent conversational and only call tools when the user clearly mentions scheduling or reminders?"

**Result:**  
Added intent detection keywords (`remind`, `schedule`, `task`, `cancel`, `reminder`) to dynamically control tool visibility.
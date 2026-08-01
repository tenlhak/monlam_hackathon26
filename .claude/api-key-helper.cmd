@echo off
rem Emits the company Anthropic API key for Claude Code's apiKeyHelper.
rem Reads from .env so the key lives in exactly one place.
for /f "tokens=1,* delims==" %%a in ('findstr /b "CLAUDE_CODE_API_KEY=" "d:\monlam_hackthon\.env"') do echo %%b

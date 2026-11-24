@echo off
rem Double-click to launch the NFR Workspace showcase on http://localhost:3200
rem Add --rebuild to force a fresh build, --reset to restore the clean showcase day first,
rem or --dev for the development server. Stop it with Stop NFROS.cmd or by closing this window.
title NFR Workspace showcase (port 3200)
node "%~dp0scripts\launcher\launch.cjs" %*

@echo off
rem Double-click to launch the NFROS showcase on http://localhost:3200
rem Add --rebuild to force a fresh build, or --dev for the development server.
title NFROS showcase (port 3200)
node "%~dp0scripts\launcher\launch.cjs" %*

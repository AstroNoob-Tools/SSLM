; SSLM - SeaStar Library Manager - Inno Setup Installer Script
; Requires Inno Setup 6.x  ->  https://jrsoftware.org/isinfo.php
;
; BUILD STEPS:
;   1. Run "npm run build" from the project root to produce dist\sslm.exe
;   2. Open this file in Inno Setup Compiler and press F9 (Build > Compile)
;      OR run headlessly:
;      "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\sslm.iss
;   3. The finished installer appears at  installer\output\SSLM-Setup-v1.0.0.exe

#define AppName      "SSLM - SeaStar Library Manager"
#define AppShortName "SSLM"
#define AppVersion   "1.0.0-beta.1"
#define AppPublisher "SeaStar Library Manager"
#define AppExeName   "sslm.exe"
#define AppURL       "https://github.com/"

; ── Setup metadata ────────────────────────────────────────────────────────────
[Setup]
; Unique ID for this application - do NOT change after first release
AppId={{A3B8C2D1-4E5F-6789-ABCD-EF0123456789}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}

; Default install location requires no admin rights.
; If the user picks a protected folder (e.g. Program Files) the installer
; will automatically re-launch elevated and request UAC consent.
DefaultDirName={localappdata}\{#AppShortName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; Output
OutputDir=output
OutputBaseFilename=SSLM-Setup-v{#AppVersion}

; Compression
Compression=lzma2/ultra
SolidCompression=yes

; Wizard appearance
WizardStyle=modern
WizardImageFile=..\public\assets\sslm.png
WizardSmallImageFile=..\public\assets\sslmLogo.png
WizardImageStretch=yes
SetupIconFile=..\public\assets\sslm.ico
UninstallDisplayIcon={app}\{#AppExeName}

; Minimum Windows version: Windows 10
MinVersion=10.0

; ── Languages ─────────────────────────────────────────────────────────────────
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

; ── Optional tasks presented to the user ──────────────────────────────────────
[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; \
  GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

; ── Files to install ──────────────────────────────────────────────────────────
[Files]
; Main executable (built by "npm run build")
Source: "..\dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; ── Shortcuts ─────────────────────────────────────────────────────────────────
[Icons]
; Start Menu shortcut
Name: "{group}\{#AppName}";         Filename: "{app}\{#AppExeName}"
; Start Menu uninstall entry
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
; Optional Desktop shortcut (only if user ticked the task above)
Name: "{autodesktop}\{#AppShortName}"; Filename: "{app}\{#AppExeName}"; \
  Tasks: desktopicon

; ── Post-install launch option ────────────────────────────────────────────────
[Run]
; "Launch SSLM" checkbox on the final wizard page
Filename: "{app}\{#AppExeName}"; \
  Description: "{cm:LaunchProgram,{#AppName}}"; \
  Flags: nowait postinstall skipifsilent

; ── Uninstall cleanup ─────────────────────────────────────────────────────────
; Note: user settings in %APPDATA%\SSLM are intentionally left behind
; so favourites and preferences survive a reinstall.
[UninstallDelete]
Type: filesandordirs; Name: "{app}"

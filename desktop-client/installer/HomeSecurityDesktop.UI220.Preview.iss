; HOME SECURITY Desktop — instalator Inno Setup.
; Najpierw opublikuj aplikację do ..\publish-installer, następnie uruchom ISCC
; na tym pliku. Instalator pokazuje stronę wyboru katalogu i nie usuwa danych
; użytkownika z %LOCALAPPDATA%\HomeSecurityDesktop podczas odinstalowania.

#define AppName "HOME SECURITY Desktop — UI220 Preview"
#define AppVersion "1.4.8"
#define AppPublisher "HOME SECURITY"
#define AppExeName "HomeSecurityDesktop.exe"
#define PublishDir "..\publish-1.4.8"
#if !FileExists(PublishDir + "\Agent\" + AppVersion + "\HomeSecurityAgent.exe")
  #error "Run build-release.ps1 first: native agent is required."
#endif

[Setup]
AppId={{59C811BC-206E-4C40-B7F7-A8F6E1E03220}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Home Security UI220 Preview
DisableDirPage=no
UsePreviousAppDir=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\installer-output
OutputBaseFilename=HOME-SECURITY-Desktop-UI220-PREVIEW-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardImageFile=brand\wizard.bmp
WizardSmallImageFile=brand\wizard-small.bmp
SetupIconFile=brand\home-security.ico
UninstallDisplayIcon={app}\{#AppExeName}
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName={#AppName}

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Utwórz skrót na pulpicie"; GroupDescription: "Skróty:"; Flags: unchecked

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Uruchom wersję testową (tylko gdy zwykły nadajnik jest wyłączony)"; Flags: nowait postinstall skipifsilent unchecked

[Code]
function InitializeSetup(): Boolean;
var ExitCode: Integer;
begin
  Result := True;
  // Do not overwrite or launch a test sender while the real recorder is active.
  if Exec(ExpandConstant('{cmd}'),
    '/C tasklist /FI "IMAGENAME eq HomeSecurityDesktop.exe" | find /I "HomeSecurityDesktop.exe" >nul',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) and (ExitCode = 0) then
  begin
    MsgBox('HOME SECURITY Desktop jest uruchomiony. Najpierw zakończ nagrywanie, potwierdź zapis pliku i zamknij program. Dopiero potem uruchom instalator testowy.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure InitializeWizard;
begin
  WizardForm.Font.Name := 'Segoe UI';
  WizardForm.Color := $100D0C;
  WizardForm.MainPanel.Color := $1E1917;
  WizardForm.WizardSmallBitmapImage.BackColor := $1E1917;
  WizardForm.PageNameLabel.Font.Color := $F6F4F3;
  WizardForm.PageDescriptionLabel.Font.Color := $C5BAAF;
  WizardForm.WelcomeLabel1.Font.Color := $4429DC;
  WizardForm.FinishedHeadingLabel.Font.Color := $4429DC;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpSelectDir then
    WizardForm.DirEdit.Hint := 'Tu zostaną zainstalowane pliki programu. Dane i nagrania są przechowywane osobno w profilu użytkownika.';
end;

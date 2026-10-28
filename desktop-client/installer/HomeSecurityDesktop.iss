; HOME SECURITY Desktop — instalator Inno Setup.
; Najpierw opublikuj aplikację do ..\publish-installer, następnie uruchom ISCC
; na tym pliku. Instalator pokazuje stronę wyboru katalogu i nie usuwa danych
; użytkownika z %LOCALAPPDATA%\HomeSecurityDesktop podczas odinstalowania.

#define AppName "HOME SECURITY Desktop"
#define AppVersion "1.4.19"
#define AppPublisher "HOME SECURITY"
#define AppExeName "HomeSecurityDesktop.exe"
#define PublishDir "..\publish-1.4.19"
#if !FileExists(PublishDir + "\Agent\" + AppVersion + "\HomeSecurityAgent.exe")
  #error "Run build-release.ps1 first: native agent is required."
#endif

[Setup]
AppId={{6CC3B91C-0337-42B3-BAF8-B1AE10A5B1B8}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Home Security
DisableDirPage=no
UsePreviousAppDir=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\installer-output
OutputBaseFilename=HOME-SECURITY-Desktop-Setup-{#AppVersion}
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
Filename: "{app}\{#AppExeName}"; Description: "Uruchom {#AppName}"; Flags: nowait postinstall skipifsilent

[Code]
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

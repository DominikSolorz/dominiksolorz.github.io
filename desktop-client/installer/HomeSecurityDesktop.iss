; HOME SECURITY Desktop — instalator Inno Setup.
; Najpierw opublikuj aplikację do ..\publish-installer, następnie uruchom ISCC
; na tym pliku. Instalator pokazuje stronę wyboru katalogu i nie usuwa danych
; użytkownika z %LOCALAPPDATA%\HomeSecurityDesktop podczas odinstalowania.

#define AppName "HOME SECURITY Desktop"
#define AppVersion "1.3.1"
#define AppPublisher "HOME SECURITY"
#define AppExeName "HomeSecurityDesktop.exe"
#define PublishDir "..\publish-1.3.1"

[Setup]
AppId={{6CC3B91C-0337-42B3-BAF8-B1AE10A5B1B8}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Home Security
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\installer-output
OutputBaseFilename=HOME-SECURITY-Desktop-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName={#AppName}

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Utwórz skrót na pulpicie"; GroupDescription: "Skróty:"; Flags: unchecked

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Uruchom {#AppName}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpSelectDir then
    WizardForm.DirEdit.Hint := 'Tu zostaną zainstalowane pliki programu. Dane i nagrania są przechowywane osobno w profilu użytkownika.';
end;

Option Explicit

' Uruchamia prywatną kamerę raz po zalogowaniu do Windows. Korzysta z normalnego
' profilu Chrome/Edge, aby zachować zgodę kamery oraz wybrany folder archiwum.
' Nie uruchamia pętli — dzięki temu nie tworzy dodatkowych kart ani nagrań.
Dim shell, browser, url
Set shell = CreateObject("WScript.Shell")
url = "https://dominiksolorz.github.io/kamera/#nadaj"
browser = FindBrowser()
If browser = "" Then WScript.Quit 2
shell.Run Chr(34) & browser & Chr(34) & " --app=" & url & " --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows", 0, False

Function FindBrowser()
  Dim paths, p
  paths = Array(shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe", shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe", shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe")
  For Each p In paths
    If CreateObject("Scripting.FileSystemObject").FileExists(p) Then FindBrowser = p: Exit Function
  Next
  FindBrowser = ""
End Function

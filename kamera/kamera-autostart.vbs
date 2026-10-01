Option Explicit

' Uruchamia prywatną kamerę po zalogowaniu do Windows i co minutę sprawdza,
' czy okno aplikacji nadal działa. Korzysta z normalnego profilu Chrome/Edge,
' aby zachować wcześniej udzieloną zgodę kamery oraz wybrany folder archiwum.
Dim shell, wmi, browser, url
Set shell = CreateObject("WScript.Shell")
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
url = "https://dominiksolorz.github.io/kamera/#nadaj"
browser = FindBrowser()
If browser = "" Then WScript.Quit 2

Do
  If Not CameraRunning() Then shell.Run Chr(34) & browser & Chr(34) & " --app=" & url & " --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows", 0, False
  WScript.Sleep 60000
Loop

Function FindBrowser()
  Dim paths, p
  paths = Array(shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe", shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe", shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe")
  For Each p In paths
    If CreateObject("Scripting.FileSystemObject").FileExists(p) Then FindBrowser = p: Exit Function
  Next
  FindBrowser = ""
End Function

Function CameraRunning()
  Dim p, cmd
  CameraRunning = False
  For Each p In wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='chrome.exe' OR Name='msedge.exe'")
    cmd = LCase("" & p.CommandLine)
    If InStr(cmd, "dominiksolorz.github.io/kamera") > 0 Then CameraRunning = True: Exit Function
  Next
End Function

Option Explicit
Dim shell, fso, basePath, electronPath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
basePath = fso.GetParentFolderName(WScript.ScriptFullName)
electronPath = basePath & "\node_modules\electron\dist\electron.exe"

If fso.FileExists(electronPath) Then
  command = Chr(34) & electronPath & Chr(34) & " " & Chr(34) & basePath & Chr(34)
  shell.Run command, 0, False
Else
  shell.Run Chr(34) & basePath & "\start.bat" & Chr(34), 1, False
End If

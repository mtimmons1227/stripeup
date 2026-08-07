@echo off
title StripeUp - Create Desktop Icon
echo Creating the "StripeUp Dev" icon on your Desktop...
echo.

set "VBS=%TEMP%\stripeup_shortcut.vbs"
> "%VBS%" echo Set oWS = WScript.CreateObject("WScript.Shell")
>> "%VBS%" echo sDesktop = oWS.SpecialFolders("Desktop")
>> "%VBS%" echo Set oLink = oWS.CreateShortcut(sDesktop ^& "\StripeUp Dev.lnk")
>> "%VBS%" echo oLink.TargetPath = "C:\StripeUp\officials\Launch-StripeUp.bat"
>> "%VBS%" echo oLink.WorkingDirectory = "C:\StripeUp\officials"
>> "%VBS%" echo oLink.IconLocation = "%SystemRoot%\System32\SHELL32.dll, 137"
>> "%VBS%" echo oLink.Description = "Launch StripeUp local dev server + Claude Code"
>> "%VBS%" echo oLink.Save
cscript //nologo "%VBS%"
del "%VBS%"

echo.
echo  Done!  Look for  "StripeUp Dev"  on your Desktop.
echo  Double-click it any time to start working.
echo.
pause

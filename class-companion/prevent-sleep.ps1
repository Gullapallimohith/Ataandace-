Add-Type -MemberDefinition @"
[DllImport("kernel32.dll")]
public static extern int SetThreadExecutionState(int esFlags);
"@ -Name "Power" -Namespace "Win32"

[Win32.Power]::SetThreadExecutionState([int]0x80000001)
Write-Output "Windows sleep successfully prevented"

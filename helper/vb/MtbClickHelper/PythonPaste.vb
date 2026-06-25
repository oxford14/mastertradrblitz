Imports System
Imports System.Diagnostics
Imports System.IO
Imports System.Text

Public Module PythonPaste
    Private Function HelperRoot() As String
        Dim exeDir = Path.GetDirectoryName(
            Process.GetCurrentProcess().MainModule.FileName)
        Return Path.GetFullPath(Path.Combine(exeDir, "..", "..", "..", ".."))
    End Function

    Private Function ScriptPath() As String
        Return Path.Combine(HelperRoot(), "paste_amount.py")
    End Function

    Private Function FindPythonLauncher() As String
        Dim candidates = New String() {
            "py",
            "python",
            "python3"
        }
        For Each name As String In candidates
            Try
                Dim psi As New ProcessStartInfo With {
                    .FileName = name,
                    .Arguments = If(name = "py", "-3 --version", "--version"),
                    .UseShellExecute = False,
                    .RedirectStandardOutput = True,
                    .RedirectStandardError = True,
                    .CreateNoWindow = True
                }
                Using proc = Process.Start(psi)
                    proc.WaitForExit(5000)
                    If proc.ExitCode = 0 Then Return name
                End Using
            Catch
            End Try
        Next
        Return Nothing
    End Function

    Public Function PasteAmount(amount As String, Optional mode As String = "paste") As String
        Dim digits = ExtractDigits(amount)
        If digits.Length = 0 Then
            Throw New InvalidOperationException("No digits in amount")
        End If

        Dim script = ScriptPath()
        If Not File.Exists(script) Then
            Throw New InvalidOperationException($"Missing paste script: {script}")
        End If

        Dim python = FindPythonLauncher()
        If python Is Nothing Then
            Throw New InvalidOperationException(
                "Python not found — install Python 3 and run: pip install -r helper\requirements.txt")
        End If

        Dim args = $"-3 ""{script}"" {digits} --mode {mode} --wait-ms 80"
        If python <> "py" Then
            args = $"""{script}"" {digits} --mode {mode} --wait-ms 80"
        End If

        Dim psi As New ProcessStartInfo With {
            .FileName = python,
            .Arguments = args,
            .UseShellExecute = False,
            .RedirectStandardOutput = True,
            .RedirectStandardError = True,
            .CreateNoWindow = True,
            .StandardOutputEncoding = Encoding.UTF8,
            .StandardErrorEncoding = Encoding.UTF8
        }

        Using proc = Process.Start(psi)
            Dim stdout = proc.StandardOutput.ReadToEnd().Trim()
            Dim stderr = proc.StandardError.ReadToEnd().Trim()
            proc.WaitForExit(15000)
            If proc.ExitCode <> 0 Then
                Dim detail = If(String.IsNullOrWhiteSpace(stderr), stdout, stderr)
                Throw New InvalidOperationException(
                    If(String.IsNullOrWhiteSpace(detail), "Python paste failed", detail))
            End If
            Return If(String.IsNullOrWhiteSpace(stdout), $"pasted {digits}", stdout)
        End Using
    End Function

    Private Function ExtractDigits(amount As String) As String
        If String.IsNullOrEmpty(amount) Then Return ""
        Dim builder As New StringBuilder()
        For Each ch As Char In amount
            If ch >= "0"c AndAlso ch <= "9"c Then builder.Append(ch)
        Next
        Return builder.ToString()
    End Function
End Module

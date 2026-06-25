Imports System
Imports System.Windows.Forms

Module Program
    <STAThread>
    Sub Main()
        Try
            Application.EnableVisualStyles()
            Application.SetCompatibleTextRenderingDefault(False)

            Dim args = Environment.GetCommandLineArgs()
            Dim hostMode = HasFlag(args, "--host")
            Dim keypadMode = HasFlag(args, "--keypad")

            If hostMode Then
                NativeHost.Run()
            ElseIf keypadMode Then
                Application.Run(New KeypadCalibratorForm())
            Else
                Application.Run(New CalibratorForm())
            End If
        Catch ex As Exception
            Dim detail = ex.Message
            If ex.InnerException IsNot Nothing Then
                detail &= Environment.NewLine & ex.InnerException.Message
            End If
            MessageBox.Show(
                "MtbClickHelper failed to start:" & Environment.NewLine & detail,
                "MTB Click Helper",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error)
        End Try
    End Sub

    Private Function HasFlag(args As String(), flag As String) As Boolean
        For i As Integer = 1 To args.Length - 1
            If String.Equals(args(i), flag, StringComparison.OrdinalIgnoreCase) Then
                Return True
            End If
        Next
        Return False
    End Function
End Module

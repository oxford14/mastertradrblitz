Imports System
Imports System.Drawing
Imports System.Runtime.InteropServices
Imports System.Threading

Public Module WindowFocus
    <DllImport("user32.dll")>
    Private Function WindowFromPoint(ByVal Point As Point) As IntPtr
    End Function

    <DllImport("user32.dll")>
    Private Function SetForegroundWindow(hWnd As IntPtr) As Boolean
    End Function

    Public Sub BringToForegroundAt(screenX As Integer, screenY As Integer)
        Try
            Dim hwnd = WindowFromPoint(New Point(screenX, screenY))
            If hwnd <> IntPtr.Zero Then
                SetForegroundWindow(hwnd)
                Thread.Sleep(120)
            End If
        Catch
            ' Best effort — clicks may still land on the target window.
        End Try
    End Sub
End Module

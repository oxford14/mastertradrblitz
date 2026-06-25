Imports System
Imports System.Runtime.InteropServices

Public Module NativeMouseClick
    Private Const InputMouse As UInteger = 0
    Private Const MouseeventfLeftdown As UInteger = &H2
    Private Const MouseeventfLeftup As UInteger = &H4
    Private Const MouseeventfAbsolute As UInteger = &H8000
    Private Const MouseeventfMove As UInteger = &H1

    <StructLayout(LayoutKind.Sequential)>
    Private Structure Input
        Public Type As UInteger
        Public Mouse As MouseInput
    End Structure

    <StructLayout(LayoutKind.Sequential)>
    Private Structure MouseInput
        Public Dx As Integer
        Public Dy As Integer
        Public MouseData As UInteger
        Public DwFlags As UInteger
        Public Time As UInteger
        Public DwExtraInfo As IntPtr
    End Structure

    <DllImport("user32.dll", SetLastError:=True)>
    Private Function SendInput(
        nInputs As UInteger,
        pInputs As Input(),
        cbSize As Integer) As UInteger
    End Function

    <DllImport("user32.dll")>
    Private Function GetSystemMetrics(nIndex As Integer) As Integer
    End Function

    Private Const SmCxvirtualscreen As Integer = 78
    Private Const SmCyvirtualscreen As Integer = 79
    Private Const SmXvirtualscreen As Integer = 76
    Private Const SmYvirtualscreen As Integer = 77

    Public Sub ClickScreen(x As Integer, y As Integer)
        Dim vLeft = GetSystemMetrics(SmXvirtualscreen)
        Dim vTop = GetSystemMetrics(SmYvirtualscreen)
        Dim vWidth = GetSystemMetrics(SmCxvirtualscreen)
        Dim vHeight = GetSystemMetrics(SmCyvirtualscreen)

        Dim absX = CInt(((x - vLeft) * 65535.0) / Math.Max(1, vWidth - 1))
        Dim absY = CInt(((y - vTop) * 65535.0) / Math.Max(1, vHeight - 1))

        Dim inputs(2) As Input

        inputs(0).Type = InputMouse
        inputs(0).Mouse.Dx = absX
        inputs(0).Mouse.Dy = absY
        inputs(0).Mouse.DwFlags = MouseeventfMove Or MouseeventfAbsolute

        inputs(1).Type = InputMouse
        inputs(1).Mouse.Dx = absX
        inputs(1).Mouse.Dy = absY
        inputs(1).Mouse.DwFlags = MouseeventfLeftdown Or MouseeventfAbsolute

        inputs(2).Type = InputMouse
        inputs(2).Mouse.Dx = absX
        inputs(2).Mouse.Dy = absY
        inputs(2).Mouse.DwFlags = MouseeventfLeftup Or MouseeventfAbsolute

        SendInput(3, inputs, Marshal.SizeOf(GetType(Input)))
    End Sub

    Public Sub MoveScreen(x As Integer, y As Integer)
        Dim vLeft = GetSystemMetrics(SmXvirtualscreen)
        Dim vTop = GetSystemMetrics(SmYvirtualscreen)
        Dim vWidth = GetSystemMetrics(SmCxvirtualscreen)
        Dim vHeight = GetSystemMetrics(SmCyvirtualscreen)

        Dim absX = CInt(((x - vLeft) * 65535.0) / Math.Max(1, vWidth - 1))
        Dim absY = CInt(((y - vTop) * 65535.0) / Math.Max(1, vHeight - 1))

        Dim inputs(0) As Input
        inputs(0).Type = InputMouse
        inputs(0).Mouse.Dx = absX
        inputs(0).Mouse.Dy = absY
        inputs(0).Mouse.DwFlags = MouseeventfMove Or MouseeventfAbsolute
        SendInput(1, inputs, Marshal.SizeOf(GetType(Input)))
    End Sub

    Public Sub DoubleClickScreen(x As Integer, y As Integer)
        MoveScreen(x, y)
        ClickScreen(x, y)
        System.Threading.Thread.Sleep(40)
        ClickScreen(x, y)
    End Sub

    Public Sub TripleClickScreen(x As Integer, y As Integer)
        MoveScreen(x, y)
        ClickScreen(x, y)
        System.Threading.Thread.Sleep(40)
        ClickScreen(x, y)
        System.Threading.Thread.Sleep(40)
        ClickScreen(x, y)
    End Sub
End Module

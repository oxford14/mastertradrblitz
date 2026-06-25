Imports System
Imports System.Runtime.InteropServices
Imports System.Threading
Imports System.Windows.Forms

Public Module KeyboardInput
    Private Const InputKeyboard As UInteger = 1
    Private Const KeyeventfKeyup As UInteger = &H2
    Private Const KeyeventfUnicode As UInteger = &H4
    Private Const VkControl As UShort = &H11
    Private Const VkA As UShort = &H41
    Private Const VkV As UShort = &H56
    Private Const VkReturn As UShort = &HD

    <StructLayout(LayoutKind.Sequential)>
    Private Structure Input
        Public Type As UInteger
        Public Keyboard As KeyboardInputData
    End Structure

    <StructLayout(LayoutKind.Sequential)>
    Private Structure KeyboardInputData
        Public WVk As UShort
        Public WScan As UShort
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

    Private ReadOnly InputSize As Integer = Marshal.SizeOf(GetType(Input))

    Private Sub KeyDown(vk As UShort)
        Dim inputs(0) As Input
        inputs(0).Type = InputKeyboard
        inputs(0).Keyboard.WVk = vk
        inputs(0).Keyboard.DwFlags = 0
        SendInput(1, inputs, InputSize)
    End Sub

    Private Sub KeyUp(vk As UShort)
        Dim inputs(0) As Input
        inputs(0).Type = InputKeyboard
        inputs(0).Keyboard.WVk = vk
        inputs(0).Keyboard.DwFlags = KeyeventfKeyup
        SendInput(1, inputs, InputSize)
    End Sub

    Private Sub TapKey(vk As UShort)
        KeyDown(vk)
        KeyUp(vk)
    End Sub

    Private Sub TypeUnicode(ch As Char)
        Dim code = CUShort(Convert.ToInt32(ch))
        Dim inputs(1) As Input

        inputs(0).Type = InputKeyboard
        inputs(0).Keyboard.WVk = 0
        inputs(0).Keyboard.WScan = code
        inputs(0).Keyboard.DwFlags = KeyeventfUnicode

        inputs(1).Type = InputKeyboard
        inputs(1).Keyboard.WVk = 0
        inputs(1).Keyboard.WScan = code
        inputs(1).Keyboard.DwFlags = KeyeventfUnicode Or KeyeventfKeyup

        SendInput(2, inputs, InputSize)
    End Sub

    Private Sub PasteFromClipboard()
        KeyDown(VkControl)
        TapKey(VkV)
        KeyUp(VkControl)
        Thread.Sleep(80)
    End Sub

    Private Function BackupClipboardText() As String
        Try
            If Clipboard.ContainsText() Then Return Clipboard.GetText()
        Catch
        End Try
        Return Nothing
    End Function

    Private Sub RestoreClipboardText(backup As String)
        Try
            If backup IsNot Nothing Then
                Clipboard.SetText(backup)
            End If
        Catch
        End Try
    End Sub

    Public Sub SelectAll()
        KeyDown(VkControl)
        TapKey(VkA)
        KeyUp(VkControl)
        Thread.Sleep(50)
    End Sub

    Public Sub TypeText(text As String)
        If String.IsNullOrEmpty(text) Then Return
        For Each ch As Char In text
            If ch >= "0"c AndAlso ch <= "9"c Then
                TypeUnicode(ch)
                Thread.Sleep(25)
            End If
        Next
    End Sub

    ''' <summary>Virtual-key digit presses (VK_0–VK_9) — closer to a physical keyboard than unicode injection.</summary>
    Public Sub TypeDigitsVk(text As String)
        If String.IsNullOrEmpty(text) Then Return
        For Each ch As Char In text
            If ch >= "0"c AndAlso ch <= "9"c Then
                TapKey(CUShort(Convert.ToUInt32(ch)))
                Thread.Sleep(30)
            End If
        Next
    End Sub

    Public Sub PressEnter()
        TapKey(VkReturn)
    End Sub

  ''' <summary>
  ''' After the invest field is focused (double-click), replace its value.
  ''' Clipboard paste is most reliable in Chromium; unicode typing is the fallback.
  ''' </summary>
    Public Sub ReplaceFieldText(text As String)
        If String.IsNullOrEmpty(text) Then Return

        Dim backup = BackupClipboardText()
        Try
            Clipboard.SetText(text)
            Thread.Sleep(60)
            SelectAll()
            Thread.Sleep(40)
            PasteFromClipboard()
            Thread.Sleep(60)
        Catch
            SelectAll()
            Thread.Sleep(40)
            TypeText(text)
        Finally
            RestoreClipboardText(backup)
        End Try
    End Sub

    Public Sub SelectAllAndType(text As String)
        ReplaceFieldText(text)
    End Sub
End Module

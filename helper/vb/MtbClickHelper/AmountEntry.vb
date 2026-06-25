Imports System
Imports System.Collections.Generic
Imports System.Threading

Public Module AmountEntry
    Private Const DelayAfterFocusMs As Integer = 250
    Private ReadOnly KeypadKeys As String() = {
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "clear"
    }

    Public Sub FocusAmount(amountField As PointTarget)
        If amountField Is Nothing Then
            Throw New InvalidOperationException("Missing amount field target")
        End If

        WindowFocus.BringToForegroundAt(amountField.x, amountField.y)
        NativeMouseClick.DoubleClickScreen(amountField.x, amountField.y)
        Thread.Sleep(DelayAfterFocusMs)
    End Sub

    Public Function PasteAmount(amountField As PointTarget, amount As String, Optional focusFirst As Boolean = True) As String
        If amountField Is Nothing Then
            Throw New InvalidOperationException("Missing amount field target")
        End If

        If focusFirst Then
            FocusAmount(amountField)
        End If

        Return PythonPaste.PasteAmount(amount, "paste")
    End Function

    Public Sub TypeAmountVk(amountField As PointTarget, amount As String, Optional focusFirst As Boolean = True)
        If amountField Is Nothing Then
            Throw New InvalidOperationException("Missing amount field target")
        End If

        Dim digits = ExtractDigits(amount)
        If digits.Length = 0 Then
            Throw New InvalidOperationException("No digits in amount")
        End If

        If focusFirst Then
            FocusAmount(amountField)
        End If

        NativeMouseClick.TripleClickScreen(amountField.x, amountField.y)
        Thread.Sleep(80)
        KeyboardInput.TypeDigitsVk(digits)
        Thread.Sleep(60)
    End Sub

    Public Sub EnterAmountViaKeypad(
        amountField As PointTarget,
        keypad As Dictionary(Of String, PointTarget),
        amount As String)
        If amountField Is Nothing Then
            Throw New InvalidOperationException("Missing amount field target")
        End If
        If keypad Is Nothing OrElse Not ClickTargets.HasKeypad(New ClickTargetsData With {.keypad = keypad}) Then
            Throw New InvalidOperationException("Keypad not calibrated — run helper\run-keypad-calibrator.bat")
        End If

        Dim digits = ExtractDigits(amount)
        If digits.Length = 0 Then
            Throw New InvalidOperationException("No digits in amount")
        End If

        FocusAmount(amountField)

        Dim clearTarget = keypad("clear")
        NativeMouseClick.ClickScreen(clearTarget.x, clearTarget.y)
        Thread.Sleep(120)

        For Each ch As Char In digits
            Dim key = ch.ToString()
            Dim target = keypad(key)
            NativeMouseClick.ClickScreen(target.x, target.y)
            Thread.Sleep(90)
        Next
    End Sub

    Private Function ExtractDigits(amount As String) As String
        If String.IsNullOrEmpty(amount) Then Return ""
        Dim builder As New System.Text.StringBuilder()
        For Each ch As Char In amount
            If ch >= "0"c AndAlso ch <= "9"c Then builder.Append(ch)
        Next
        Return builder.ToString()
    End Function
End Module

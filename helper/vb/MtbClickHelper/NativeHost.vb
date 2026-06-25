Imports System
Imports System.Collections.Generic
Imports System.IO
Imports System.Text
Imports System.Web.Script.Serialization

Public Module NativeHost
    Private ReadOnly Serializer As New JavaScriptSerializer()

    Public Sub Run()
        Using input = Console.OpenStandardInput()
            Using output = Console.OpenStandardOutput()
                While True
                    Dim message = ReadMessage(input)
                    If message Is Nothing Then Exit While
                    Dim response = HandleMessage(message)
                    WriteMessage(output, response)
                End While
            End Using
        End Using
    End Sub

    Private Function ReadMessage(input As Stream) As Dictionary(Of String, Object)
        Dim lengthBytes(3) As Byte
        Dim read = input.Read(lengthBytes, 0, 4)
        If read = 0 Then Return Nothing
        If read < 4 Then Return New Dictionary(Of String, Object) From {{"action", "error"}}

        Dim length = BitConverter.ToUInt32(lengthBytes, 0)
        If length = 0 OrElse length > 1024 * 1024 Then
            Return New Dictionary(Of String, Object) From {{"action", "error"}}
        End If

        Dim payload(CInt(length) - 1) As Byte
        Dim offset = 0
        While offset < length
            Dim chunk = input.Read(payload, offset, CInt(length) - offset)
            If chunk <= 0 Then Return Nothing
            offset += chunk
        End While

        Dim json = Encoding.UTF8.GetString(payload)
        Return Serializer.Deserialize(Of Dictionary(Of String, Object))(json)
    End Function

    Private Sub WriteMessage(output As Stream, response As Dictionary(Of String, Object))
        Dim json = Serializer.Serialize(response)
        Dim payload = Encoding.UTF8.GetBytes(json)
        Dim lengthBytes = BitConverter.GetBytes(CUInt(payload.Length))
        output.Write(lengthBytes, 0, 4)
        output.Write(payload, 0, payload.Length)
        output.Flush()
    End Sub

    Public Function HandleMessage(message As Dictionary(Of String, Object)) As Dictionary(Of String, Object)
        Dim action = If(message.ContainsKey("action"), Convert.ToString(message("action")), "")

        Select Case action
            Case "ping"
                Return Ok("pong")

            Case "getTargets"
                Return HandleGetTargets()

            Case "click"
                Return HandleClick(message)

            Case "setAmount"
                Return HandleSetAmount(message)

            Case "focusAmount"
                Return HandleFocusAmount()

            Case "typeAmount"
                Return HandleTypeAmount(message)

            Case "pasteAmount"
                Return HandlePasteAmount(message)

            Case "keypadAmount"
                Return HandleKeypadAmount(message)

            Case Else
                Return Fail($"Unknown action: {action}")
        End Select
    End Function

    Private Function HandleGetTargets() As Dictionary(Of String, Object)
        Dim data = ClickTargets.Load()
        If Not ClickTargets.IsCalibrated(data) Then
            Return Fail("Not calibrated — run MtbClickHelper.exe --calibrate")
        End If

        Dim response As New Dictionary(Of String, Object) From {
            {"ok", True},
            {"message", "targets loaded"},
            {"higher", New Dictionary(Of String, Object) From {{"x", data.higher.x}, {"y", data.higher.y}}},
            {"lower", New Dictionary(Of String, Object) From {{"x", data.lower.x}, {"y", data.lower.y}}},
            {"updatedAt", If(data.updatedAt, "")}
        }
        If ClickTargets.HasAmountTarget(data) Then
            response("amount") = New Dictionary(Of String, Object) From {
                {"x", data.amount.x},
                {"y", data.amount.y}
            }
        End If
        Return response
    End Function

    Private Function HandleClick(message As Dictionary(Of String, Object)) As Dictionary(Of String, Object)
        If message.ContainsKey("signal") Then
            Dim signal = Convert.ToString(message("signal"))
            Dim data = ClickTargets.Load()
            Dim target = ClickTargets.ResolveSignal(data, signal)
            If target Is Nothing Then
                Return Fail("Not calibrated — run MtbClickHelper.exe --calibrate")
            End If
            NativeMouseClick.ClickScreen(target.x, target.y)
            Return Ok($"clicked {signal.ToUpperInvariant()} @ {target.x}, {target.y}")
        End If

        If message.ContainsKey("x") AndAlso message.ContainsKey("y") Then
            Dim x = Convert.ToInt32(message("x"))
            Dim y = Convert.ToInt32(message("y"))
            NativeMouseClick.ClickScreen(x, y)
            Return Ok($"clicked {x}, {y}")
        End If

        Return Fail("click requires signal or x/y")
    End Function

    Private Function HandleFocusAmount() As Dictionary(Of String, Object)
        Dim data = ClickTargets.Load()
        If Not ClickTargets.HasAmountTarget(data) Then
            Return Fail("Amount field not calibrated — run MtbClickHelper.exe and drag AMOUNT onto Invest")
        End If

        Try
            AmountEntry.FocusAmount(data.amount)
        Catch ex As Exception
            Return Fail(ex.Message)
        End Try

        Return Ok("focused amount field")
    End Function

    Private Function HandlePasteAmount(message As Dictionary(Of String, Object)) As Dictionary(Of String, Object)
        If Not message.ContainsKey("amount") Then
            Return Fail("pasteAmount requires amount")
        End If

        Dim amount = Convert.ToString(message("amount"))
        If String.IsNullOrWhiteSpace(amount) Then
            Return Fail("amount must be a non-empty string")
        End If

        Dim data = ClickTargets.Load()
        If Not ClickTargets.HasAmountTarget(data) Then
            Return Fail("Amount field not calibrated — run MtbClickHelper.exe and drag AMOUNT onto Invest")
        End If

        Try
            Dim detail = AmountEntry.PasteAmount(data.amount, amount, True)
            Return Ok(detail)
        Catch ex As Exception
            Return Fail(ex.Message)
        End Try
    End Function

    Private Function HandleTypeAmount(message As Dictionary(Of String, Object)) As Dictionary(Of String, Object)
        If Not message.ContainsKey("amount") Then
            Return Fail("typeAmount requires amount")
        End If

        Dim amount = Convert.ToString(message("amount"))
        If String.IsNullOrWhiteSpace(amount) Then
            Return Fail("amount must be a non-empty string")
        End If

        Dim data = ClickTargets.Load()
        If Not ClickTargets.HasAmountTarget(data) Then
            Return Fail("Amount field not calibrated — run MtbClickHelper.exe and drag AMOUNT onto Invest")
        End If

        Try
            AmountEntry.TypeAmountVk(data.amount, amount, True)
        Catch ex As Exception
            Return Fail(ex.Message)
        End Try

        Return Ok($"typed amount {amount} via VK digits")
    End Function

    Private Function HandleKeypadAmount(message As Dictionary(Of String, Object)) As Dictionary(Of String, Object)
        If Not message.ContainsKey("amount") Then
            Return Fail("keypadAmount requires amount")
        End If

        Dim amount = Convert.ToString(message("amount"))
        If String.IsNullOrWhiteSpace(amount) Then
            Return Fail("amount must be a non-empty string")
        End If

        Dim data = ClickTargets.Load()
        If Not ClickTargets.HasAmountTarget(data) Then
            Return Fail("Amount field not calibrated — run MtbClickHelper.exe and drag AMOUNT onto Invest")
        End If
        If Not ClickTargets.HasKeypad(data) Then
            Return Fail("Keypad not calibrated — run helper\run-keypad-calibrator.bat")
        End If

        Try
            AmountEntry.EnterAmountViaKeypad(data.amount, data.keypad, amount)
        Catch ex As Exception
            Return Fail(ex.Message)
        End Try

        Return Ok($"set amount {amount} via keypad clicks")
    End Function

    Private Function HandleSetAmount(message As Dictionary(Of String, Object)) As Dictionary(Of String, Object)
        If Not message.ContainsKey("amount") Then
            Return Fail("setAmount requires amount")
        End If

        Dim amount = Convert.ToString(message("amount"))
        If String.IsNullOrWhiteSpace(amount) Then
            Return Fail("amount must be a non-empty string")
        End If

        Dim focus = HandleFocusAmount()
        If Not Convert.ToBoolean(focus("ok")) Then Return focus
        Return HandleTypeAmount(message)
    End Function

    Private Function Ok(message As String) As Dictionary(Of String, Object)
        Return New Dictionary(Of String, Object) From {
            {"ok", True},
            {"message", message}
        }
    End Function

    Private Function Fail(message As String) As Dictionary(Of String, Object)
        Return New Dictionary(Of String, Object) From {
            {"ok", False},
            {"message", message}
        }
    End Function
End Module

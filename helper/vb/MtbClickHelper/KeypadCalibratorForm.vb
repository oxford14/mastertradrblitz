Imports System
Imports System.Collections.Generic
Imports System.Drawing
Imports System.Windows.Forms

Public Class KeypadCalibratorForm
    Inherits Form

    Private ReadOnly _toolbar As Panel
    Private ReadOnly _buttonBar As FlowLayoutPanel
    Private ReadOnly _btnSave As Button
    Private ReadOnly _btnTest As Button
    Private ReadOnly _btnExit As Button
    Private ReadOnly _lblHint As Label
    Private ReadOnly _canvas As Panel
    Private ReadOnly _markers As New Dictionary(Of String, DraggableMarker)()

    Public Sub New()
        Me.Text = "MTB Keypad Calibrator"
        Me.FormBorderStyle = FormBorderStyle.None
        Me.WindowState = FormWindowState.Maximized
        Me.TopMost = True
        Me.BackColor = Color.FromArgb(15, 25, 35)
        Me.Opacity = 0.94
        Me.KeyPreview = True

        _toolbar = New Panel With {
            .Dock = DockStyle.Top,
            .Height = 56,
            .BackColor = Color.FromArgb(15, 20, 28)
        }

        _buttonBar = New FlowLayoutPanel With {
            .Dock = DockStyle.Left,
            .AutoSize = True,
            .FlowDirection = FlowDirection.LeftToRight,
            .Padding = New Padding(8, 10, 8, 8),
            .BackColor = Color.FromArgb(15, 20, 28)
        }

        _btnSave = CreateToolbarButton("Save", Color.FromArgb(34, 120, 70))
        _btnTest = CreateToolbarButton("Test 488", Color.FromArgb(40, 50, 65))
        _btnExit = CreateToolbarButton("Exit", Color.FromArgb(80, 45, 45))

        _buttonBar.Controls.Add(_btnSave)
        _buttonBar.Controls.Add(_btnTest)
        _buttonBar.Controls.Add(_btnExit)

        _lblHint = New Label With {
            .Dock = DockStyle.Fill,
            .ForeColor = Color.Gainsboro,
            .TextAlign = ContentAlignment.MiddleLeft,
            .Text = "Drag 0–9 and CLR onto Exnova's on-screen amount keypad. AMOUNT must already be calibrated in run-calibrator.bat.",
            .Font = New Font("Segoe UI", 10.0F),
            .Padding = New Padding(12, 0, 0, 0),
            .BackColor = Color.FromArgb(15, 20, 28)
        }

        _toolbar.Controls.Add(_lblHint)
        _toolbar.Controls.Add(_buttonBar)

        _canvas = New Panel With {
            .Dock = DockStyle.Fill,
            .BackColor = Color.FromArgb(15, 25, 35)
        }

        For Each key As String In ClickTargets.KeypadDigitKeys()
            Dim label = If(key = "clear", "CLR", key)
            Dim color = If(key = "clear", Color.FromArgb(220, 80, 80), Color.FromArgb(245, 158, 11))
            Dim marker = New DraggableMarker(label, color, New Size(52, 36), 10.0F)
            _markers(key) = marker
            _canvas.Controls.Add(marker)
        Next

        Me.Controls.Add(_canvas)
        Me.Controls.Add(_toolbar)

        AddHandler Me.Shown, AddressOf OnFormShown
        AddHandler _btnSave.Click, AddressOf OnSave
        AddHandler _btnTest.Click, AddressOf OnTest
        AddHandler _btnExit.Click, Sub() Me.Close()
    End Sub

    Private Function CreateToolbarButton(text As String, backColor As Color) As Button
        Return New Button With {
            .Text = text,
            .AutoSize = True,
            .MinimumSize = New Size(88, 34),
            .Height = 34,
            .Margin = New Padding(0, 0, 8, 0),
            .FlatStyle = FlatStyle.Flat,
            .BackColor = backColor,
            .ForeColor = Color.White,
            .Font = New Font("Segoe UI", 9.0F, FontStyle.Bold)
        }
    End Function

    Private Sub OnFormShown(sender As Object, e As EventArgs)
        Dim data = ClickTargets.LoadOrDefault()
        Dim area = ClickTargets.GetScreenWorkingArea()
        Dim startX = area.Left + CInt(area.Width * 0.72)
        Dim startY = area.Top + CInt(area.Height * 0.35)
        Dim cellW = 58
        Dim cellH = 44

        Dim saved = data.keypad
        Dim index = 0
        For Each key As String In ClickTargets.KeypadDigitKeys()
            Dim marker = _markers(key)
            Dim target As PointTarget = Nothing
            If saved IsNot Nothing AndAlso saved.ContainsKey(key) Then
                target = saved(key)
            End If

            If target IsNot Nothing Then
                PositionMarker(marker, target)
            Else
                Dim col = index Mod 3
                Dim row = index \ 3
                Dim screenPt = New Point(startX + col * cellW, startY + row * cellH)
                PositionMarker(marker, New PointTarget With {.x = screenPt.X, .y = screenPt.Y})
            End If
            index += 1
        Next

        For Each marker As DraggableMarker In _markers.Values
            marker.BringToFront()
        Next
        _buttonBar.BringToFront()
    End Sub

    Private Sub PositionMarker(marker As DraggableMarker, target As PointTarget)
        Dim clientPt = _canvas.PointToClient(New Point(target.x, target.y))
        marker.Left = clientPt.X - marker.Width \ 2
        marker.Top = clientPt.Y - marker.Height \ 2
    End Sub

    Private Function CurrentKeypad() As Dictionary(Of String, PointTarget)
        Dim keypad As New Dictionary(Of String, PointTarget)()
        For Each pair As KeyValuePair(Of String, DraggableMarker) In _markers
            Dim center = pair.Value.CenterScreenPoint()
            keypad(pair.Key) = New PointTarget With {.x = center.X, .y = center.Y}
        Next
        Return keypad
    End Function

    Private Sub OnSave(sender As Object, e As EventArgs)
        Dim data = ClickTargets.LoadOrDefault()
        data.keypad = CurrentKeypad()
        ClickTargets.Save(data)
        MessageBox.Show(
            "Saved keypad targets." & Environment.NewLine &
            ClickTargets.GetTargetsFilePath(),
            "MTB Keypad Calibrator",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information)
    End Sub

    Private Sub OnTest(sender As Object, e As EventArgs)
        Dim data = ClickTargets.LoadOrDefault()
        If Not ClickTargets.HasAmountTarget(data) Then
            MessageBox.Show(
                "Calibrate AMOUNT in run-calibrator.bat first.",
                "Test Keypad",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning)
            Return
        End If

        data.keypad = CurrentKeypad()
        If Not ClickTargets.HasKeypad(data) Then
            MessageBox.Show("Drag all digit markers and CLR before testing.", "Test Keypad", MessageBoxButtons.OK, MessageBoxIcon.Warning)
            Return
        End If

        Me.WindowState = FormWindowState.Minimized
        Threading.Thread.Sleep(250)
        Try
            AmountEntry.EnterAmountViaKeypad(data.amount, data.keypad, "488")
        Catch ex As Exception
            MessageBox.Show(ex.Message, "Test Keypad", MessageBoxButtons.OK, MessageBoxIcon.Warning)
        End Try
        Me.WindowState = FormWindowState.Maximized
    End Sub
End Class

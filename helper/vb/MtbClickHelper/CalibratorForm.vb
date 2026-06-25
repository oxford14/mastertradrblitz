Imports System
Imports System.Drawing
Imports System.Windows.Forms

Public Class CalibratorForm
    Inherits Form

    Private ReadOnly _toolbar As Panel
    Private ReadOnly _buttonBar As FlowLayoutPanel
    Private ReadOnly _btnSave As Button
    Private ReadOnly _btnTestHigher As Button
    Private ReadOnly _btnTestLower As Button
    Private ReadOnly _btnTestAmount As Button
    Private ReadOnly _btnExit As Button
    Private ReadOnly _lblHint As Label
    Private ReadOnly _markerHigher As DraggableMarker
    Private ReadOnly _markerLower As DraggableMarker
    Private ReadOnly _markerAmount As DraggableMarker
    Private ReadOnly _canvas As Panel

    Public Sub New()
        Me.Text = "MTB Click Calibrator"
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
            .AutoSizeMode = AutoSizeMode.GrowAndShrink,
            .FlowDirection = FlowDirection.LeftToRight,
            .WrapContents = False,
            .Padding = New Padding(8, 10, 8, 8),
            .BackColor = Color.FromArgb(15, 20, 28)
        }

        _btnSave = CreateToolbarButton("Save", Color.FromArgb(34, 120, 70))
        _btnTestHigher = CreateToolbarButton("Test HIGHER", Color.FromArgb(40, 50, 65))
        _btnTestLower = CreateToolbarButton("Test LOWER", Color.FromArgb(40, 50, 65))
        _btnTestAmount = CreateToolbarButton("Test AMOUNT", Color.FromArgb(40, 50, 65))
        _btnExit = CreateToolbarButton("Exit", Color.FromArgb(80, 45, 45))

        _buttonBar.Controls.Add(_btnSave)
        _buttonBar.Controls.Add(_btnTestHigher)
        _buttonBar.Controls.Add(_btnTestLower)
        _buttonBar.Controls.Add(_btnTestAmount)
        _buttonBar.Controls.Add(_btnExit)

        _lblHint = New Label With {
            .AutoSize = False,
            .Dock = DockStyle.Fill,
            .BackColor = Color.FromArgb(15, 20, 28),
            .ForeColor = Color.Gainsboro,
            .TextAlign = ContentAlignment.MiddleLeft,
            .Text = "Drag HIGHER, LOWER, AMOUNT onto Exnova. Progression types the stake into Invest after double-clicking AMOUNT.",
            .Font = New Font("Segoe UI", 10.0F),
            .Padding = New Padding(12, 0, 0, 0)
        }

        _toolbar.Controls.Add(_lblHint)
        _toolbar.Controls.Add(_buttonBar)

        _canvas = New Panel With {
            .Dock = DockStyle.Fill,
            .BackColor = Color.FromArgb(15, 25, 35)
        }

        _markerHigher = New DraggableMarker("HIGHER", Color.FromArgb(34, 197, 94))
        _markerLower = New DraggableMarker("LOWER", Color.FromArgb(239, 68, 68))
        _markerAmount = New DraggableMarker(
            "AMOUNT",
            Color.FromArgb(245, 158, 11),
            New Size(72, 26),
            8.0F)

        _canvas.Controls.Add(_markerHigher)
        _canvas.Controls.Add(_markerLower)
        _canvas.Controls.Add(_markerAmount)

        Me.Controls.Add(_canvas)
        Me.Controls.Add(_toolbar)

        AddHandler Me.Shown, AddressOf OnFormShown
        AddHandler Me.KeyDown, AddressOf OnFormKeyDown
        AddHandler _btnSave.Click, AddressOf OnSave
        AddHandler _btnTestHigher.Click, AddressOf OnTestHigher
        AddHandler _btnTestLower.Click, AddressOf OnTestLower
        AddHandler _btnTestAmount.Click, AddressOf OnTestAmount
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
        PositionMarker(_markerHigher, data.higher)
        PositionMarker(_markerLower, data.lower)
        PositionMarker(_markerAmount, data.amount)
        _markerHigher.BringToFront()
        _markerLower.BringToFront()
        _markerAmount.BringToFront()
        _buttonBar.BringToFront()
    End Sub

    Private Sub PositionMarker(marker As DraggableMarker, target As PointTarget)
        Dim clientPt = _canvas.PointToClient(New Point(target.x, target.y))
        marker.Left = clientPt.X - marker.Width \ 2
        marker.Top = clientPt.Y - marker.Height \ 2
    End Sub

    Private Sub OnFormKeyDown(sender As Object, e As KeyEventArgs)
        If e.KeyCode = Keys.Escape Then
            Me.Close()
        ElseIf e.Control AndAlso e.KeyCode = Keys.S Then
            OnSave(Me, EventArgs.Empty)
        End If
    End Sub

    Private Function CurrentTargets() As ClickTargetsData
        Dim higherCenter = _markerHigher.CenterScreenPoint()
        Dim lowerCenter = _markerLower.CenterScreenPoint()
        Dim amountCenter = _markerAmount.CenterScreenPoint()
        Return New ClickTargetsData With {
            .higher = New PointTarget With {.x = higherCenter.X, .y = higherCenter.Y},
            .lower = New PointTarget With {.x = lowerCenter.X, .y = lowerCenter.Y},
            .amount = New PointTarget With {.x = amountCenter.X, .y = amountCenter.Y}
        }
    End Function

    Private Sub OnSave(sender As Object, e As EventArgs)
        ClickTargets.Save(CurrentTargets())
        MessageBox.Show(
            "Saved click targets." & Environment.NewLine &
            ClickTargets.GetTargetsFilePath(),
            "MTB Calibrator",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information)
    End Sub

    Private Sub MinimizeForAction()
        Me.WindowState = FormWindowState.Minimized
        Threading.Thread.Sleep(250)
    End Sub

    Private Sub RestoreAfterAction()
        Me.WindowState = FormWindowState.Maximized
    End Sub

    Private Sub OnTestHigher(sender As Object, e As EventArgs)
        Dim center = _markerHigher.CenterScreenPoint()
        MinimizeForAction()
        NativeMouseClick.ClickScreen(center.X, center.Y)
        RestoreAfterAction()
    End Sub

    Private Sub OnTestLower(sender As Object, e As EventArgs)
        Dim center = _markerLower.CenterScreenPoint()
        MinimizeForAction()
        NativeMouseClick.ClickScreen(center.X, center.Y)
        RestoreAfterAction()
    End Sub

    Private Sub OnTestAmount(sender As Object, e As EventArgs)
        Dim data = ClickTargets.LoadOrDefault()
        If Not ClickTargets.HasAmountTarget(data) Then
            MessageBox.Show(
                "Drag AMOUNT onto the Invest field and Save first.",
                "Test AMOUNT",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning)
            Return
        End If

        MinimizeForAction()
        Try
            Dim detail = AmountEntry.PasteAmount(data.amount, "488", True)
            MessageBox.Show(detail, "Test AMOUNT", MessageBoxButtons.OK, MessageBoxIcon.Information)
        Catch ex As Exception
            MessageBox.Show(ex.Message, "Test AMOUNT", MessageBoxButtons.OK, MessageBoxIcon.Warning)
        End Try
        RestoreAfterAction()
    End Sub
End Class

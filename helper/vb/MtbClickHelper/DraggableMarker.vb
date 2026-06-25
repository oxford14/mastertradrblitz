Imports System
Imports System.Drawing
Imports System.Windows.Forms

Public Class DraggableMarker
    Inherits Panel

    Private _dragging As Boolean
    Private _dragOffset As Point

    Public Sub New(label As String, backColor As Color, Optional markerSize As Size? = Nothing, Optional fontSize As Single = 11.0F)
        MyBase.New()
        Me.Size = If(markerSize.HasValue, markerSize.Value, New Size(120, 48))
        Me.BackColor = backColor
        Me.ForeColor = Color.White
        Me.Font = New Font("Segoe UI", fontSize, FontStyle.Bold)
        Me.Cursor = Cursors.SizeAll
        Me.DoubleBuffered = True
        Me.Tag = label
        Me.BorderStyle = BorderStyle.FixedSingle
    End Sub

    Protected Overrides Sub OnPaint(e As PaintEventArgs)
        MyBase.OnPaint(e)
        Dim label = Convert.ToString(Me.Tag)
        TextRenderer.DrawText(
            e.Graphics,
            label,
            Me.Font,
            New Rectangle(0, 0, Me.Width, Me.Height),
            Me.ForeColor,
            TextFormatFlags.HorizontalCenter Or TextFormatFlags.VerticalCenter)
    End Sub

    Protected Overrides Sub OnMouseDown(e As MouseEventArgs)
        MyBase.OnMouseDown(e)
        If e.Button = MouseButtons.Left Then
            _dragging = True
            _dragOffset = e.Location
        End If
    End Sub

    Protected Overrides Sub OnMouseMove(e As MouseEventArgs)
        MyBase.OnMouseMove(e)
        If _dragging Then
            Dim parentPanel = TryCast(Me.Parent, Control)
            If parentPanel Is Nothing Then Return
            Dim newLoc = Me.Location
            newLoc.X += e.X - _dragOffset.X
            newLoc.Y += e.Y - _dragOffset.Y
            newLoc.X = Math.Max(0, Math.Min(parentPanel.ClientSize.Width - Me.Width, newLoc.X))
            newLoc.Y = Math.Max(0, Math.Min(parentPanel.ClientSize.Height - Me.Height, newLoc.Y))
            Me.Location = newLoc
        End If
    End Sub

    Protected Overrides Sub OnMouseUp(e As MouseEventArgs)
        MyBase.OnMouseUp(e)
        _dragging = False
    End Sub

    Public Function CenterScreenPoint() As Point
        Return Me.PointToScreen(New Point(Me.Width \ 2, Me.Height \ 2))
    End Function
End Class

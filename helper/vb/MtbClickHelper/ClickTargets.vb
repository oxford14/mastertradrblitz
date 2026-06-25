Imports System
Imports System.Collections.Generic
Imports System.IO
Imports System.Web.Script.Serialization

Public Class PointTarget
    Public Property x As Integer
    Public Property y As Integer
End Class

Public Class ClickTargetsData
    Public Property higher As PointTarget
    Public Property lower As PointTarget
    Public Property amount As PointTarget
    Public Property keypad As Dictionary(Of String, PointTarget)
    Public Property updatedAt As String
End Class

Public Module ClickTargets
    Private ReadOnly Serializer As New JavaScriptSerializer()

    Public Function GetTargetsFilePath() As String
        Dim dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MasterTraderBlitz")
        If Not Directory.Exists(dir) Then
            Directory.CreateDirectory(dir)
        End If
        Return Path.Combine(dir, "click-targets.json")
    End Function

    Public Function Load() As ClickTargetsData
        Dim path = GetTargetsFilePath()
        If Not File.Exists(path) Then
            Return Nothing
        End If
        Try
            Dim json = File.ReadAllText(path)
            Return Serializer.Deserialize(Of ClickTargetsData)(json)
        Catch
            Return Nothing
        End Try
    End Function

    Public Sub Save(data As ClickTargetsData)
        data.updatedAt = DateTime.UtcNow.ToString("o")
        Dim json = Serializer.Serialize(data)
        File.WriteAllText(GetTargetsFilePath(), json)
    End Sub

    Public Function IsCalibrated(data As ClickTargetsData) As Boolean
        Return data IsNot Nothing AndAlso
            data.higher IsNot Nothing AndAlso
            data.lower IsNot Nothing
    End Function

    Public Function HasAmountTarget(data As ClickTargetsData) As Boolean
        Return data IsNot Nothing AndAlso data.amount IsNot Nothing
    End Function

    Public Function HasKeypad(data As ClickTargetsData) As Boolean
        If data Is Nothing OrElse data.keypad Is Nothing Then Return False
        For Each key As String In KeypadDigitKeys()
            If Not data.keypad.ContainsKey(key) Then Return False
            Dim target = data.keypad(key)
            If target Is Nothing Then Return False
        Next
        Return True
    End Function

    Public Function KeypadDigitKeys() As String()
        Return New String() {
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "clear"
        }
    End Function

    Public Function LoadOrDefault() As ClickTargetsData
        Dim saved = Load()
        Dim defaults = DefaultTargets()
        If saved Is Nothing Then Return defaults
        If saved.higher Is Nothing Then saved.higher = defaults.higher
        If saved.lower Is Nothing Then saved.lower = defaults.lower
        If saved.amount Is Nothing Then saved.amount = defaults.amount
        Return saved
    End Function

    Public Function DefaultTargets() As ClickTargetsData
        Dim screen = GetScreenWorkingArea()
        Return New ClickTargetsData With {
            .higher = New PointTarget With {
                .x = CInt(screen.Left + screen.Width * 0.75),
                .y = CInt(screen.Top + screen.Height * 0.55)
            },
            .lower = New PointTarget With {
                .x = CInt(screen.Left + screen.Width * 0.75),
                .y = CInt(screen.Top + screen.Height * 0.65)
            },
            .amount = New PointTarget With {
                .x = CInt(screen.Left + screen.Width * 0.75),
                .y = CInt(screen.Top + screen.Height * 0.42)
            }
        }
    End Function

    Public Function GetScreenWorkingArea() As System.Drawing.Rectangle
        Try
            Dim primary = System.Windows.Forms.Screen.PrimaryScreen
            If primary IsNot Nothing Then Return primary.WorkingArea
        Catch
        End Try

        Try
            Dim screens = System.Windows.Forms.Screen.AllScreens
            If screens IsNot Nothing Then
                For Each screen As System.Windows.Forms.Screen In screens
                    If screen IsNot Nothing Then Return screen.WorkingArea
                Next
            End If
        Catch
        End Try

        Return New System.Drawing.Rectangle(0, 0, 1920, 1080)
    End Function

    Public Function ResolveSignal(data As ClickTargetsData, signal As String) As PointTarget
        If data Is Nothing Then Return Nothing
        If String.Equals(signal, "HIGHER", StringComparison.OrdinalIgnoreCase) Then
            Return data.higher
        End If
        If String.Equals(signal, "LOWER", StringComparison.OrdinalIgnoreCase) Then
            Return data.lower
        End If
        Return Nothing
    End Function
End Module

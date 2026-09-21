param (
    [string]$DocxPath,
    [string]$PdfPath
)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($DocxPath)
    # 17 = wdExportFormatPDF
    $doc.ExportAsFixedFormat($PdfPath, 17)
    $doc.Close([ref]$false)
    Write-Output "SUCCESS: $PdfPath"
} catch {
    Write-Error $_.Exception.Message
} finally {
    try { $word.Quit() } catch {}
}

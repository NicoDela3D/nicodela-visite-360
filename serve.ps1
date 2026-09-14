# Serveur local statique pour Visite 360
# Lancer :  powershell -ExecutionPolicy Bypass -File serve.ps1
# Puis ouvrir http://localhost:5173 dans le navigateur.

param([int]$Port = 5173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8";
  ".json"="application/json"; ".webmanifest"="application/manifest+json"; ".glb"="model/gltf-binary"; ".gltf"="model/gltf+json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".svg"="image/svg+xml";
  ".webp"="image/webp"; ".csv"="text/csv; charset=utf-8";
  ".woff2"="font/woff2"; ".ico"="image/x-icon"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch {
  Write-Host "Impossible de demarrer sur $prefix - le port est peut-etre occupe." -ForegroundColor Red
  exit 1
}
Write-Host "Visite 360 -> $prefix  (Ctrl+C pour arreter)" -ForegroundColor Green

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart("/"))
  if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
  $path = Join-Path $root $rel
  if (Test-Path $path -PathType Container) { $path = Join-Path $path "index.html" }

  # Path-traversal guard: resolve both paths and verify $path stays under $root
  $resolvedRoot = [System.IO.Path]::GetFullPath($root)
  $resolvedPath = [System.IO.Path]::GetFullPath($path)
  if (-not $resolvedPath.StartsWith($resolvedRoot + [System.IO.Path]::DirectorySeparatorChar) -and
      $resolvedPath -ne $resolvedRoot) {
    $res.StatusCode = 404
    $b = [System.Text.Encoding]::UTF8.GetBytes("404 - Not found")
    $res.OutputStream.Write($b, 0, $b.Length)
    $res.OutputStream.Close()
    continue
  }

  if (Test-Path $path -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
    $b = [System.Text.Encoding]::UTF8.GetBytes("404 - $rel introuvable")
    $res.OutputStream.Write($b, 0, $b.Length)
  }
  $res.OutputStream.Close()
}

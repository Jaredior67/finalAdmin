<?php
/**
 * FixIt PDAS Facility Management Portal
 * Entry Point for Apache / XAMPP Localhost and Web Hosting
 *
 * Supports access via:
 * - http://localhost/FixIT
 * - http://localhost/capstoneSystem
 * - Custom domain on Web Hosting
 */

// If accessed as a directory without a trailing slash (e.g. /FixIT), redirect to add trailing slash
// This ensures relative links like ./assets/ resolve correctly to the directory.
$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($uri, PHP_URL_PATH);
if (substr($path, -1) !== '/' && !pathinfo($path, PATHINFO_EXTENSION)) {
    $queryString = $_SERVER['QUERY_STRING'] ? ('?' . $_SERVER['QUERY_STRING']) : '';
    header('Location: ' . $path . '/' . $queryString, true, 301);
    exit;
}

$distPath = __DIR__ . '/frontend/dist';
$distIndex = $distPath . '/index.html';

// Check if Vite dev server is running on port 5173 (if requested via ?dev or dev mode)
$isDevRequested = isset($_GET['dev']);
if ($isDevRequested) {
    $fp = @fsockopen('127.0.0.1', 5173, $errno, $errstr, 0.15);
    if ($fp) {
        fclose($fp);
        header('Location: http://localhost:5173/');
        exit;
    }
}

// Check if production build exists
if (file_exists($distIndex)) {
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    readfile($distIndex);
    exit;
}

// Fallback setup helper if frontend has not been built yet
http_response_code(503);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FixIt PDAS — Setup Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 36px;
      max-width: 540px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    h1 { margin: 0 0 12px; font-size: 22px; color: #38bdf8; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .code {
      background: #090d16;
      border: 1px solid #1e293b;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: monospace;
      color: #34d399;
      font-size: 13px;
      text-align: left;
      margin-bottom: 20px;
      overflow-x: auto;
    }
    .btn {
      display: inline-block;
      background: #0284c7;
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>FixIt PDAS Setup Required</h1>
    <p>The production frontend build was not found. Please build the application or start the backend:</p>
    <div class="code">
      cd c:\xampp\htdocs\capstoneSystem<br>
      npm run build
    </div>
    <a href="./" class="btn">Refresh System</a>
  </div>
</body>
</html>
